package com.semaforoplus.servicio;

import com.semaforoplus.modelo.Lectura;
import com.semaforoplus.repositorio.LecturaRepository;
import com.semaforoplus.web.dto.EstadisticasDto;
import com.semaforoplus.web.dto.SerieDto;
import com.semaforoplus.web.dto.TraficoDto;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Calcula las estadísticas del panel a partir del historial guardado en H2.
 */
@Service
public class EstadisticasService {

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:00");
    private static final String[] DIAS = {"Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"};

    private final LecturaRepository lecturas;

    public EstadisticasService(LecturaRepository lecturas) {
        this.lecturas = lecturas;
    }

    public EstadisticasDto calcular(String periodo) {
        String clave = periodo == null ? "hoy" : periodo.trim().toLowerCase(Locale.ROOT);
        LocalDateTime ahora = LocalDateTime.now();

        LocalDateTime desde = switch (clave) {
            case "semana" -> ahora.minusDays(6).toLocalDate().atStartOfDay();
            case "mes" -> ahora.minusDays(29).toLocalDate().atStartOfDay();
            default -> ahora.toLocalDate().atStartOfDay();
        };

        List<Lectura> muestras = lecturas.findByMomentoAfterOrderByMomentoAsc(desde.minusSeconds(1));

        List<LocalDateTime> detecciones = new ArrayList<>();
        long cambios = 0;
        long segundosTotales = 0;
        long segundosRojo = 0;
        long segundosAmarillo = 0;
        long segundosVerde = 0;

        for (int i = 0; i < muestras.size(); i++) {
            Lectura actual = muestras.get(i);
            if (actual.isVehiculoDetectado()
                    && (i == 0 || !muestras.get(i - 1).isVehiculoDetectado())) {
                detecciones.add(actual.getMomento());
            }
            if (i > 0) {
                Lectura anterior = muestras.get(i - 1);
                if (!actual.getColor().equals(anterior.getColor())) {
                    cambios++;
                }
                long segundos = Math.min(10,
                        Math.max(0, Duration.between(anterior.getMomento(), actual.getMomento()).toSeconds()));
                segundosTotales += segundos;
                switch (anterior.getColor()) {
                    case "rojo" -> segundosRojo += segundos;
                    case "amarillo" -> segundosAmarillo += segundos;
                    case "verde" -> segundosVerde += segundos;
                    default -> { }
                }
            }
        }

        long esperaPromedio = calcularEsperaMedia(muestras, detecciones);

        Map<String, Integer> tiempos = porcentajes(segundosTotales, segundosRojo, segundosAmarillo, segundosVerde);
        List<SerieDto> porHora = seriePorHora(detecciones, ahora);
        List<SerieDto> semanal = serieSemanal(detecciones);
        String horaPico = horaPico(detecciones);

        long total = detecciones.size();
        return new EstadisticasDto(
                clave,
                etiqueta(clave),
                total,
                cambios,
                horaPico,
                esperaPromedio,
                tiempos,
                porHora,
                semanal,
                trafico(total)
        );
    }

    private long calcularEsperaMedia(List<Lectura> muestras, List<LocalDateTime> detecciones) {
        long total = 0;
        int contadas = 0;
        for (LocalDateTime deteccion : detecciones) {
            for (Lectura muestra : muestras) {
                if (muestra.getMomento().isAfter(deteccion) && "verde".equals(muestra.getColor())) {
                    total += Math.min(60,
                            Math.max(0, Duration.between(deteccion, muestra.getMomento()).toSeconds()));
                    contadas++;
                    break;
                }
            }
        }
        return contadas == 0 ? 0 : total / contadas;
    }

    private Map<String, Integer> porcentajes(long total, long rojo, long amarillo, long verde) {
        Map<String, Integer> mapa = new LinkedHashMap<>();
        if (total <= 0) {
            mapa.put("rojo", 0);
            mapa.put("amarillo", 0);
            mapa.put("verde", 0);
            return mapa;
        }
        int r = (int) Math.round(rojo * 100.0 / total);
        int a = (int) Math.round(amarillo * 100.0 / total);
        int v = Math.max(0, 100 - r - a);
        mapa.put("rojo", r);
        mapa.put("amarillo", a);
        mapa.put("verde", v);
        return mapa;
    }

    private List<SerieDto> seriePorHora(List<LocalDateTime> detecciones, LocalDateTime ahora) {
        List<SerieDto> serie = new ArrayList<>();
        for (int i = 7; i >= 0; i--) {
            LocalDateTime inicio = ahora.minusHours(i).withMinute(0).withSecond(0).withNano(0);
            long valor = detecciones.stream()
                    .filter(d -> !d.isBefore(inicio) && d.isBefore(inicio.plusHours(1)))
                    .count();
            serie.add(new SerieDto(inicio.format(HORA), valor));
        }
        return serie;
    }

    private List<SerieDto> serieSemanal(List<LocalDateTime> detecciones) {
        List<SerieDto> serie = new ArrayList<>();
        LocalDate hoy = LocalDate.now();
        for (int i = 6; i >= 0; i--) {
            LocalDate dia = hoy.minusDays(i);
            long valor = detecciones.stream()
                    .filter(d -> d.toLocalDate().equals(dia))
                    .count();
            serie.add(new SerieDto(DIAS[dia.getDayOfWeek().getValue() - 1], valor));
        }
        return serie;
    }

    private String horaPico(List<LocalDateTime> detecciones) {
        if (detecciones.isEmpty()) {
            return LocalDateTime.now().format(HORA);
        }
        Map<Integer, Long> porHora = new LinkedHashMap<>();
        for (LocalDateTime deteccion : detecciones) {
            porHora.merge(deteccion.getHour(), 1L, Long::sum);
        }
        int hora = porHora.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(LocalDateTime.now().getHour());
        return String.format("%02d:00", hora);
    }

    private List<TraficoDto> trafico(long detecciones) {
        long base = Math.min(100, 35 + detecciones * 3);
        return List.of(
                zona("Avenida Central", (int) base),
                zona("Calle Norte", (int) Math.min(100, 25 + detecciones * 2)),
                zona("Cruce Costanera", (int) Math.min(100, 45 + detecciones * 4)),
                zona("Ronda Este", (int) Math.min(100, 15 + detecciones)),
                new TraficoDto("Sensor 4 (sin conexión)", "desconectado", 0)
        );
    }

    private TraficoDto zona(String nombre, int porcentaje) {
        String nivel = porcentaje >= 75 ? "intenso" : (porcentaje >= 45 ? "moderado" : "normal");
        return new TraficoDto(nombre, nivel, porcentaje);
    }

    private String etiqueta(String clave) {
        return switch (clave) {
            case "semana" -> "Esta semana";
            case "mes" -> "Este mes";
            default -> "Hoy";
        };
    }
}
