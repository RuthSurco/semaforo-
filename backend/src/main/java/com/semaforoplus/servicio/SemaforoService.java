package com.semaforoplus.servicio;

import com.semaforoplus.modelo.Lectura;
import com.semaforoplus.repositorio.LecturaRepository;
import com.semaforoplus.web.dto.ComandoDto;
import com.semaforoplus.web.dto.EstadoDto;
import com.semaforoplus.web.dto.LecturaDto;
import com.semaforoplus.web.dto.TelemetriaRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Random;
import java.util.Set;

/**
 * Mantiene el estado actual del semáforo, guarda el historial y coordina los
 * comandos que el ESP32 debe ejecutar.
 */
@Service
public class SemaforoService {

    private static final Set<String> COLORES = Set.of("rojo", "amarillo", "verde");
    private static final Set<String> MODOS = Set.of("automatico", "manual");
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final DateTimeFormatter FECHA_HORA = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_COMANDOS = 20;
    private static final int DISTANCIA_INICIAL = 120;

    private final LecturaRepository lecturas;
    private final String nombreDispositivo;
    private final String ubicacion;
    private final long silencioRealMs;
    private final int maxRegistros;
    private final Random aleatorio = new Random();
    private final Object candado = new Object();
    private final Deque<ComandoDto> comandos = new ArrayDeque<>();

    private String color = "rojo";
    private int distanciaCm = DISTANCIA_INICIAL;
    private boolean vehiculoDetectado = false;
    private String modo = "automatico";
    private long vehiculosDetectados = 0;
    private long cambiosColor = 0;
    private LocalDateTime ultimaLectura = null;
    private String origen = "SIMULADO";
    private Instant ultimaTelemetriaReal = Instant.EPOCH;
    private long totalLecturas = 0;
    private boolean camaraConectada = true;
    private int pasosSinDeteccion = 0;

    public SemaforoService(
            LecturaRepository lecturas,
            @Value("${semaforo.dispositivo.nombre:Semáforo Principal}") String nombreDispositivo,
            @Value("${semaforo.dispositivo.ubicacion:Avenida Central}") String ubicacion,
            @Value("${semaforo.simulador.silencio-real-ms:10000}") long silencioRealMs,
            @Value("${semaforo.historial.max-registros:20000}") int maxRegistros) {
        this.lecturas = lecturas;
        this.nombreDispositivo = nombreDispositivo;
        this.ubicacion = ubicacion;
        this.silencioRealMs = silencioRealMs;
        this.maxRegistros = maxRegistros;
    }

    /* ======================== Consulta de estado ========================= */

    public EstadoDto estado() {
        synchronized (candado) {
            return aDto();
        }
    }

    /**
     * Indica si el ESP32 real ha enviado telemetría dentro de la ventana de
     * silencio configurada.
     */
    public boolean esp32Conectado() {
        synchronized (candado) {
            return esp32ConectadoAhora();
        }
    }

    private boolean esp32ConectadoAhora() {
        if (ultimaTelemetriaReal.equals(Instant.EPOCH)) {
            return false;
        }
        long transcurrido = Duration.between(ultimaTelemetriaReal, Instant.now()).toMillis();
        return transcurrido >= 0 && transcurrido <= silencioRealMs;
    }

    /* ========================== Telemetría ============================== */

