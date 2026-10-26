package com.semaforoplus.web.dto;

/** Datos que envía la pantalla de login. */
public record LoginRequest(String usuario, String clave) {
}
