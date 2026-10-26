package com.semaforoplus.config;

import com.semaforoplus.modelo.Rol;
import com.semaforoplus.modelo.Usuario;
import com.semaforoplus.repositorio.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Crea las cuentas iniciales la primera vez que arranca el sistema.
 *
 * <p>La base H2 vive en memoria, así que al reiniciar se vuelven a crear. En
 * una instalación con base de datos permanente solo se crearían una vez.</p>
 */
@Component
public class InicializadorDatos implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(InicializadorDatos.class);

    private final UsuarioRepository repositorio;
    private final PasswordEncoder codificador;
    private final String claveInicial;

    public InicializadorDatos(UsuarioRepository repositorio,
                              PasswordEncoder codificador,
                              @Value("${semaforo.seguridad.clave-inicial:123456}") String claveInicial) {
        this.repositorio = repositorio;
        this.codificador = codificador;
        this.claveInicial = claveInicial;
    }

    @Override
    public void run(String... args) {
        if (repositorio.count() > 0) {
            log.info("Usuarios en base de datos: {}. No se crean cuentas nuevas.", repositorio.count());
            return;
        }

        repositorio.save(new Usuario("Super Usuario", "superadmin",
                codificador.encode(claveInicial), Rol.SUPERADMIN, true));
        repositorio.save(new Usuario("Administrador General", "admin",
                codificador.encode(claveInicial), Rol.ADMIN, true));

        log.info("Cuentas iniciales creadas: superadmin y admin. "
                + "La contraseña se configura en semaforo.seguridad.clave-inicial.");
    }
}
