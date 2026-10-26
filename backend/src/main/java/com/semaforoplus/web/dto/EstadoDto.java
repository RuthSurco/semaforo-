package com.semaforoplus.web.dto;

/**
 * Estado actual del semáforo, tal como lo consume la interfaz web.
 *
 * @param conectado         true cuando hay una fuente de datos fresca
 * @param esp32Conectado    true cuando el ESP32 real está enviando telemetría
 * @param origen            ESP32 o SIMULADO
 * @param dispositivo       nombre del dispositivo
 * @param ubicacion         ubicación física
 * @param color             rojo | amarillo | verde
 * @param distanciaCm       última distancia medida por el HC-SR04
 * @param vehiculoDetectado true si el sensor detecta un vehículo
 * @param modo              automatico | manual
 * @param vehiculosDetectados contador acumulado de detecciones
 * @param cambiosColor      contador acumulado de cambios de color
 * @param ultimaLectura     hora de la última lectura (HH:mm:ss)
 * @param alertas           alertas activas
 * @param camaraConectada   estado de la cámara
 * @param totalLecturas     muestras guardadas en el historial
 * @param servidorHora      hora actual del servidor (HH:mm:ss)
 */
public record EstadoDto(
        boolean conectado,
        boolean esp32Conectado,
        String origen,
        String dispositivo,
        String ubicacion,
        String color,
        int distanciaCm,
        boolean vehiculoDetectado,
        String modo,
        long vehiculosDetectados,
        long cambiosColor,
        String ultimaLectura,
        int alertas,
        boolean camaraConectada,
        long totalLecturas,
        String servidorHora
) {
}
