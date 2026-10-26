package com.semaforoplus.servicio;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Genera telemetría simulada cuando no hay un ESP32 enviando datos.
 *
 * <p>Así la web, el historial y las estadísticas siguen funcionando sin
 * hardware. En cuanto llega una lectura real, el simulador se detiene solo.</p>
 */
@Component
public class SimuladorSemaforo {

    private final SemaforoService semaforo;
    private final boolean activo;

    public SimuladorSemaforo(SemaforoService semaforo,
                             @Value("${semaforo.simulador.activo:true}") boolean activo) {
        this.semaforo = semaforo;
        this.activo = activo;
    }

    @Scheduled(fixedDelayString = "${semaforo.simulador.intervalo-ms:2000}")
    public void tick() {
        if (!activo) {
            return;
        }
        semaforo.pasoSimulador();
    }
}
