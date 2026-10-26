package com.semaforoplus.web;

import com.semaforoplus.modelo.Usuario;
import com.semaforoplus.servicio.CredencialesInvalidasException;
import com.semaforoplus.servicio.UsuarioService;
import com.semaforoplus.web.dto.LoginRequest;
import com.semaforoplus.web.dto.SesionDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Login real con sesión del servidor.
 *
 * <p>El navegador guarda una cookie {@code JSESSIONID}; la contraseña nunca se
 * queda en el navegador. Al cerrar sesión se invalida en el servidor.</p>
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager gestorAutenticacion;
    private final UsuarioService usuarios;
    private final SecurityContextRepository repositorioContexto;

    public AuthController(AuthenticationManager gestorAutenticacion,
                          UsuarioService usuarios,
                          SecurityContextRepository repositorioContexto) {
        this.gestorAutenticacion = gestorAutenticacion;
        this.usuarios = usuarios;
        this.repositorioContexto = repositorioContexto;
    }

    @PostMapping("/login")
    public SesionDto login(@RequestBody(required = false) LoginRequest peticion,
                           HttpServletRequest solicitud,
                           HttpServletResponse respuesta) {

        if (peticion == null) {
            throw new CredencialesInvalidasException("Escribe tu usuario y contraseña.");
        }

        String nombre = peticion.usuario() == null ? "" : peticion.usuario().trim();
        String clave = peticion.clave() == null ? "" : peticion.clave();

        if (nombre.isEmpty() || clave.isEmpty()) {
            throw new CredencialesInvalidasException("Escribe tu usuario y contraseña.");
        }

        Authentication autenticacion;
        try {
            autenticacion = gestorAutenticacion.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(nombre, clave));
        } catch (AuthenticationException ex) {
            /* Mismo mensaje para usuario inexistente, clave incorrecta o cuenta
               desactivada: no se revela qué cuentas existen. */
            throw new CredencialesInvalidasException("Usuario o contraseña incorrectos.");
        }

        SecurityContext contexto = SecurityContextHolder.createEmptyContext();
        contexto.setAuthentication(autenticacion);
        SecurityContextHolder.setContext(contexto);

        /* Evita fijación de sesión: si ya había una, se cambia el identificador. */
        if (solicitud.getSession(false) != null) {
            solicitud.changeSessionId();
        }
        repositorioContexto.saveContext(contexto, solicitud, respuesta);

        Usuario usuario = usuarios.registrarAcceso(autenticacion.getName());

        /* Se guarda el id en la sesión para reconocer a la persona aunque luego
           cambie su nombre de acceso. */
        solicitud.getSession(true).setAttribute("usuarioId", usuario.getId());

        return SesionDto.desde(usuario);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest solicitud) {
        HttpSession sesion = solicitud.getSession(false);
        if (sesion != null) {
            sesion.invalidate();
        }
        SecurityContextHolder.clearContext();
        return Map.of("ok", true, "mensaje", "Sesión cerrada.");
    }

    /**
     * Devuelve la sesión actual o 204 si no hay ninguna.
     *
     * <p>El navegador lo usa al recargar la página. Se responde 204 (y no 401)
     * para que una visita normal al login no ensucie la consola del navegador
     * con un error de red.</p>
     */
    @GetMapping("/yo")
    public ResponseEntity<SesionDto> yo(Authentication autenticacion) {
        if (autenticacion == null || !autenticacion.isAuthenticated()) {
            return ResponseEntity.noContent().build();
        }

        Usuario usuario = usuarios.buscarPorUsuario(autenticacion.getName()).orElse(null);
        if (usuario == null || !usuario.isActivo()) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(SesionDto.desde(usuario));
    }
}
