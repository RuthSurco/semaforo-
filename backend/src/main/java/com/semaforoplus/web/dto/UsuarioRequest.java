package com.semaforoplus.web.dto;

/**
 * Datos para crear o editar un usuario.
 *
 * <p>En una edición, {@code clave} puede llegar vacío: en ese caso se conserva
 * la contraseña actual.</p>
 */
public record UsuarioRequest(
        String nombre,
        String usuario,
        String clave,
        String rol,
        Boolean activo
) {
}
