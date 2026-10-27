package com.semaforoplus.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/camara")
@CrossOrigin(origins = "*")
public class CamaraController {

    private static volatile byte[] ultimoFrame = null;
    private static final AtomicLong timestampUltimoFrame = new AtomicLong(0);
    private static final CopyOnWriteArrayList<ResponseBodyEmitter> subscriptores = new CopyOnWriteArrayList<>();

    /**
     * Endpoint donde el ESP32-CAM sube cada imagen en formato JPEG.
     */
    @PostMapping(value = "/frame", consumes = {MediaType.IMAGE_JPEG_VALUE, MediaType.APPLICATION_OCTET_STREAM_VALUE, "*/*"})
    public ResponseEntity<Map<String, Object>> recibirFrame(@RequestBody byte[] frameBytes) {
        if (frameBytes == null || frameBytes.length == 0) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "Frame vacío"));
        }

        ultimoFrame = frameBytes;
        timestampUltimoFrame.set(System.currentTimeMillis());

        // Notificar a clientes del stream MJPEG
        for (ResponseBodyEmitter emitter : subscriptores) {
            try {
                emitter.send("--boundary\r\nContent-Type: image/jpeg\r\nContent-Length: " 
                        + frameBytes.length + "\r\n\r\n");
                emitter.send(frameBytes);
                emitter.send("\r\n");
            } catch (Exception e) {
                subscriptores.remove(emitter);
            }
        }

        return ResponseEntity.ok(Map.of("ok", true, "bytes", frameBytes.length));
    }

    /**
     * Devuelve el último frame JPEG individual (útil para snapshots o refresh).
     */
    @GetMapping(value = "/foto", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> obtenerUltimaFoto() {
        byte[] frame = ultimoFrame;
        if (frame == null) {
            return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setCacheControl("no-cache, no-store, must-revalidate");
        headers.setPragma("no-cache");
        headers.setExpires(0);
        return new ResponseEntity<>(frame, headers, HttpStatus.OK);
    }

    /**
     * Transmisión continua MJPEG para poner directamente en <img src="/api/camara/stream">
     */
    @GetMapping(value = "/stream")
    public ResponseEntity<ResponseBodyEmitter> streamMjpeg() {
        ResponseBodyEmitter emitter = new ResponseBodyEmitter(Duration.ofHours(6).toMillis());
        subscriptores.add(emitter);

        emitter.onCompletion(() -> subscriptores.remove(emitter));
        emitter.onTimeout(() -> subscriptores.remove(emitter));
        emitter.onError(e -> subscriptores.remove(emitter));

        HttpHeaders headers = new HttpHeaders();
        headers.set("Content-Type", "multipart/x-mixed-replace; boundary=boundary");
        headers.setCacheControl("no-cache, private");

        byte[] frame = ultimoFrame;
        if (frame != null) {
            try {
                emitter.send("--boundary\r\nContent-Type: image/jpeg\r\nContent-Length: " 
                        + frame.length + "\r\n\r\n");
                emitter.send(frame);
                emitter.send("\r\n");
            } catch (Exception ignored) {}
        }

        return new ResponseEntity<>(emitter, headers, HttpStatus.OK);
    }

    /**
     * Estado de la cámara (si ha enviado frames en los últimos 6 segundos).
     */
    @GetMapping("/estado")
    public Map<String, Object> estadoCamara() {
        long ahora = System.currentTimeMillis();
        long diff = ahora - timestampUltimoFrame.get();
        boolean conectada = ultimoFrame != null && diff < 6000;

        return Map.of(
            "conectada", conectada,
            "ultimaActividadMs", diff,
            "tamanoUltimoFrame", ultimoFrame != null ? ultimoFrame.length : 0,
            "espectadores", subscriptores.size()
        );
    }
}
