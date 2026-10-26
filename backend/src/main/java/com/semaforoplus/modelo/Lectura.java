package com.semaforoplus.modelo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Una lectura del sensor enviada por el ESP32 (o generada por el simulador).
 *
 * <p>Cada fila representa una muestra de telemetría: distancia medida por el
 * HC-SR04, si hay un vehículo detectado, el color del semáforo y el modo de
 * operación en ese instante.</p>
 */
@Entity
@Table(name = "lecturas", indexes = {
        @Index(name = "idx_lecturas_momento", columnList = "momento")
})
public class Lectura {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime momento;

    @Column(nullable = false)
    private int distanciaCm;

    @Column(nullable = false)
    private boolean vehiculoDetectado;

    @Column(nullable = false, length = 12)
    private String color;

    @Column(nullable = false, length = 12)
    private String modo;

    /** Origen de la muestra: {@code ESP32} o {@code SIMULADO}. */
    @Column(nullable = false, length = 12)
    private String origen;

    @Column(nullable = false, length = 80)
    private String dispositivo;

    protected Lectura() {
        // Requerido por JPA.
    }

    public Lectura(LocalDateTime momento,
                   int distanciaCm,
                   boolean vehiculoDetectado,
                   String color,
                   String modo,
                   String origen,
                   String dispositivo) {
        this.momento = momento;
        this.distanciaCm = distanciaCm;
        this.vehiculoDetectado = vehiculoDetectado;
        this.color = color;
        this.modo = modo;
        this.origen = origen;
        this.dispositivo = dispositivo;
    }

    public Long getId() {
        return id;
    }

    public LocalDateTime getMomento() {
        return momento;
    }

    public int getDistanciaCm() {
        return distanciaCm;
    }

    public boolean isVehiculoDetectado() {
        return vehiculoDetectado;
    }

    public String getColor() {
        return color;
    }

    public String getModo() {
        return modo;
    }

    public String getOrigen() {
        return origen;
    }

    public String getDispositivo() {
        return dispositivo;
    }
}
