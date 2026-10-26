# API REST de Semáforo+

Base URL local: `http://localhost:8080`

Todas las respuestas son **JSON UTF-8**. Los endpoints aceptan JSON y, en el caso
de la telemetría, también parámetros de formulario (`application/x-www-form-urlencoded`)
para que el ESP32 pueda enviar datos con un `POST` simple.

> 🔐 La mayoría de rutas exige **sesión iniciada** (cookie `JSESSIONID`). El
> ESP32 no usa cookies: sus endpoints de telemetría y comandos quedan abiertos.
> La web hace el login con `fetch` y el navegador guarda la cookie sola.

- [Autenticación y sesión](#autenticación-y-sesión)
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

## Autenticación y sesión

| Ruta | Sesión | Rol necesario |
|---|---|---|
| `POST /api/auth/login` | No | — |
| `GET /api/auth/yo` | No | — |
| `POST /api/auth/logout` | No | — |
| `POST/PUT/DELETE /api/usuarios/**` | Sí | `SUPERADMIN` |
| `/api/estado`, `/api/historial`, `/api/estadisticas`, `/api/control/modo`, `/api/control/color`, `/api/simulacion/**` | Sí | Cualquiera |
| `/api/telemetria`, `/api/lecturas`, `/api/control/pendiente`, `/api/salud` | No | — |

### `POST /api/auth/login`

**Cuerpo**

```json
{ "usuario": "superadmin", "clave": "123456" }
```

**Respuesta 200** (y cabecera `Set-Cookie: JSESSIONID=...; HttpOnly`)

```json
{
  "id": 1,
  "nombre": "Super Usuario",
  "usuario": "superadmin",
  "rol": "Superadministrador",
  "rolCodigo": "SUPERADMIN",
  "activo": true,
  "ultimoAcceso": "26/10/2026 13:26"
}
```

**Errores**

| Código | Caso |
|---|---|
| `400` | Falta usuario o contraseña |
| `401` | Credenciales incorrectas o cuenta desactivada |

### `GET /api/auth/yo`

Devuelve la sesión actual al recargar la página.

- **200** con el mismo JSON del login.
- **204 No Content** si no hay sesión (así el navegador no muestra un error de
  red al abrir el login).

### `POST /api/auth/logout`

Invalida la sesión en el servidor.

```json
{ "ok": true, "mensaje": "Sesión cerrada." }
```

### Gestión de usuarios (`SUPERADMIN`)

- `GET /api/usuarios` — lista.
- `POST /api/usuarios` — crea. Cuerpo: `nombre`, `usuario`, `clave`, `rol`,
  `activo`.
- `PUT /api/usuarios/{id}` — edita; si `clave` va vacío se conserva la actual.
- `DELETE /api/usuarios/{id}` — elimina.

`rol` acepta `Administrador` / `Superadministrador` (o `ADMIN` / `SUPERADMIN`).
El backend **nunca devuelve la contraseña** y rechaza quedarse sin ningún
superadministrador activo.

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
| `401` | Sin sesión o credenciales incorrectas |
| `403` | Sesión válida pero sin el rol necesario (por ejemplo, un administrador en `/api/usuarios`) |
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
# 1. Iniciar sesión y guardar la cookie en $sesion
$cuerpo = '{"usuario":"superadmin","clave":"123456"}'
Invoke-RestMethod -Method Post http://localhost:8080/api/auth/login `
  -ContentType "application/json" -Body $cuerpo -SessionVariable sesion

# 2. Ver el estado (requiere sesión)
Invoke-RestMethod http://localhost:8080/api/estado -WebSession $sesion | ConvertTo-Json

# 3. Simular una lectura del ESP32 (no requiere sesión)
Invoke-RestMethod -Method Post `
  "http://localhost:8080/api/telemetria?distancia=25&vehiculo=1"

# 4. Debe responder esp32Conectado = true
Invoke-RestMethod http://localhost:8080/api/salud | ConvertTo-Json

# 5. Cambiar el modo y ver el comando pendiente
Invoke-RestMethod -Method Put http://localhost:8080/api/control/modo `
  -ContentType "application/json" -Body '{"modo":"manual"}' -WebSession $sesion
Invoke-RestMethod http://localhost:8080/api/control/pendiente | ConvertTo-Json
```

### Prueba rápida desde curl

```bash
# 1. Login: guarda la cookie en cookies.txt
curl -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"superadmin","clave":"123456"}'

# 2. Estado con la sesión
curl -b cookies.txt http://localhost:8080/api/estado

# 3. Telemetría (abierta para el ESP32)
curl -X POST http://localhost:8080/api/telemetria \
  -H "Content-Type: application/json" \
  -d '{"distanciaCm":32,"vehiculoDetectado":true}'

# 4. Control con la sesión
curl -b cookies.txt -X PUT http://localhost:8080/api/control/color \
  -H "Content-Type: application/json" \
  -d '{"color":"rojo"}'
```
