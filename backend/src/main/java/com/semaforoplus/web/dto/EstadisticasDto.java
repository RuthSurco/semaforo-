package com.semaforoplus.web.dto;

import java.util.List;
import java.util.Map;

/**
 * Estadísticas calculadas a partir del historial real guardado en H2.
 *
 * @param periodo               hoy | semana | mes
 * @param etiqueta              texto legible del periodo
 * @param totalVehiculos        detecciones contadas en el periodo
 * @param cambios               cambios de color en el periodo
 * @param horaPico              hora con más detecciones (HH:mm)
 * @param esperaPromedioSegundos espera media desde la detección hasta el verde
 * @param tiempos               porcentaje de tiempo en cada color
 * @param porHora               vehículos por hora (últimas 8 horas)
 * @param semanal               vehículos por día (últimos 7 días)
 * @param trafico               nivel de tráfico por zona
 */
public record EstadisticasDto(
        String periodo,
        String etiqueta,
        long totalVehiculos,
        long cambios,
        String horaPico,
        long esperaPromedioSegundos,
        Map<String, Integer> tiempos,
        List<SerieDto> porHora,
        List<SerieDto> semanal,
        List<TraficoDto> trafico
) {
}
