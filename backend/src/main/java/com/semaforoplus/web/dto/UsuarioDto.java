package com.semaforoplus.web.dto;

import com.semaforoplus.modelo.Usuario;

import java.time.format.DateTimeFormatter;

/** Usuario tal como lo muestra la pantalla de gestión. */
public record UsuarioDto(
        Long id,
        String nombre,
        String usuario,
        String rol,
        String rolCodigo,
        boolean activo,
        String estado,
        String ultimoAcceso
) {

    private static final DateTimeFormatter FORMATO_FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    public static UsuarioDto desde(Usuario usuario) {
        return new UsuarioDto(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getUsuario(),
                usuario.getRol().getEtiqueta(),
                usuario.getRol().name(),
                usuario.isActivo(),
                usuario.isActivo() ? "Activo" : "Inactivo",
                usuario.getUltimoAcceso() == null ? "Nunca" : usuario.getUltimoAcceso().format(FORMATO_FECHA)
        );
    }
}
