package com.semaforoplus.servicio;

import com.semaforoplus.modelo.Rol;
import com.semaforoplus.modelo.Usuario;
import com.semaforoplus.repositorio.UsuarioRepository;
import com.semaforoplus.web.dto.UsuarioDto;
import com.semaforoplus.web.dto.UsuarioRequest;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Usuarios del sistema: login (Spring Security) y gestión desde la web.
 *
 * <p>Las contraseñas se guardan siempre con hash BCrypt: la clave en claro
 * nunca se almacena ni se devuelve en las respuestas JSON.</p>
 */
@Service
@Transactional
public class UsuarioService implements UserDetailsService {

    private static final Pattern USUARIO_VALIDO = Pattern.compile("^[a-zA-Z0-9._-]{3,40}$");
    private static final int CLAVE_MINIMA = 6;
    private static final int CLAVE_MAXIMA = 60;

    private final UsuarioRepository repositorio;
    private final PasswordEncoder codificador;

    public UsuarioService(UsuarioRepository repositorio, PasswordEncoder codificador) {
        this.repositorio = repositorio;
        this.codificador = codificador;
    }

    /* ============================ Login ================================ */

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String nombreUsuario) throws UsernameNotFoundException {
        Usuario usuario = buscarPorUsuario(nombreUsuario)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado."));

        return User.withUsername(usuario.getUsuario())
                .password(usuario.getClaveHash())
                .roles(usuario.getRol().name())
                .disabled(!usuario.isActivo())
                .build();
    }

    /** Guarda la fecha del último acceso correcto. */
    public Usuario registrarAcceso(String nombreUsuario) {
        Usuario usuario = buscarPorUsuario(nombreUsuario)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado."));
        usuario.setUltimoAcceso(LocalDateTime.now());
        return usuario;
    }

    @Transactional(readOnly = true)
    public Optional<Usuario> buscarPorUsuario(String nombreUsuario) {
        if (nombreUsuario == null || nombreUsuario.isBlank()) {
            return Optional.empty();
        }
        return repositorio.findByUsuarioIgnoreCase(nombreUsuario.trim());
    }

    /* ======================= Gestión de usuarios ======================= */

    @Transactional(readOnly = true)
    public List<UsuarioDto> listar() {
        return repositorio.findAllByOrderByIdAsc().stream()
                .map(UsuarioDto::desde)
                .toList();
    }

    @Transactional(readOnly = true)
    public UsuarioDto buscar(Long id) {
        return UsuarioDto.desde(obtener(id));
    }

    public UsuarioDto crear(UsuarioRequest peticion) {
        if (peticion == null) {
            throw new DatosInvalidosException("Faltan los datos del usuario.");
        }

        String nombre = textoObligatorio(peticion.nombre(), "El nombre es obligatorio.");
        if (nombre.length() > 80) {
            throw new DatosInvalidosException("El nombre no puede superar los 80 caracteres.");
        }

        String nombreUsuario = textoObligatorio(peticion.usuario(), "El nombre de acceso es obligatorio.");
        validarNombreUsuario(nombreUsuario);
        if (repositorio.existsByUsuarioIgnoreCase(nombreUsuario)) {
            throw new DatosInvalidosException("Ese nombre de acceso ya está en uso.");
        }

        String clave = textoObligatorio(peticion.clave(), "La contraseña es obligatoria.");
        validarClave(clave);

        Rol rol = Rol.desde(peticion.rol());
        boolean activo = peticion.activo() == null || peticion.activo();

        Usuario usuario = new Usuario(nombre, nombreUsuario, codificador.encode(clave), rol, activo);
        return UsuarioDto.desde(repositorio.save(usuario));
    }

    public UsuarioDto actualizar(Long id, UsuarioRequest peticion) {
        if (peticion == null) {
            throw new DatosInvalidosException("Faltan los datos del usuario.");
        }

        Usuario usuario = obtener(id);

        String nombre = textoObligatorio(peticion.nombre(), "El nombre es obligatorio.");
        if (nombre.length() > 80) {
            throw new DatosInvalidosException("El nombre no puede superar los 80 caracteres.");
        }

        String nombreUsuario = textoObligatorio(peticion.usuario(), "El nombre de acceso es obligatorio.");
        validarNombreUsuario(nombreUsuario);
        if (repositorio.existsByUsuarioIgnoreCaseAndIdNot(nombreUsuario, id)) {
            throw new DatosInvalidosException("Ese nombre de acceso ya está en uso.");
        }

        Rol rol = Rol.desde(peticion.rol());
        boolean activo = peticion.activo() == null ? usuario.isActivo() : peticion.activo();

        /* No se puede dejar el sistema sin ningún superadministrador activo. */
        boolean eraSuperActivo = usuario.getRol() == Rol.SUPERADMIN && usuario.isActivo();
        boolean seraSuperActivo = rol == Rol.SUPERADMIN && activo;
        if (eraSuperActivo && !seraSuperActivo && repositorio.countByRolAndActivoTrue(Rol.SUPERADMIN) <= 1) {
            throw new DatosInvalidosException(
                    "Debe quedar al menos un superadministrador activo.");
        }

        usuario.setNombre(nombre);
        usuario.setUsuario(nombreUsuario);
        usuario.setRol(rol);
        usuario.setActivo(activo);

        if (peticion.clave() != null && !peticion.clave().isBlank()) {
            validarClave(peticion.clave());
            usuario.setClaveHash(codificador.encode(peticion.clave()));
        }

        return UsuarioDto.desde(usuario);
    }

    public void eliminar(Long id) {
        Usuario usuario = obtener(id);

        if (usuario.getRol() == Rol.SUPERADMIN && usuario.isActivo()
                && repositorio.countByRolAndActivoTrue(Rol.SUPERADMIN) <= 1) {
            throw new DatosInvalidosException(
                    "No se puede eliminar el último superadministrador activo.");
        }

        repositorio.delete(usuario);
    }

    /* ========================== Utilidades ============================= */

    private Usuario obtener(Long id) {
        if (id == null) {
            throw new DatosInvalidosException("Falta el identificador del usuario.");
        }
        return repositorio.findById(id)
                .orElseThrow(() -> new DatosInvalidosException("El usuario no existe."));
    }

    private void validarNombreUsuario(String nombreUsuario) {
        if (!USUARIO_VALIDO.matcher(nombreUsuario).matches()) {
            throw new DatosInvalidosException(
                    "El nombre de acceso debe tener entre 3 y 40 caracteres (letras, números, . _ -).");
        }
    }

    private void validarClave(String clave) {
        if (clave.length() < CLAVE_MINIMA) {
            throw new DatosInvalidosException(
                    "La contraseña debe tener al menos " + CLAVE_MINIMA + " caracteres.");
        }
        if (clave.length() > CLAVE_MAXIMA) {
            throw new DatosInvalidosException(
                    "La contraseña no puede superar los " + CLAVE_MAXIMA + " caracteres.");
        }
    }

    private String textoObligatorio(String valor, String mensaje) {
        if (valor == null || valor.isBlank()) {
            throw new DatosInvalidosException(mensaje);
        }
        return valor.trim();
    }
}
