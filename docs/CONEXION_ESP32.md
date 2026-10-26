# Conexión del ESP32 con Semáforo+

Guía para el equipo de hardware. Al final del documento el ESP32 debe estar
enviando datos reales y la web debe mostrar **ESP32 conectado**.

---

## 1. Materiales

| Componente | Cantidad | Nota |
|---|---|---|
| ESP32 DevKit (WROOM-32) | 1 | Con WiFi de 2.4 GHz |
| Sensor ultrasónico HC-SR04 | 1 | Mide 2–400 cm |
| LED rojo, amarillo, verde | 1 c/u | 5 mm |
| Resistencias 220 Ω | 3 | Una por LED |
| Cables dupont | ~10 | Macho-macho / macho-hembra |
| Protoboard | 1 | Opcional pero recomendado |

> ⚠️ El HC-SR04 trabaja a **5 V**. La salida `ECHO` entrega 5 V y el ESP32 tolera
> 3.3 V. Funciona en la práctica en protoboard, pero lo correcto es poner un
> divisor de tensión (1 kΩ + 2 kΩ) o un level shifter en `ECHO`. Si el profesor
> es exigente con el hardware, menciónalo: suma puntos.

---

## 2. Cableado

### HC-SR04

| HC-SR04 | ESP32 | Nota |
|---|---|---|
| VCC | `VIN` (5 V) | **No** a 3V3 |
| TRIG | GPIO 5 | Salida de trigger |
| ECHO | GPIO 18 | Entrada (ideal con divisor) |
| GND | GND | Tierra común |

### LEDs

| LED | ESP32 | Resistencia |
|---|---|---|
| Rojo | GPIO 25 | 220 Ω a GND |
| Amarillo | GPIO 26 | 220 Ω a GND |
| Verde | GPIO 27 | 220 Ω a GND |

Cada LED: `GPIO → resistencia → ánodo (pata larga) → cátodo → GND`.

```
                 ESP32
            ┌──────────────┐
   5V ──────┤ VIN      GND ├────── GND común
            │              │
   HC-SR04  │              │
   VCC ─────┤ VIN          │
   TRIG ────┤ GPIO5        │
   ECHO ────┤ GPIO18       │
   GND ─────┤ GND          │
            │              │
   LED rojo │ GPIO25 ──[220Ω]──▶|── GND
   LED amar.│ GPIO26 ──[220Ω]──▶|── GND
   LED verde│ GPIO27 ──[220Ω]──▶|── GND
            └──────────────┘
```

Si tu placa usa otros pines, cambia solo las constantes al inicio del `.ino`.

---

## 3. Preparar el entorno

1. Instala **Arduino IDE 2.x**.
2. **File → Preferences → Additional boards manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Tools → Board → Boards Manager** → busca `esp32` → instala **esp32 by Espressif**.
4. **Tools → Manage Libraries** → instala **ArduinoJson** (versión 7.x).
5. Selecciona **Tools → Board → ESP32 Dev Module** y el puerto COM correcto.

> Si no aparece el puerto, instala el driver **CP210x** o **CH340** según tu placa.

---

## 4. Datos que necesitas antes de cargar el código

### 4.1 La IP de tu PC

```powershell
ipconfig
```

Busca el adaptador WiFi y anota la **IPv4**, por ejemplo `192.168.1.50`.

> ⚠️ La IP cambia si te reconectas a otra red. Si vas a exponer, pide al router
> una IP fija o revisa `ipconfig` la mañana de la presentación.

### 4.2 La red WiFi

El ESP32 **solo funciona en 2.4 GHz**. Si tu router tiene una sola red con el
mismo nombre para 2.4 y 5 GHz, normalmente funciona; si tiene dos nombres,
elige el que diga `2.4`.

> El WiFi del aula suele tener portal cautivo o aislamiento de clientes y **no
> deja que el ESP32 hable con tu PC**. Plan B: usa el hotspot del celular y
> conecta la PC a ese hotspot.

### 4.3 Abrir el puerto 8080 en el Firewall

En PowerShell **como Administrador**:

```powershell
New-NetFirewallRule -DisplayName "Semaforo+ 8080" `
  -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

Para comprobarlo:

```powershell
Get-NetFirewallRule -DisplayName "Semaforo+ 8080"
```

---

## 5. Cargar el firmware

1. Abre `firmware/esp32_semaforo.ino` en Arduino IDE.
2. Edita el bloque de configuración:

```cpp
const char* WIFI_SSID     = "TU_WIFI";
const char* WIFI_PASSWORD = "TU_CLAVE";
const char* SERVIDOR      = "http://192.168.1.50:8080";
```

3. Verifica que el backend esté corriendo:

```powershell
cd "D:\semaforo+\backend"
mvn spring-boot:run
```

4. Pulsa **Upload** y luego abre el **Serial Monitor** a **115200 baudios**.

Deberías ver algo así:

```
[WiFi] Conectando a TU_WIFI .....
[WiFi] Conectado. IP: 192.168.1.77
[HTTP] POST 200 -> {"color":"verde","distanciaCm":34,...}
```

---

## 6. Verificar que llegó al servidor

```powershell
Invoke-RestMethod http://localhost:8080/api/salud | ConvertTo-Json
```

Debe mostrar `esp32Conectado: true`.

