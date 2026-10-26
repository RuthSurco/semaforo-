package com.semaforoplus.web.dto;

/** Una fila del historial de lecturas. */
public record LecturaDto(
        long id,
        String momento,
        int distanciaCm,
        boolean vehiculoDetectado,
        String color,
        String modo,
        String origen
) {
}
