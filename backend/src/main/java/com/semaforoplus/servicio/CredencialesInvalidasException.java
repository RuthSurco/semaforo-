package com.semaforoplus.servicio;

/** Usuario o contraseña incorrectos, o cuenta deshabilitada al iniciar sesión. */
public class CredencialesInvalidasException extends RuntimeException {

    public CredencialesInvalidasException(String mensaje) {
        super(mensaje);
    }
}
