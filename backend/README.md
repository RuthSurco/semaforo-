# Semáforo+ · Backend Spring Boot + ESP32

Backend en **Java 21 + Spring Boot 3** que sirve tu interfaz web y expone una
API REST para que un **ESP32** envíe los datos de sus sensores (HC-SR04,
LEDs del semáforo) y para que la página muestre el estado en tiempo real.

Incluye un **simulador integrado**: si no hay ESP32 conectado, el servidor
genera datos automáticamente para que la web, el historial y las estadísticas
sigan funcionando durante la demostración.

> Tus archivos originales (`D:\semaforo+\index.html`, `estilos.css`, `app.js`)
> no se modificaron. La versión que se sirve vive en
> `backend\src\main\resources\static\` y añade solo `conexion.js`.

---

## 1. Requisitos

- Java 21 (ya lo tienes instalado)
- Maven 3.9+ (ya lo tienes instalado)

## 2. Cómo arrancar

```powershell
cd "D:\semaforo+\backend"
mvn spring-boot:run
```

O con el JAR ya compilado:

```powershell
java -jar target\semaforo-plus-1.0.0.jar
```

Abre el navegador en:

**http://localhost:8080**

Usuario de prueba: `superadmin` / `123456` (el login sigue siendo simulado,
igual que antes; el backend no gestiona usuarios todavía).

### Consola de la base de datos H2

- URL: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:semaforoplus`
- Usuario: `sa`
- Contraseña: *(vacía)*

La base de datos es **en memoria**: se reinicia cada vez que apagas el
servidor. Para conservar el historial entre reinicios cambia la URL en
`application.yml` por `jdbc:h2:file:./datos/semaforoplus`.

## 3. Qué muestra la web

`conexion.js` consulta `GET /api/estado` cada segundo y actualiza:

- Distancia del sensor y detección de vehículo.
- Color actual del semáforo y modo (automático / manual).
- Contadores de vehículos y cambios de color.
- Indicador de conexión: **ESP32 conectado** o **Simulación del servidor**.
- Estadísticas reales calculadas desde el historial de H2.

Los botones de la interfaz ahora envían comandos al backend:

- **Modo automático / manual** → `PUT /api/control/modo`
- **Cambiar a rojo / amarillo / verde** → `PUT /api/control/color`
- **Simular vehículo / vía libre** → `POST /api/simulacion/{accion}`

Si el backend no responde (por ejemplo, abriendo el `index.html` directamente
desde el disco), la interfaz sigue usando la simulación local original.

## 4. API REST

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/estado` | Estado actual del semáforo |
| GET | `/api/historial?limite=50` | Últimas lecturas guardadas |
| DELETE | `/api/historial` | Borra el historial |
| GET | `/api/estadisticas?periodo=hoy\|semana\|mes` | Estadísticas del periodo |
| POST | `/api/telemetria` | El ESP32 envía una lectura |
| GET | `/api/telemetria?distancia=30&vehiculo=1` | Alternativa sencilla para el ESP32 |
| PUT | `/api/control/modo` | Cambia el modo (`{"modo":"manual"}`) |
| PUT | `/api/control/color` | Cambia el color (`{"color":"verde"}`) |
| GET | `/api/control/pendiente` | Comando pendiente para el ESP32 (204 si no hay) |
| POST | `/api/simulacion/acercar` | Simula un vehículo a 30 cm |
| POST | `/api/simulacion/alejar` | Simula vía libre a 120 cm |
| POST | `/api/simulacion/via-libre` | Igual que alejar |
| POST | `/api/simulacion/restablecer` | Restablece la simulación |
| GET | `/api/salud` | Comprobación rápida del servidor |

### Ejemplos con curl

```powershell
# Estado actual
curl http://localhost:8080/api/estado

