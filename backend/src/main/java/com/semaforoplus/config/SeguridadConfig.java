package com.semaforoplus.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semaforoplus.repositorio.UsuarioRepository;
import com.semaforoplus.web.RespuestaErrorJson;
import org.springframework.boot.autoconfigure.security.servlet.PathRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;

/**
 * Configuración de seguridad de Semáforo+.
 *
 * <ul>
 *   <li>Login propio por JSON: {@code POST /api/auth/login}.</li>
 *   <li>Sesión del servidor con cookie {@code JSESSIONID} (HttpOnly).</li>
 *   <li>Contraseñas con BCrypt.</li>
 *   <li>Gestión de usuarios solo para el rol {@code SUPERADMIN}.</li>
 *   <li>ESP32 y página de salud abiertos, para que el dispositivo funcione
 *       sin iniciar sesión.</li>
 * </ul>
 */
@Configuration
@EnableWebSecurity
public class SeguridadConfig {

    @Bean
    public PasswordEncoder codificadorClaves() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityContextRepository repositorioContexto() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public AuthenticationManager gestorAutenticacion(AuthenticationConfiguration configuracion) throws Exception {
        return configuracion.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain cadenaSeguridad(HttpSecurity http,
                                               SecurityContextRepository repositorioContexto,
                                               UsuarioRepository usuarios,
                                               ObjectMapper objectMapper) throws Exception {

        http
                /* La API se consume desde la misma página y el ESP32 no usa cookies,
                   así que no hace falta CSRF. Ver docs/ARQUITECTURA.md. */
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.disable())

                /* Permite la consola H2 dentro de un marco de la misma web. */
                .headers(cabeceras -> cabeceras.frameOptions(marco -> marco.sameOrigin()))

                .securityContext(contexto -> contexto.securityContextRepository(repositorioContexto))
                .sessionManagement(sesion -> sesion.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))

                .authorizeHttpRequests(autorizacion -> autorizacion
                        /* Archivos de la interfaz web. */
                        .requestMatchers(PathRequest.toStaticResources().atCommonLocations()).permitAll()
                        .requestMatchers("/", "/index.html", "/error").permitAll()

                        /* Login, cierre y comprobación de sesión. */
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/yo").permitAll()

                        /* El dispositivo y la página de salud no necesitan sesión. */
                        .requestMatchers(HttpMethod.GET, "/api/salud").permitAll()
                        .requestMatchers("/api/telemetria", "/api/lecturas").permitAll()
                        .requestMatchers("/api/camara/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/control/pendiente").permitAll()

                        /* Consola de base de datos (solo para desarrollo local). */
                        .requestMatchers("/h2-console/**").permitAll()

                        /* Gestión de usuarios: exclusiva del superadministrador. */
                        .requestMatchers("/api/usuarios/**").hasRole("SUPERADMIN")

                        /* El resto de la API exige sesión iniciada. */
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll()
                )

                .exceptionHandling(errores -> errores
                        .authenticationEntryPoint((peticion, respuesta, excepcion) ->
                                RespuestaErrorJson.escribir(respuesta, objectMapper, HttpStatus.UNAUTHORIZED,
                                        "Debes iniciar sesión para usar esta función."))
                        .accessDeniedHandler((peticion, respuesta, excepcion) ->
                                RespuestaErrorJson.escribir(respuesta, objectMapper, HttpStatus.FORBIDDEN,
                                        "No tienes permiso para esta acción."))
                )

                /* El login y el logout los gestiona AuthController. */
                .formLogin(formulario -> formulario.disable())
                .httpBasic(basico -> basico.disable())
                .logout(salida -> salida.disable())

                .addFilterAfter(new FiltroUsuarioActivo(usuarios, objectMapper), SecurityContextHolderFilter.class);

        return http.build();
    }
}
