package com.semaforoplus.web.dto;

/** Comando pendiente que el ESP32 debe ejecutar (modo o color). */
public record ComandoDto(String tipo, String valor, String emitidoEn) {
}
