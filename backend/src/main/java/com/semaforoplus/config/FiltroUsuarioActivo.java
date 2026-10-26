package com.semaforoplus.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semaforoplus.modelo.Usuario;
import com.semaforoplus.repositorio.UsuarioRepository;
import com.semaforoplus.web.RespuestaErrorJson;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Comprueba en cada petición a la API que el usuario de la sesión siga
 * existiendo y esté activo.
 *
 * <p>Así, si un superadministrador elimina o desactiva una cuenta, esa persona
 * pierde el acceso de inmediato aunque tuviera la sesión abierta.</p>
 */
public class FiltroUsuarioActivo extends OncePerRequestFilter {

    private final UsuarioRepository repositorio;
    private final ObjectMapper objectMapper;

    public FiltroUsuarioActivo(UsuarioRepository repositorio, ObjectMapper objectMapper) {
        this.repositorio = repositorio;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest peticion) {
        String ruta = peticion.getRequestURI();

        /* El login y el logout deben funcionar aunque la sesión anterior
           pertenezca a una cuenta ya desactivada. */
        if (ruta.equals("/api/auth/login") || ruta.equals("/api/auth/logout")) {
            return true;
        }
        return !(ruta.equals("/api") || ruta.startsWith("/api/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest peticion, HttpServletResponse respuesta,
                                    FilterChain cadena) throws ServletException, IOException {
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();

        if (autenticacion != null && autenticacion.isAuthenticated()
                && !(autenticacion instanceof AnonymousAuthenticationToken)) {

            /* Se busca por el id guardado al iniciar sesión. Así, si la persona
               cambia su propio nombre de acceso, la sesión sigue siendo válida. */
            HttpSession sesion = peticion.getSession(false);
            Object idSesion = sesion == null ? null : sesion.getAttribute("usuarioId");

            Usuario usuario = null;
            if (idSesion instanceof Long id) {
                usuario = repositorio.findById(id).orElse(null);
            }
            if (usuario == null) {
                usuario = repositorio.findByUsuarioIgnoreCase(autenticacion.getName()).orElse(null);
            }

            if (usuario == null || !usuario.isActivo()) {
                SecurityContextHolder.clearContext();
                if (sesion != null) {
                    sesion.invalidate();
                }
                RespuestaErrorJson.escribir(respuesta, objectMapper, HttpStatus.UNAUTHORIZED,
                        "Tu sesión ya no es válida. Inicia sesión de nuevo.");
                return;
            }

            /* Si el nombre o el rol cambiaron mientras la sesión estaba abierta,
               se aplican de inmediato (sin esperar a un nuevo login). */
            String rolActual = "ROLE_" + usuario.getRol().name();
            boolean rolDesactualizado = autenticacion.getAuthorities().stream()
                    .noneMatch(autoridad -> autoridad.getAuthority().equals(rolActual));
            boolean nombreDesactualizado = !usuario.getUsuario().equals(autenticacion.getName());

            if (rolDesactualizado || nombreDesactualizado) {
                UsernamePasswordAuthenticationToken renovada = UsernamePasswordAuthenticationToken.authenticated(
                        usuario.getUsuario(),
                        autenticacion.getCredentials(),
                        List.of(new SimpleGrantedAuthority(rolActual)));
                renovada.setDetails(autenticacion.getDetails());

                SecurityContext contexto = SecurityContextHolder.createEmptyContext();
                contexto.setAuthentication(renovada);
                SecurityContextHolder.setContext(contexto);
            }
        }

        cadena.doFilter(peticion, respuesta);
    }
}