    /**
     * Registra una muestra enviada por el ESP32 o generada por el simulador.
     * Cuenta las detecciones y los cambios de color en los flancos.
     */
    public EstadoDto registrar(TelemetriaRequest peticion, String origenDato) {
        synchronized (candado) {
            LocalDateTime ahora = LocalDateTime.now();

            boolean vehiculoAnterior = vehiculoDetectado;
            String colorAnterior = color;
            String modoNuevo = peticion.modo() == null ? modo : normalizarModo(peticion.modo());

            if (peticion.distanciaCm() != null) {
                distanciaCm = validarDistancia(peticion.distanciaCm());
            }
            if (peticion.vehiculoDetectado() != null) {
                vehiculoDetectado = peticion.vehiculoDetectado();
            }
            modo = modoNuevo;

            if (peticion.color() != null) {
                color = normalizarColor(peticion.color());
            } else if ("automatico".equals(modo)) {
                color = vehiculoDetectado ? "verde" : "rojo";
            }

            if (vehiculoDetectado && !vehiculoAnterior) {
                vehiculosDetectados++;
            }
            if (!color.equals(colorAnterior)) {
                cambiosColor++;
            }

            ultimaLectura = ahora;
            this.origen = "ESP32".equals(origenDato) ? "ESP32" : "SIMULADO";
            if ("ESP32".equals(this.origen)) {
                ultimaTelemetriaReal = Instant.now();
            }

            guardarLectura(ahora);
            return aDto();
        }
    }

    /* ======================= Control manual ============================= */

    public EstadoDto cambiarModo(String nuevoModo) {
        synchronized (candado) {
            String modoNormalizado = normalizarModo(nuevoModo);
            if (!modoNormalizado.equals(modo)) {
                modo = modoNormalizado;
                if ("automatico".equals(modo)) {
                    String colorAnterior = color;
                    color = vehiculoDetectado ? "verde" : "rojo";
                    if (!color.equals(colorAnterior)) {
                        cambiosColor++;
                    }
                }
                ultimaLectura = LocalDateTime.now();
                guardarLectura(ultimaLectura);
                encolarComando("modo", modo);
            }
            return aDto();
        }
    }

    public EstadoDto cambiarColor(String nuevoColor) {
        synchronized (candado) {
            String colorNormalizado = normalizarColor(nuevoColor);
            if (!"manual".equals(modo)) {
                throw new DatosInvalidosException(
                        "El control manual solo está disponible en modo manual.");
            }
            if (!colorNormalizado.equals(color)) {
                color = colorNormalizado;
                cambiosColor++;
                ultimaLectura = LocalDateTime.now();
                guardarLectura(ultimaLectura);
                encolarComando("color", color);
            }
            return aDto();
        }
    }

    /** El ESP32 consulta aquí los comandos pendientes (204 si no hay). */
    public Optional<ComandoDto> tomarComando() {
        synchronized (candado) {
            return Optional.ofNullable(comandos.pollFirst());
        }
    }

    private void encolarComando(String tipo, String valor) {
        while (comandos.size() >= MAX_COMANDOS) {
            comandos.pollFirst();
        }
        comandos.addLast(new ComandoDto(tipo, valor, LocalDateTime.now().format(FECHA_HORA)));
    }

    /* ======================== Simulación ================================ */

    /**
     * Avanza un paso de la simulación. Solo se usa cuando el ESP32 no está
     * enviando datos.
     */
    public void pasoSimulador() {
        synchronized (candado) {
            if (esp32ConectadoAhora()) {
                return;
            }

            int delta;
            if (!vehiculoDetectado && pasosSinDeteccion >= 6) {
                /* Tras unos segundos de vía libre, un vehículo se acerca:
                   así la demo muestra actividad rápidamente. */
                delta = -(6 + aleatorio.nextInt(10));
            } else {
                delta = aleatorio.nextInt(41) - 20;
            }
            distanciaCm = Math.max(15, Math.min(160, distanciaCm + delta));

            boolean detectado = vehiculoDetectado ? distanciaCm < 60 : distanciaCm < 38;
            if (detectado && !vehiculoDetectado) {
                vehiculosDetectados++;
                pasosSinDeteccion = 0;
            } else if (!detectado) {
                pasosSinDeteccion++;
            }
            vehiculoDetectado = detectado;

            if ("automatico".equals(modo)) {
                String deseado = detectado ? "verde" : "rojo";
                if (!deseado.equals(color)) {
                    /* Un paso en amarillo antes del cambio, como un semáforo real. */
                    color = "amarillo".equals(color) ? deseado : "amarillo";
                    cambiosColor++;
                }
            }

            LocalDateTime ahora = LocalDateTime.now();
            ultimaLectura = ahora;
            origen = "SIMULADO";
            guardarLectura(ahora);
        }
    }

