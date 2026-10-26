package com.semaforoplus;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Punto de entrada del backend de Semáforo+.
 *
 * <p>Sirve la interfaz web (carpeta {@code static}) y expone la API REST que
 * usa el ESP32 para enviar telemetría y el navegador para consultar el estado,
 * el historial y las estadísticas.</p>
 */
@SpringBootApplication
@EnableScheduling
public class SemaforoPlusApplication {

    public static void main(String[] args) {
        SpringApplication.run(SemaforoPlusApplication.class, args);
    }
}
