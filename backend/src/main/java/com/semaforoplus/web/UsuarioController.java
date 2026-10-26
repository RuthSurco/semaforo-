package com.semaforoplus.web;

import com.semaforoplus.servicio.UsuarioService;
import com.semaforoplus.web.dto.UsuarioDto;
import com.semaforoplus.web.dto.UsuarioRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Gestión de usuarios. Solo accesible con rol superadministrador. */
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final UsuarioService usuarios;

    public UsuarioController(UsuarioService usuarios) {
        this.usuarios = usuarios;
    }

    @GetMapping
    public List<UsuarioDto> listar() {
        return usuarios.listar();
    }

    @GetMapping("/{id}")
    public UsuarioDto buscar(@PathVariable Long id) {
        return usuarios.buscar(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UsuarioDto crear(@RequestBody(required = false) UsuarioRequest peticion) {
        return usuarios.crear(peticion);
    }

    @PutMapping("/{id}")
    public UsuarioDto actualizar(@PathVariable Long id,
                                 @RequestBody(required = false) UsuarioRequest peticion) {
        return usuarios.actualizar(id, peticion);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> eliminar(@PathVariable Long id) {
        usuarios.eliminar(id);
        return Map.of("ok", true, "mensaje", "Usuario eliminado.");
    }
}
