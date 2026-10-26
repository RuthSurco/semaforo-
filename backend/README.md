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

Cuentas iniciales:

| Usuario | Contraseña | Rol |
|---|---|---|
| `superadmin` | `123456` | Superadministrador |
| `admin` | `123456` | Administrador |

El login es **real**: lo valida **Spring Security** contra la tabla `usuarios`
de H2, las contraseñas se guardan con **BCrypt** y la sesión viaja en una cookie
`JSESSIONID` (HttpOnly). La contraseña inicial se cambia en
`semaforo.seguridad.clave-inicial` o desde **Gestión de usuarios**.

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

| Método | Ruta | Sesión | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | No | Inicia sesión y devuelve el usuario |
| GET | `/api/auth/yo` | No | Sesión actual (204 si no hay) |
| POST | `/api/auth/logout` | No | Cierra la sesión en el servidor |
| GET | `/api/estado` | Sí | Estado actual del semáforo |
| GET | `/api/historial?limite=50` | Sí | Últimas lecturas guardadas |
| DELETE | `/api/historial` | Sí | Borra el historial |
| GET | `/api/estadisticas?periodo=hoy\|semana\|mes` | Sí | Estadísticas del periodo |
| POST | `/api/telemetria` | No | El ESP32 envía una lectura |
| GET | `/api/telemetria?distancia=30&vehiculo=1` | No | Alternativa sencilla para el ESP32 |
| PUT | `/api/control/modo` | Sí | Cambia el modo (`{"modo":"manual"}`) |
| PUT | `/api/control/color` | Sí | Cambia el color (`{"color":"verde"}`) |
| GET | `/api/control/pendiente` | No | Comando pendiente para el ESP32 (204 si no hay) |
| POST | `/api/simulacion/acercar` | Sí | Simula un vehículo a 30 cm |
| POST | `/api/simulacion/alejar` | Sí | Simula vía libre a 120 cm |
| POST | `/api/simulacion/via-libre` | Sí | Igual que alejar |
| POST | `/api/simulacion/restablecer` | Sí | Restablece la simulación |
| GET | `/api/usuarios` | Superadmin | Lista los usuarios |
| POST/PUT/DELETE | `/api/usuarios/{id}` | Superadmin | Crea, edita o elimina usuarios |
| GET | `/api/salud` | No | Comprobación rápida del servidor |

> Las rutas del ESP32 (`/api/telemetria`, `/api/lecturas`,
> `GET /api/control/pendiente`) y `/api/salud` están **abiertas** porque el
> dispositivo no maneja cookies. El resto exige sesión; `/api/usuarios/**`
> exige rol `SUPERADMIN` y devuelve `403` a un administrador normal.

### Ejemplos con curl

```powershell
# Login: guarda la cookie de sesión en cookies.txt
curl -c cookies.txt -X POST http://localhost:8080/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"usuario\":\"superadmin\",\"clave\":\"123456\"}'

# Estado actual (con la sesión)
curl -b cookies.txt http://localhost:8080/api/estado

# Telemetría en JSON (ESP32, no necesita sesión)
curl -X POST http://localhost:8080/api/telemetria `
  -H "Content-Type: application/json" `
  -d '{\"distancia\":32,\"vehiculo\":true,\"color\":\"verde\",\"modo\":\"automatico\"}'

# Telemetría por parámetros (más fácil desde Arduino)
curl -X POST "http://localhost:8080/api/telemetria?distancia=32&vehiculo=1&color=verde"

# Poner el semáforo en manual y luego en rojo (con la sesión)
curl -b cookies.txt -X PUT http://localhost:8080/api/control/modo -H "Content-Type: application/json" -d '{\"modo\":\"manual\"}'
curl -b cookies.txt -X PUT http://localhost:8080/api/control/color -H "Content-Type: application/json" -d '{\"color\":\"rojo\"}'
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
        │   ├── config\
        │   │   ├── SeguridadConfig.java       (Spring Security, roles, 401/403)
        │   │   ├── FiltroUsuarioActivo.java   (revoca sesiones de cuentas inactivas)
        │   │   └── InicializadorDatos.java    (crea superadmin y admin)
        │   ├── modelo\
        │   │   ├── Lectura.java
        │   │   ├── Usuario.java
        │   │   └── Rol.java
        │   ├── repositorio\
        │   │   ├── LecturaRepository.java
        │   │   └── UsuarioRepository.java
        │   ├── servicio\
        │   │   ├── SemaforoService.java
        │   │   ├── SimuladorSemaforo.java
        │   │   ├── EstadisticasService.java
        │   │   └── UsuarioService.java        (login + CRUD de usuarios)
        │   └── web\
        │       ├── ApiController.java
        │       ├── AuthController.java        (login / logout / yo)
        │       ├── UsuarioController.java     (solo SUPERADMIN)
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
server:
  servlet:
    session:
      timeout: 8h           # cierre por inactividad
      cookie:
        http-only: true     # JavaScript no puede leer la cookie
        same-site: lax

semaforo:
  seguridad:
    clave-inicial: "123456" # contraseña de superadmin y admin al arrancar
  simulador:
    activo: true          # false = solo datos reales del ESP32
    intervalo-ms: 2000    # cada cuánto genera una lectura simulada
    silencio-real-ms: 10000  # tiempo sin ESP32 antes de simular
  historial:
    max-registros: 20000  # límite de filas en H2
```

> Cambia `clave-inicial` **antes de publicar** el proyecto. Si ya arrancaste el
> servidor y quieres otra contraseña, cámbiala desde **Gestión de usuarios**
> (usuario `superadmin`).

## 8. Siguientes pasos sugeridos

- Cambiar H2 por MariaDB/MySQL (solo hay que ajustar el datasource).
- Mover la configuración visual de `localStorage` a la base de datos.
- Enviar los comandos al ESP32 por WebSocket en lugar de sondeo.
