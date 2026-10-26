# Arquitectura de Semáforo+

Documento de referencia para la exposición y para que tus compañeros entiendan
dónde tocar cada cosa.

---

## 1. Vista general

El sistema es una aplicación **cliente-servidor** con un **monolito Spring Boot
en capas**. Un solo proceso Java sirve la interfaz web **y** la API REST, y se
apoya en una base de datos H2. El ESP32 es un cliente más: consume la misma API.

```
┌────────────────────────┐        HTTP / JSON        ┌─────────────────────────────────┐
│  NAVEGADOR             │  ──────────────────────►  │  BACKEND SPRING BOOT (:8080)    │
│                        │                           │  Tomcat embebido                │
│  index.html            │  GET  /api/estado         │                                 │
│  estilos.css           │  PUT  /api/control/*      │  Controller → Service → Repo    │
│  app.js      (vistas)  │  POST /api/simulacion     │                                 │
│  conexion.js (polling)  │  GET  /api/estadisticas   │                                 │
└────────────────────────┘  ◄──────────────────────  └───────────────┬─────────────────┘
                                                                      │ JPA / Hibernate
┌────────────────────────┐        HTTP / JSON                          ▼
│  ESP32                 │  ──────────────────────►          ┌──────────────────┐
│  HC-SR04 + 3 LEDs      │  POST /api/telemetria             │  H2 (en memoria) │
│  (hardware del equipo) │  GET  /api/control/pendiente      │  tabla lecturas  │
└────────────────────────┘                                   └──────────────────┘
```

**¿Por qué un monolito y no microservicios?** Porque el dominio es pequeño, se
despliega en un solo equipo y se presenta en una sola demo. Un monolito en
capas es más fácil de explicar, de ejecutar y de mantener. La separación por
capas ya deja la puerta abierta a extraer módulos (por ejemplo el de
estadísticas) si algún día crece.

---

## 2. Capas del backend

| Capa | Paquete | Clases | Responsabilidad |
|---|---|---|---|
| Arranque | `com.semaforoplus` | `SemaforoPlusApplication` | Configura Spring, habilita `@Scheduled` |
| Presentación | `web` | `ApiController`, `ApiExceptionHandler` | HTTP, validación de entrada, formato de errores |
| Contratos | `web.dto` | `EstadoDto`, `TelemetriaRequest`, `LecturaDto`, `EstadisticasDto`, `ComandoDto`, `SerieDto`, `TraficoDto` | Forma de los datos que viajan por la API |
| Negocio | `servicio` | `SemaforoService`, `EstadisticasService`, `SimuladorSemaforo` | Estado del semáforo, detecciones, comandos, cálculo de estadísticas, simulación |
| Persistencia | `repositorio` | `LecturaRepository` | Consultas JPA sobre el historial |
| Modelo | `modelo` | `Lectura` | Entidad JPA (tabla `lecturas`) |
| Configuración | `resources` | `application.yml` | Puerto, datasource, parámetros del simulador |

**Regla que se respeta en todo el código:** el controlador no tiene lógica de
negocio; el servicio no conoce HTTP; el repositorio no conoce reglas.

### Flujo de una lectura (ESP32 → pantalla)

```
1. ESP32  ── POST /api/telemetria {distancia:32, vehiculo:true} ──►  ApiController
2. ApiController normaliza el JSON o los parámetros y arma TelemetriaRequest
3. SemaforoService.registrar(...)
     ├─ actualiza distancia, detección, modo y color
     ├─ cuenta flanco de detección  → vehiculosDetectados++
     ├─ cuenta cambio de color      → cambiosColor++
     ├─ marca ultimaTelemetriaReal = ahora  (apaga el simulador)
     └─ guarda una fila en la tabla lecturas
4. Devuelve EstadoDto con el estado ya actualizado
5. conexion.js (navegador) hace polling de /api/estado cada 1 s y repinta
```

### Flujo de un comando (pantalla → ESP32)

```
1. Usuario pulsa "Manual" o "Rojo"
2. conexion.js ── PUT /api/control/modo o /api/control/color ──► ApiController
3. SemaforoService cambia el estado y encola un ComandoDto (máx. 20, FIFO)
4. El ESP32 consulta GET /api/control/pendiente en su bucle
     ├─ 200 → ejecuta el comando (enciende el LED que toca)
     └─ 204 → no hay nada pendiente
```

El estado se guarda **en memoria** (campos del servicio) y **cada cambio se
persiste** como una fila nueva del historial. Así el estado actual es siempre
instantáneo y el histórico es auditable.

---

## 3. Simulador de respaldo

`SimuladorSemaforo` es un `@Component` con `@Scheduled(fixedDelay=2000 ms)`.

```
cada 2 s:
   si el ESP32 envió telemetría hace menos de 10 s  →  no hace nada
   si no                                          →  genera una lectura simulada
```

- La distancia evoluciona con un paseo aleatorio acotado a 15–160 cm.
- Si se acerca a menos de 38 cm aparece un "vehículo".
- En automático el color sigue a la detección, pasando por amarillo.
- **Toda lectura simulada también se guarda** en H2, marcada con
  `origen = SIMULADO`.

Consecuencia práctica: la demo funciona con o sin hardware, y el indicador de la
web dice honestamente de dónde vienen los datos.

---

## 4. Persistencia

Entidad única `Lectura`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `Long` | Autogenerado |
| `momento` | `LocalDateTime` | Índice `idx_lecturas_momento` |
| `distanciaCm` | `int` | 0–1000 validado |
| `vehiculoDetectado` | `boolean` | Estado del sensor |
| `color` | `String(12)` | `rojo` \| `amarillo` \| `verde` |
| `modo` | `String(12)` | `automatico` \| `manual` |
| `origen` | `String(12)` | `ESP32` \| `SIMULADO` |
| `dispositivo` | `String(80)` | Nombre configurado |

