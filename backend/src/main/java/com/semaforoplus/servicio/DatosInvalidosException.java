package com.semaforoplus.servicio;

/** Error de validación en los datos recibidos por la API. */
public class DatosInvalidosException extends RuntimeException {

    public DatosInvalidosException(String mensaje) {
        super(mensaje);
    }
}
