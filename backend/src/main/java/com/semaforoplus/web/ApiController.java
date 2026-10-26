package com.semaforoplus.web;

import com.semaforoplus.servicio.DatosInvalidosException;
import com.semaforoplus.servicio.EstadisticasService;
import com.semaforoplus.servicio.SemaforoService;
import com.semaforoplus.web.dto.ComandoDto;
import com.semaforoplus.web.dto.EstadisticasDto;
import com.semaforoplus.web.dto.EstadoDto;
import com.semaforoplus.web.dto.LecturaDto;
import com.semaforoplus.web.dto.TelemetriaRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * API REST de Semáforo+.
 *
 * <p>La interfaz web y el ESP32 hablan con estos endpoints. Se aceptan datos
 * en JSON o en parámetros de formulario para que el ESP32 pueda enviarlos con
 * un simple {@code application/x-www-form-urlencoded}.</p>
 */
@RestController
@RequestMapping("/api")
public class ApiController {

    private final SemaforoService semaforo;
    private final EstadisticasService estadisticas;
    private final ObjectMapper objectMapper;

    public ApiController(SemaforoService semaforo, EstadisticasService estadisticas, ObjectMapper objectMapper) {
        this.semaforo = semaforo;
        this.estadisticas = estadisticas;
        this.objectMapper = objectMapper;
    }

    /* ========================== Estado ================================= */

    @GetMapping("/estado")
    public EstadoDto estado() {
        return semaforo.estado();
    }

    /* ========================= Telemetría ============================== */

    @PostMapping({"/telemetria", "/lecturas"})
    public EstadoDto telemetria(@RequestBody(required = false) String cuerpoCrudo,
                                @RequestParam Map<String, String> parametros) {
        return semaforo.registrar(leerTelemetria(leerJson(cuerpoCrudo), parametros), "ESP32");
    }

    @GetMapping({"/telemetria", "/lecturas"})
    public EstadoDto telemetriaPorParametros(@RequestParam Map<String, String> parametros) {
        return semaforo.registrar(leerTelemetria(null, parametros), "ESP32");
    }

    @GetMapping("/historial")
    public List<LecturaDto> historial(@RequestParam(defaultValue = "50") int limite) {
        return semaforo.historial(limite);
    }

    @DeleteMapping("/historial")
    public Map<String, Object> limpiarHistorial() {
        semaforo.limpiarHistorial();
        return Map.of("ok", true, "mensaje", "Historial eliminado.");
    }

    /* ========================= Estadísticas ============================ */

    @GetMapping("/estadisticas")
    public EstadisticasDto estadisticas(@RequestParam(defaultValue = "hoy") String periodo) {
        return estadisticas.calcular(periodo);
    }

    /* ======================= Control manual ============================ */

    @PutMapping("/control/modo")
    public EstadoDto cambiarModo(@RequestBody(required = false) String cuerpoCrudo,
                                 @RequestParam(required = false) String modo) {
        Map<String, Object> cuerpo = leerJson(cuerpoCrudo);
        String valor = modo != null ? modo : texto(cuerpo, "modo", "valor");
        if (valor == null) {
            throw new DatosInvalidosException("Falta el campo 'modo' (automatico | manual).");
        }
        return semaforo.cambiarModo(valor);
    }

    @PutMapping("/control/color")
    public EstadoDto cambiarColor(@RequestBody(required = false) String cuerpoCrudo,
                                  @RequestParam(required = false) String color) {
        Map<String, Object> cuerpo = leerJson(cuerpoCrudo);
        String valor = color != null ? color : texto(cuerpo, "color", "valor");
        if (valor == null) {
            throw new DatosInvalidosException("Falta el campo 'color' (rojo | amarillo | verde).");
        }
        return semaforo.cambiarColor(valor);
    }