**Retención:** una tarea `@Scheduled(fixedDelay=60 s)` borra los registros más
antiguos cuando se superan `semaforo.historial.max-registros` (20 000 por
defecto). Así la demo puede correr horas sin llenar la memoria.

**H2 en memoria** se reinicia al apagar. Para conservar datos entre reinicios:

```yaml
spring:
  datasource:
    url: jdbc:h2:file:./datos/semaforoplus
```

`datos/` ya está en `.gitignore`.

---

## 5. Estadísticas

`EstadisticasService` **no inventa números**: recorre las lecturas del periodo
(`hoy`, `semana`, `mes`) y calcula:

| Indicador | Cómo se obtiene |
|---|---|
| `totalVehiculos` | Flancos de subida de `vehiculoDetectado` |
| `cambios` | Comparación de `color` entre lecturas consecutivas |
| `tiempos` | Porcentaje de segundos en rojo / amarillo / verde (Δt acotado a 10 s) |
| `porHora` | Detecciones agrupadas en las últimas 8 horas |
| `semanal` | Detecciones por día en los últimos 7 días |
| `horaPico` | Hora con más detecciones |
| `esperaPromedioSegundos` | Desde cada detección hasta la siguiente lectura en verde (máx. 60 s) |
| `trafico` | Nivel por zona derivado del volumen del periodo |

Si todavía no hay historial suficiente (menos de 10 lecturas), `conexion.js`
mantiene los datos base del prototipo para que la pantalla no se vea vacía en el
primer arranque. En cuanto hay historial, la etiqueta cambia a
**Historial real · hoy**.

---

## 6. Frontend

- **SPA sin framework**: `app.js` guarda el estado en `estadoAplicacion` y tiene
  funciones de render (`actualizarSemaforo`, `actualizarDashboard`, …). Al
  navegar solo se ocultan/muestran secciones.
- **`conexion.js`** es la única pieza nueva. Se carga después de `app.js` y:
  - envuelve `cambiarModo`, `cambiarColor` y las funciones de simulación para
    enviar la acción al backend;
  - hace polling de `/api/estado` cada 1 s;
  - sobrescribe `renderizarEstadisticas` para pedir los datos reales;
  - si el backend no responde, **restaura el comportamiento local** y avisa con
    un toast.
- **Degradación elegante**: abrir `index.html` con doble clic (sin servidor)
  sigue funcionando con la simulación original del navegador.

---

## 7. Decisiones y justificación

| Decisión | Motivo |
|---|---|
| Spring Boot 3.5.6 + Java 21 | Es lo pedido (`Spring Web` + `Java`) y Java 21 ya está instalado |
| Monolito en capas | Tamaño del proyecto y facilidad de exposición |
| REST + JSON | Contrato simple y universal para web y ESP32 |
| Polling de 1 s | Suficiente, sin infraestructura extra; SSE/WebSocket queda como mejora |
| H2 en memoria | Cero instalación para la demo; migrable a MariaDB cambiando el datasource |
| Simulador en servidor | La demo nunca se cae por falta de hardware |
| `conexion.js` separado | No se modifica la lógica original de `app.js` |
| Sin Machine Learning | Un solo sensor de distancia no aporta datos suficientes; ver §9 |

---

## 8. Escalabilidad (qué cambiaría si creciera)

1. **Base de datos**: MariaDB/PostgreSQL + Flyway para versionar el esquema.
2. **Tiempo real**: SSE (`SseEmitter`) o WebSocket en lugar de polling.
3. **Varios semáforos**: añadir entidad `Dispositivo` y claves foráneas; el DTO
   pasaría a devolver una lista.
4. **IoT real**: MQTT (Mosquitto) para que los ESP32 publiquen en un broker en
   vez de hacer HTTP directo; permite miles de dispositivos.
5. **Seguridad**: Spring Security con JWT, roles `SUPERADMIN` / `ADMIN`, y API
   keys por dispositivo.
6. **Observabilidad**: Actuator + Micrometer + Prometheus.
7. **Despliegue**: Docker Compose (app + MariaDB) y CI/CD a Render/Railway.

---

## 9. Sobre Machine Learning (para la exposición)

El sistema **no usa ML** y es una decisión técnica defendible:

- Un HC-SR04 entrega **una distancia** cada segundo. Con esa señal no hay
  variables suficientes para entrenar un modelo útil.
- Las reglas actuales (umbral de distancia + temporización) son **explicables,
  deterministas y verificables** en la demo.

Lo que sí hace el proyecto y **sí es "inteligencia" aplicada** es **control
adaptativo**: el tiempo de verde depende de la presencia real de vehículos y no
de un ciclo fijo.

Si en el futuro se pide ML, el camino correcto sería:

```
H2/MariaDB  →  exportar histórico  →  scikit-learn (árbol de decisión)
            →  microservicio FastAPI POST /predecir  →  Java lo consulta
            →  si el servicio falla, se usan las reglas actuales
```

Se documenta como **módulo opcional**, no como parte de lo entregado.

---

## 10. Limitaciones conocidas

- Login simulado en el navegador (`localStorage`), sin autenticación real.
- H2 en memoria: el historial se pierde al apagar.
- Cámara y mapa son simulaciones visuales (CSS), no hardware ni APIs externas.
- Comunicación por polling, no push.
- La API no tiene autenticación: debe usarse en una red de confianza (aula).
- El firmware asume un único semáforo y un único sensor.
