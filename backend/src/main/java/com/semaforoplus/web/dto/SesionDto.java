package com.semaforoplus.web.dto;

import com.semaforoplus.modelo.Usuario;

/** Sesión activa que devuelve el backend tras un login correcto. */
public record SesionDto(
        Long id,
        String nombre,
        String usuario,
        String rol,
        String rolCodigo,
        boolean activo,
        String ultimoAcceso
) {

    public static SesionDto desde(Usuario usuario) {
        return new SesionDto(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getUsuario(),
                usuario.getRol().getEtiqueta(),
                usuario.getRol().name(),
                usuario.isActivo(),
                UsuarioDto.desde(usuario).ultimoAcceso()
        );
    }
}