En la web, el indicador de la cabecera cambia de **Simulación del servidor** a
**ESP32 conectado**, y el pie de página dice *telemetría real del ESP32*.

> El servidor considera al ESP32 conectado si recibió telemetría en los últimos
> **10 segundos** (`semaforo.simulador.silencio-real-ms`). Si lo apagas, en 10 s
> vuelve el simulador y la web no se rompe.

---

## 7. Probar sin hardware

Si el ESP32 todavía no está listo, cualquier PC con Python puede hacer de ESP32:

```powershell
python tools/simulador_esp32.py --servidor http://localhost:8080
```

Opciones útiles:

```powershell
# Cambiar el intervalo entre lecturas
python tools/simulador_esp32.py --intervalo 2

# Apuntar a otra PC de la red
python tools/simulador_esp32.py --servidor http://192.168.1.50:8080

# Ver los comandos que llegan desde la web
python tools/simulador_esp32.py --ver-comandos
```

El script usa solo la librería estándar: **no requiere instalar nada**.

---

## 8. Cómo funciona la comunicación

```
ESP32                                       Spring Boot
  │                                              │
  │  POST /api/telemetria                        │
  │  distancia=34&vehiculo=1&modo=automatico     │
  ├─────────────────────────────────────────────►│
  │◄──────────── EstadoDto (200) ────────────────┤
  │                                              │
  │  GET /api/control/pendiente                  │
  ├─────────────────────────────────────────────►│
  │◄──── 200 {"tipo":"color","valor":"rojo"} ────┤
  │      o 204 sin contenido                     │
  │                                              │
```

- El ESP32 **empuja** telemetría cada 1 s (configurable).
- El ESP32 **consulta** comandos en el mismo bucle.
- La web solo habla con el backend; nunca con el ESP32.

### Detección de vehículo en el firmware

```cpp
bool vehiculo = distancia > 0 && distancia < 40;
```

40 cm es el umbral por defecto. Si tu maqueta es más grande o más chica,
ajusta `UMBRAL_VEHICULO` en el `.ino`. La web refleja el valor que mande el
ESP32, no lo recalcula.

### Modo automático en el firmware

```
vehículo detectado  →  verde
sin vehículo        →  rojo (pasando 700 ms por amarillo)
```

El modo `manual` solo cambia el color cuando el backend envía un comando.

---

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El monitor serie no muestra nada | Baud rate incorrecto o placa mal seleccionada | Pon 115200 y revisa Board/Port |
| Se reinicia en bucle | Consumo alto o fuente débil | Alimenta por USB de PC, no por hub |
| `[WiFi] ...` y nunca conecta | Red de 5 GHz o clave incorrecta | Usa red 2.4 GHz y revisa la clave |
| WiFi conecta pero `POST` falla con `-1` | IP mal, firewall o backend apagado | `ipconfig`, regla de firewall, `mvn spring-boot:run` |
| `POST` responde 400 | Datos fuera de rango o JSON inválido | Revisa `distancia` (0–1000) y el formato |
| La web sigue en "Simulación del servidor" | La telemetría no llega o llega con más de 10 s de retraso | `GET /api/salud`, revisa el Serial Monitor |
| El LED no enciende | Pin equivocado o LED al revés | Pata larga al GPIO vía resistencia |
| Distancias siempre 0 | `ECHO` sin conexión o sin divisor | Revisa cableado y `pulseIn` |
| Funciona en el celular pero no en el ESP32 | Aislamiento de clientes en el router | Usa hotspot del celular |

### Comandos de diagnóstico

```powershell
# ¿El servidor está arriba?
Invoke-RestMethod http://localhost:8080/api/salud | ConvertTo-Json

# ¿Llega telemetría? (ejecuta esto y mira si esp32Conectado cambia)
Invoke-RestMethod http://localhost:8080/api/estado | ConvertTo-Json

# ¿El puerto 8080 escucha?
Get-NetTCPConnection -LocalPort 8080 -State Listen

# ¿El firewall permite?
Get-NetFirewallRule -DisplayName "Semaforo+ 8080" | Select-Object DisplayName, Enabled, Direction, Action
```

---

## 10. Checklist para la exposición

- [ ] Backend compilado y arrancado (`mvn spring-boot:run`).
- [ ] Web abierta en `http://localhost:8080` y login correcto.
- [ ] ESP32 cargado y con LED de encendido.
- [ ] Serial Monitor mostrando `POST 200`.
- [ ] Indicador de la web en **ESP32 conectado**.
- [ ] Probar una mano frente al sensor: la distancia cambia en la web.
- [ ] Probar modo manual + cambio de color: el LED físico cambia.
- [ ] Tener el `simulador_esp32.py` como plan B si el WiFi del aula falla.
- [ ] Capturas de respaldo en `docs/img/` por si no hay red.

---

## 11. Opcional: ESP32-CAM

Si el equipo consigue una **ESP32-CAM**, se puede reemplazar la cámara simulada
por un stream MJPEG real:

1. Cargar el ejemplo `CameraWebServer` del core de ESP32.
2. Publicar `http://IP-ESP32/stream`.
3. En el frontend, sustituir el bloque de cámara simulada por un `<img>`.

No es requisito y añade complejidad; queda como mejora futura.