    /** Restablece el estado simulado a sus valores iniciales. */
    public EstadoDto restablecerSimulacion() {
        synchronized (candado) {
            color = "rojo";
            distanciaCm = DISTANCIA_INICIAL;
            vehiculoDetectado = false;
            modo = "automatico";
            ultimaLectura = LocalDateTime.now();
            origen = "SIMULADO";
            guardarLectura(ultimaLectura);
            return aDto();
        }
    }

    /* ========================== Historial =============================== */

    public List<LecturaDto> historial(int limite) {
        int cantidad = Math.max(1, Math.min(limite, 100));
        return lecturas.findTop100ByOrderByMomentoDesc().stream()
                .limit(cantidad)
                .map(this::aLecturaDto)
                .toList();
    }

    /** Borra todas las muestras del historial. */
    public void limpiarHistorial() {
        synchronized (candado) {
            lecturas.deleteAllInBatch();
            totalLecturas = 0;
        }
    }

    /** Borra las muestras más antiguas si se supera el máximo configurado. */
    @Scheduled(fixedDelay = 60_000L)
    public void aplicarRetencion() {
        long total = lecturas.count();
        if (total <= maxRegistros) {
            return;
        }
        List<Long> ids = lecturas.findTop1000ByOrderByMomentoAsc().stream()
                .map(Lectura::getId)
                .toList();
        if (!ids.isEmpty()) {
            lecturas.eliminarPorIds(ids);
        }
    }

    private void guardarLectura(LocalDateTime momento) {
        lecturas.save(new Lectura(momento, distanciaCm, vehiculoDetectado, color, modo, origen,
                nombreDispositivo));
        totalLecturas++;
    }

    /* ============================ Utilidades ============================ */

    private EstadoDto aDto() {
        boolean esp32 = esp32ConectadoAhora();
        String hora = ultimaLectura == null ? null : ultimaLectura.format(HORA);
        int alertas = "manual".equals(modo) && vehiculoDetectado ? 1 : 0;
        return new EstadoDto(
                true,
                esp32,
                origen,
                nombreDispositivo,
                ubicacion,
                color,
                distanciaCm,
                vehiculoDetectado,
                modo,
                vehiculosDetectados,
                cambiosColor,
                hora,
                alertas,
                camaraConectada,
                totalLecturas,
                LocalDateTime.now(ZoneId.systemDefault()).format(HORA)
        );
    }

    private LecturaDto aLecturaDto(Lectura lectura) {
        return new LecturaDto(
                lectura.getId(),
                lectura.getMomento().format(FECHA_HORA),
                lectura.getDistanciaCm(),
                lectura.isVehiculoDetectado(),
                lectura.getColor(),
                lectura.getModo(),
                lectura.getOrigen()
        );
    }

    private String normalizarModo(String valor) {
        String normalizado = valor == null ? "" : valor.trim().toLowerCase(Locale.ROOT);
        if (!MODOS.contains(normalizado)) {
            throw new DatosInvalidosException("Modo no válido: " + valor + ". Use automatico o manual.");
        }
        return normalizado;
    }

    private String normalizarColor(String valor) {
        String normalizado = valor == null ? "" : valor.trim().toLowerCase(Locale.ROOT);
        if (!COLORES.contains(normalizado)) {
            throw new DatosInvalidosException("Color no válido: " + valor + ". Use rojo, amarillo o verde.");
        }
        return normalizado;
    }

    private int validarDistancia(int valor) {
        if (valor < 0 || valor > 1000) {
            throw new DatosInvalidosException("Distancia fuera de rango (0-1000 cm): " + valor);
        }
        return valor;
    }
}
