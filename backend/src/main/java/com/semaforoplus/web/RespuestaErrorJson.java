package com.semaforoplus.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Escribe un error JSON desde los filtros de seguridad (fuera de los
 * controladores), manteniendo el mismo formato que {@link ApiExceptionHandler}.
 */
public final class RespuestaErrorJson {

    private RespuestaErrorJson() {
    }

    public static void escribir(HttpServletResponse respuesta, ObjectMapper objectMapper,
                                HttpStatus estado, String mensaje) throws IOException {
        if (respuesta.isCommitted()) {
            return;
        }
        respuesta.setStatus(estado.value());
        respuesta.setContentType(MediaType.APPLICATION_JSON_VALUE);
        respuesta.setCharacterEncoding("UTF-8");

        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("codigo", estado.value());
        cuerpo.put("error", estado.getReasonPhrase());
        cuerpo.put("mensaje", mensaje);
        cuerpo.put("momento", LocalDateTime.now().toString());
        objectMapper.writeValue(respuesta.getWriter(), cuerpo);
    }
}
