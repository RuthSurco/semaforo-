package com.semaforoplus.web.dto;

/**
 * Datos que envía el ESP32. Todos los campos son opcionales para que el
 * dispositivo pueda mandar solo lo que tenga disponible.
 */
public record TelemetriaRequest(
        Integer distanciaCm,
        Boolean vehiculoDetectado,
        String color,
        String modo,
        String dispositivo
) {
}