# Telemetría en JSON (ESP32)
curl -X POST http://localhost:8080/api/telemetria `
  -H "Content-Type: application/json" `
  -d '{\"distancia\":32,\"vehiculo\":true,\"color\":\"verde\",\"modo\":\"automatico\"}'

# Telemetría por parámetros (más fácil desde Arduino)
curl -X POST "http://localhost:8080/api/telemetria?distancia=32&vehiculo=1&color=verde"

# Poner el semáforo en manual y luego en rojo
curl -X PUT http://localhost:8080/api/control/modo -H "Content-Type: application/json" -d '{\"modo\":\"manual\"}'
curl -X PUT http://localhost:8080/api/control/color -H "Content-Type: application/json" -d '{\"color\":\"rojo\"}'
```

## 5. Conectar el ESP32 (cuando lo tengas)

1. El ESP32 y la PC deben estar en la **misma red WiFi**.
2. Averigua la IP de la PC con `ipconfig` (por ejemplo `192.168.1.50`).
3. Permite el puerto 8080 en el Firewall de Windows si el ESP32 no conecta:
   ```powershell
   New-NetFirewallRule -DisplayName "Semaforo+ 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
   ```
4. Desde el ESP32 envía telemetría a `http://IP-DE-LA-PC:8080/api/telemetria`.

Ejemplo mínimo con `HTTPClient` de Arduino:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* SSID = "TU_WIFI";
const char* CLAVE = "TU_CLAVE";
const char* SERVIDOR = "http://192.168.1.50:8080/api/telemetria";

void enviar(int distancia, bool vehiculo, const char* color) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(SERVIDOR);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  String cuerpo = "distancia=" + String(distancia) +
                  "&vehiculo=" + String(vehiculo ? 1 : 0) +
                  "&color=" + color;
  http.POST(cuerpo);
  http.end();
}
```

Para recibir los comandos del panel (modo manual / color):

```cpp
HTTPClient http;
http.begin("http://IP-DE-LA-PC:8080/api/control/pendiente");
int codigo = http.GET();
if (codigo == 200) {
  String respuesta = http.getString(); // {"tipo":"color","valor":"rojo",...}
  // procesar respuesta y cambiar los LEDs
}
http.end();
```

> Mientras el ESP32 envíe datos cada pocos segundos, el simulador del backend
> se detiene automáticamente. Si deja de enviar durante 10 segundos, el
> simulador vuelve a tomar el control.

## 6. Estructura del proyecto

```
D:\semaforo+\
├── index.html              (original, sin tocar)
├── estilos.css             (original, sin tocar)
├── app.js                  (original, sin tocar)
└── backend\
    ├── pom.xml
    ├── README.md
    └── src\main\
        ├── java\com\semaforoplus\
        │   ├── SemaforoPlusApplication.java
        │   ├── modelo\Lectura.java
        │   ├── repositorio\LecturaRepository.java
        │   ├── servicio\
        │   │   ├── SemaforoService.java
        │   │   ├── SimuladorSemaforo.java
        │   │   └── EstadisticasService.java
        │   └── web\
        │       ├── ApiController.java
        │       ├── ApiExceptionHandler.java
        │       └── dto\...
        └── resources\
            ├── application.yml
            └── static\
                ├── index.html   (copia + conexion.js)
                ├── estilos.css
                ├── app.js
                └── conexion.js
```

## 7. Configuración

En `src\main\resources\application.yml`:

```yaml
semaforo:
  simulador:
    activo: true          # false = solo datos reales del ESP32
    intervalo-ms: 2000    # cada cuánto genera una lectura simulada
    silencio-real-ms: 10000  # tiempo sin ESP32 antes de simular
  historial:
    max-registros: 20000  # límite de filas en H2
```

## 8. Siguientes pasos sugeridos

- Cambiar H2 por MariaDB/MySQL (solo hay que ajustar el datasource).
- Autenticación real con Spring Security (hoy el login es simulado).
- Mover usuarios y configuración de `localStorage` a la base de datos.
- Enviar los comandos al ESP32 por WebSocket en lugar de sondeo.
