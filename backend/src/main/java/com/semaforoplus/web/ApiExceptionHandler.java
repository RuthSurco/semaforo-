package com.semaforoplus.web;

import com.semaforoplus.servicio.CredencialesInvalidasException;
import com.semaforoplus.servicio.DatosInvalidosException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/** Convierte los errores de la API en respuestas JSON claras. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(DatosInvalidosException.class)
    public ResponseEntity<Map<String, Object>> datosInvalidos(DatosInvalidosException ex) {
        return ResponseEntity.badRequest().body(cuerpo(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(CredencialesInvalidasException.class)
    public ResponseEntity<Map<String, Object>> credencialesInvalidas(CredencialesInvalidasException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(cuerpo(HttpStatus.UNAUTHORIZED, ex.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> autenticacion(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(cuerpo(HttpStatus.UNAUTHORIZED, "Debes iniciar sesión."));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> accesoDenegado(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(cuerpo(HttpStatus.FORBIDDEN, "No tienes permiso para esta acción."));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> cuerpoIlegible(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(cuerpo(HttpStatus.BAD_REQUEST, "El cuerpo de la petición no es JSON válido."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> argumentoInvalido(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(cuerpo(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    /** Recursos estáticos inexistentes (por ejemplo /favicon.ico): 404 limpio. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> recursoNoEncontrado(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(cuerpo(HttpStatus.NOT_FOUND, "Recurso no encontrado: " + ex.getResourcePath()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> errorInterno(Exception ex) {
        log.error("Error no controlado en la API", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(cuerpo(HttpStatus.INTERNAL_SERVER_ERROR, "Error interno del servidor."));
    }

    private Map<String, Object> cuerpo(HttpStatus estado, String mensaje) {
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("codigo", estado.value());
        respuesta.put("error", estado.getReasonPhrase());
        respuesta.put("mensaje", mensaje);
        respuesta.put("momento", LocalDateTime.now().toString());
        return respuesta;
    }
}
