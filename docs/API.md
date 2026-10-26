# API REST de Semáforo+

Base URL local: `http://localhost:8080`

Todas las respuestas son **JSON UTF-8**. Los endpoints aceptan JSON y, en el caso
de la telemetría, también parámetros de formulario (`application/x-www-form-urlencoded`)
para que el ESP32 pueda enviar datos con un `POST` simple.

- [1. Estado](#1-estado)
- [2. Telemetría](#2-telemetría)
- [3. Control](#3-control)
- [4. Historial](#4-historial)
- [5. Estadísticas](#5-estadísticas)
- [6. Simulación](#6-simulación)
- [7. Salud](#7-salud)
- [8. Errores](#8-errores)
- [9. Resumen para el equipo de hardware](#9-resumen-para-el-equipo-de-hardware)

---

## 1. Estado

### `GET /api/estado`

Devuelve el estado actual del semáforo. Es lo que consulta la web cada segundo.

**Respuesta 200**

```json
{
  "conectado": true,
  "esp32Conectado": false,
  "origen": "SIMULADO",
  "dispositivo": "Semáforo Principal",
  "ubicacion": "Avenida Central",
  "color": "rojo",
  "distanciaCm": 108,
  "vehiculoDetectado": false,
  "modo": "automatico",
  "vehiculosDetectados": 12,
  "cambiosColor": 9,
  "ultimaLectura": "12:31:07",
  "alertas": 0,
  "camaraConectada": true,
  "totalLecturas": 436,
  "servidorHora": "12:31:08"
}
```

| Campo | Tipo | Significado |
|---|---|---|
| `conectado` | boolean | El backend está respondiendo |
| `esp32Conectado` | boolean | Llegó telemetría real en los últimos 10 s |
| `origen` | string | `ESP32` o `SIMULADO` |
| `color` | string | `rojo` \| `amarillo` \| `verde` |
| `distanciaCm` | int | Última distancia del HC-SR04 |
| `vehiculoDetectado` | boolean | Presencia detectada |
| `modo` | string | `automatico` \| `manual` |
| `vehiculosDetectados` | long | Contador acumulado desde el arranque |
| `cambiosColor` | long | Cambios de color acumulados |
| `alertas` | int | 1 si hay control manual con vehículo presente |
| `totalLecturas` | long | Filas guardadas en el historial |

---

## 2. Telemetría

### `POST /api/telemetria` (también `/api/lecturas`)

El ESP32 envía una lectura. **Todos los campos son opcionales**, pero debe venir
al menos uno.

**Cuerpo JSON**

```json
{
  "distanciaCm": 32,
  "vehiculoDetectado": true,
  "color": "verde",
  "modo": "automatico",
  "dispositivo": "Semáforo Principal"
}
```

**Formulario (ideal para Arduino)**

```http
POST /api/telemetria
Content-Type: application/x-www-form-urlencoded

distancia=32&vehiculo=1&color=verde&modo=automatico
```

**Alias aceptados**

| Concepto | Claves válidas |
|---|---|
| Distancia | `distancia`, `distanciaCm`, `distancia_cm`, `distance` |
| Vehículo | `vehiculo`, `vehiculoDetectado`, `vehiculo_detectado`, `vehicle`, `detectado` |
| Color | `color`, `semaforo`, `luz` |
| Modo | `modo`, `mode` |
| Dispositivo | `dispositivo`, `device` |

Booleanos aceptados: `1/0`, `true/false`, `si/no`, `on/off`, `yes/no`.

**Reglas del servidor**

- Si llega `distancia` sin `vehiculo`, el vehículo **no** se recalcula: solo se
  actualiza la distancia.
- Si llega `vehiculo` sin `color` y el modo es `automatico`, el servidor decide
  el color (`true → verde`, `false → rojo`).
- Si el modo es `manual`, el color solo cambia con un comando explícito.
- Cada llamada guarda una fila en el historial y marca el ESP32 como conectado.

**Respuesta 200:** el `EstadoDto` actualizado (mismo formato que `/api/estado`).

### `GET /api/telemetria?distancia=32&vehiculo=1`

Atajo para pruebas rápidas desde el navegador o `curl`. Mismo comportamiento.

---

## 3. Control

### `PUT /api/control/modo`

```json
{ "modo": "manual" }
```

También: `POST` no está soportado; usa `PUT`. Se admite `?modo=manual`.

**Respuesta 200:** `EstadoDto` con `modo` actualizado.

Al cambiar a `automatico` el color se recalcula según la detección actual y se
encola un comando para el ESP32.

### `PUT /api/control/color`

```json
{ "color": "rojo" }
```

**Solo funciona en modo manual.** En automático responde `400`:

```json
{
  "codigo": 400,
  "error": "Bad Request",
  "mensaje": "El control manual solo está disponible en modo manual.",
  "momento": "2026-10-26T12:40:11.512"
}
```

### `GET /api/control/pendiente`

El ESP32 lo consulta en su bucle.

- **200** con un comando pendiente:

```json
{
  "tipo": "color",
  "valor": "rojo",
  "emitidoEn": "2026-10-26 12:40:11"
}
```

- **204 No Content** si no hay nada.

`tipo` puede ser `modo` o `color`. La cola es FIFO y guarda como máximo 20
comandos (los más antiguos se descartan).

> Consumo destructivo: cada `GET` extrae el comando de la cola. Si dos clientes
> consultan a la vez, el comando lo recibe uno solo.

---

## 4. Historial

### `GET /api/historial?limite=50`

Devuelve las últimas lecturas, de la más reciente a la más antigua.
`limite` se acota entre 1 y 100 (por defecto 50).

```json
[
  {
    "id": 436,
    "momento": "2026-10-26 12:31:07",
    "distanciaCm": 108,
    "vehiculoDetectado": false,
    "color": "rojo",
    "modo": "automatico",
    "origen": "SIMULADO"
  }
]
```

### `DELETE /api/historial`

Borra todas las filas.

```json
{ "ok": true, "mensaje": "Historial eliminado." }
```

---

## 5. Estadísticas

### `GET /api/estadisticas?periodo=hoy`

Periodos: `hoy` (por defecto), `semana` (7 días), `mes` (30 días).

```json
{
  "periodo": "hoy",
  "etiqueta": "Hoy",
  "totalVehiculos": 24,
  "cambios": 11,
  "horaPico": "18:00",
  "esperaPromedioSegundos": 4,
  "tiempos": { "rojo": 46, "amarillo": 12, "verde": 42 },
  "porHora": [
    { "etiqueta": "05:00", "valor": 0 },
    { "etiqueta": "12:00", "valor": 7 }
  ],
  "semanal": [
    { "etiqueta": "Lun", "valor": 62 }
  ],
  "trafico": [
    { "zona": "Avenida Central", "nivel": "moderado", "porcentaje": 63 }
  ]
}
```

| Campo | Significado |
|---|---|
| `totalVehiculos` | Detecciones contadas en el periodo |
| `cambios` | Cambios de color en el periodo |
| `horaPico` | Hora con más detecciones (`HH:00`) |
| `esperaPromedioSegundos` | Detección → siguiente verde (máx. 60 s) |
| `tiempos` | Porcentaje de tiempo en cada color (suma 100) |
| `porHora` | Últimas 8 horas |
| `semanal` | Últimos 7 días |
| `trafico` | Nivel por zona: `normal`, `moderado`, `intenso`, `desconectado` |

---

## 6. Simulación

### `POST /api/simulacion/{accion}`

| Acción | Efecto |
|---|---|
| `acercar` | Fija 30 cm y vehículo detectado |
| `alejar` | Fija 120 cm y sin vehículo |
| `via-libre` | Igual que `alejar` |
| `restablecer` | Vuelve al estado inicial (rojo, 120 cm, automático) |

**Si el ESP32 está conectado responde `400`:**

```json
{
  "codigo": 400,
  "error": "Bad Request",
  "mensaje": "El ESP32 está conectado: la simulación está deshabilitada.",
  "momento": "2026-10-26T12:41:02.101"
}
```

Esto evita que la demo mezcle datos reales con datos falsos.

---

## 7. Salud

### `GET /api/salud`

```json
{
  "estado": "ok",
  "aplicacion": "Semáforo+",
  "version": "1.0.0",
  "uptimeSegundos": 312,
  "esp32Conectado": false
}
```

Útil para comprobar que el servidor está arriba antes de la exposición y para
diagnosticar si el ESP32 realmente está llegando.

---

## 8. Errores

Formato uniforme (`ApiExceptionHandler`):

```json
{
  "codigo": 400,
  "error": "Bad Request",
  "mensaje": "Color no válido: azul. Use rojo, amarillo o verde.",
  "momento": "2026-10-26T12:42:00.000"
}
```

| Código | Cuándo |
|---|---|
| `400` | Datos inválidos, JSON mal formado, regla de negocio incumplida |
| `404` | Recurso estático inexistente (por ejemplo `/favicon.ico`) |
| `500` | Error interno no controlado |

---

## 9. Resumen para el equipo de hardware

Lo mínimo que debe hacer el ESP32:

```
cada 1–2 segundos:
    1. medir distancia con el HC-SR04
    2. POST http://IP-PC:8080/api/telemetria
         cuerpo: distancia=<cm>&vehiculo=<1|0>&modo=<automatico|manual>
    3. GET http://IP-PC:8080/api/control/pendiente
         200 → aplicar tipo/valor a los LEDs
         204 → no hacer nada
```

Con eso el indicador de la web cambia a **ESP32 conectado** en menos de dos
segundos y el simulador del servidor se detiene solo.

### Prueba rápida desde PowerShell

```powershell
# Ver el estado
Invoke-RestMethod http://localhost:8080/api/estado | ConvertTo-Json

# Simular una lectura del ESP32
Invoke-RestMethod -Method Post `
  "http://localhost:8080/api/telemetria?distancia=25&vehiculo=1"

# Debe responder esp32Conectado = true
Invoke-RestMethod http://localhost:8080/api/salud | ConvertTo-Json

# Ver un comando pendiente
Invoke-RestMethod -Method Put http://localhost:8080/api/control/modo `
  -ContentType "application/json" -Body '{"modo":"manual"}'
Invoke-RestMethod http://localhost:8080/api/control/pendiente | ConvertTo-Json
```

### Prueba rápida desde curl

```bash
curl http://localhost:8080/api/estado

curl -X POST http://localhost:8080/api/telemetria \
  -H "Content-Type: application/json" \
  -d '{"distanciaCm":32,"vehiculoDetectado":true}'

curl -X PUT http://localhost:8080/api/control/color \
  -H "Content-Type: application/json" \
  -d '{"color":"rojo"}'
```
