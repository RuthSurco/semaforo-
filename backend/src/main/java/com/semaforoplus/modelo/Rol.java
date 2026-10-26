package com.semaforoplus.modelo;

/**
 * Roles del sistema.
 *
 * <p>El código ({@code SUPERADMIN}, {@code ADMIN}) es lo que usa Spring Security
 * para las autoridades. La etiqueta es lo que ve el usuario en la interfaz.</p>
 */
public enum Rol {

    SUPERADMIN("Superadministrador"),
    ADMIN("Administrador");

    private final String etiqueta;

    Rol(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /** Acepta tanto el código como la etiqueta escrita por el usuario. */
    public static Rol desde(String valor) {
        if (valor == null || valor.isBlank()) {
            throw new IllegalArgumentException("El rol es obligatorio.");
        }
        String limpio = valor.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (limpio) {
            case "SUPERADMIN", "SUPERADMINISTRADOR" -> SUPERADMIN;
            case "ADMIN", "ADMINISTRADOR" -> ADMIN;
            default -> throw new IllegalArgumentException(
                    "Rol no válido: " + valor + ". Use Administrador o Superadministrador.");
        };
    }
}