    /** El ESP32 consulta aquí los comandos pendientes. 204 = no hay nada. */
    @GetMapping("/control/pendiente")
    public ResponseEntity<ComandoDto> pendiente() {
        return semaforo.tomarComando()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /* ========================= Simulación ============================== */

    @PostMapping("/simulacion/{accion}")
    public EstadoDto simular(@PathVariable String accion) {
        return switch (accion.toLowerCase(Locale.ROOT)) {
            case "acercar" -> simularVehiculo(30, true);
            case "alejar", "via-libre" -> simularVehiculo(120, false);
            case "restablecer" -> semaforo.restablecerSimulacion();
            default -> throw new DatosInvalidosException(
                    "Acción no válida: " + accion + ". Use acercar, alejar, via-libre o restablecer.");
        };
    }

    private EstadoDto simularVehiculo(int distancia, boolean detectado) {
        if (semaforo.esp32Conectado()) {
            throw new DatosInvalidosException(
                    "El ESP32 está conectado: la simulación está deshabilitada.");
        }
        return semaforo.registrar(new TelemetriaRequest(distancia, detectado, null, null, null), "SIMULADO");
    }

    /* =========================== Salud ================================= */

    @GetMapping("/salud")
    public Map<String, Object> salud() {
        Duration uptime = Duration.ofMillis(ManagementFactory.getRuntimeMXBean().getUptime());
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("estado", "ok");
        respuesta.put("aplicacion", "Semáforo+");
        respuesta.put("version", "1.0.0");
        respuesta.put("uptimeSegundos", uptime.toSeconds());
        respuesta.put("esp32Conectado", semaforo.esp32Conectado());
        return respuesta;
    }

    /* ========================= Utilidades ============================== */

    private Map<String, Object> leerJson(String cuerpoCrudo) {
        if (cuerpoCrudo == null || cuerpoCrudo.isBlank()) {
            return Map.of();
        }
        String limpio = cuerpoCrudo.trim();
        if (!limpio.startsWith("{")) {
            /* Formulario o texto plano: los datos llegan en @RequestParam. */
            return Map.of();
        }
        try {
            return objectMapper.readValue(limpio, new TypeReference<Map<String, Object>>() { });
        } catch (Exception e) {
            throw new DatosInvalidosException("JSON no válido: " + e.getMessage());
        }
    }

    private TelemetriaRequest leerTelemetria(Map<String, Object> cuerpo, Map<String, String> parametros) {        Integer distancia = entero(valor(cuerpo, parametros, "distancia", "distanciaCm", "distancia_cm", "distance"));
        Boolean vehiculo = booleano(valor(cuerpo, parametros, "vehiculo", "vehiculoDetectado", "vehiculo_detectado",
                "vehicle", "detectado"));
        String color = texto(valor(cuerpo, parametros, "color", "semaforo", "luz"));
        String modo = texto(valor(cuerpo, parametros, "modo", "mode"));
        String dispositivo = texto(valor(cuerpo, parametros, "dispositivo", "device"));

        if (distancia == null && vehiculo == null && color == null && modo == null) {
            throw new DatosInvalidosException(
                    "Envía al menos un dato: distancia, vehiculo, color o modo.");
        }
        return new TelemetriaRequest(distancia, vehiculo, color, modo, dispositivo);
    }

    private Object valor(Map<String, Object> cuerpo, Map<String, String> parametros, String... claves) {
        for (String clave : claves) {
            if (cuerpo != null) {
                for (Map.Entry<String, Object> entrada : cuerpo.entrySet()) {
                    if (entrada.getKey().equalsIgnoreCase(clave) && entrada.getValue() != null) {
                        return entrada.getValue();
                    }
                }
            }
            for (Map.Entry<String, String> entrada : parametros.entrySet()) {
                if (entrada.getKey().equalsIgnoreCase(clave) && entrada.getValue() != null
                        && !entrada.getValue().isBlank()) {
                    return entrada.getValue();
                }
            }
        }
        return null;
    }

    private String texto(Map<String, Object> cuerpo, String... claves) {
        Object valor = valor(cuerpo, Map.of(), claves);
        return valor == null ? null : String.valueOf(valor);
    }

    private String texto(Object valor) {
        return valor == null ? null : String.valueOf(valor).trim();
    }

    private Integer entero(Object valor) {
        if (valor == null) {
            return null;
        }
        if (valor instanceof Number numero) {
            return numero.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(valor).trim());
        } catch (NumberFormatException e) {
            throw new DatosInvalidosException("Valor numérico no válido: " + valor);
        }
    }

    private Boolean booleano(Object valor) {
        if (valor == null) {
            return null;
        }
        if (valor instanceof Boolean b) {
            return b;
        }
        String texto = String.valueOf(valor).trim().toLowerCase(Locale.ROOT);
        return switch (texto) {
            case "1", "true", "si", "sí", "on", "yes" -> Boolean.TRUE;
            case "0", "false", "no", "off" -> Boolean.FALSE;
            default -> throw new DatosInvalidosException("Valor booleano no válido: " + valor);
        };
    }
}
