/* ============================================================================
   SEMÁFORO+ · Firmware del ESP32
   ----------------------------------------------------------------------------
   Qué hace:
     1. Se conecta a WiFi (2.4 GHz).
     2. Mide la distancia con un sensor ultrasónico HC-SR04.
     3. Enciende el LED del color que corresponda (rojo / amarillo / verde).
     4. Envía telemetría al backend Spring Boot:  POST /api/telemetria
     5. Consulta comandos del panel web:          GET  /api/control/pendiente

   Placa:      ESP32 Dev Module
   Librerías:  ArduinoJson 7.x  (Tools > Manage Libraries)
   Baudios:    115200

   Autores:    Proyecto Semáforo+ (Spring Web + Java)
   ============================================================================ */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

/* ======================= 1. CONFIGURACIÓN ================================= */
/*  >>> EDITA SOLO ESTAS TRES LÍNEAS <<<  */

const char* WIFI_SSID     = "TU_WIFI";            // nombre de la red 2.4 GHz
const char* WIFI_PASSWORD = "TU_CLAVE";           // contraseña del WiFi
const char* SERVIDOR      = "http://192.168.1.50:8080";  // IP de la PC

/* ======================= 2. PINES ========================================= */

const int PIN_TRIG = 5;
const int PIN_ECHO = 18;
const int PIN_LED_ROJO = 25;
const int PIN_LED_AMARILLO = 26;
const int PIN_LED_VERDE = 27;

/* ======================= 3. PARÁMETROS ==================================== */

const int  UMBRAL_VEHICULO        = 40;    // cm: menos que esto = vehículo
const unsigned long AMARILLO_MS   = 700;   // duración del amarillo
const unsigned long TELEMETRIA_MS = 1000;  // cada cuánto envía datos
const unsigned long COMANDOS_MS   = 1000;  // cada cuánto pregunta comandos
const unsigned long WIFI_RETRY_MS = 5000;  // reintento de WiFi
const unsigned long TIMEOUT_HTTP  = 3000;  // ms de espera por respuesta
const int  LECTURAS_PROMEDIO      = 3;     // promediar para estabilizar

/* ======================= 4. ESTADO INTERNO ================================ */

enum Color { ROJO, AMARILLO, VERDE };

String modoActual = "automatico";   // automatico | manual
Color  colorActual = ROJO;
unsigned long cambioAmarilloEn = 0;
bool  enTransicion = false;

unsigned long ultimaTelemetria = 0;
unsigned long ultimoComando = 0;
unsigned long ultimoIntentoWifi = 0;

int  distanciaCm = 120;
bool vehiculoDetectado = false;

/* ======================= 5. UTILIDADES ==================================== */

void aplicarColor(Color color) {
  digitalWrite(PIN_LED_ROJO,     color == ROJO     ? HIGH : LOW);
  digitalWrite(PIN_LED_AMARILLO, color == AMARILLO ? HIGH : LOW);
  digitalWrite(PIN_LED_VERDE,    color == VERDE    ? HIGH : LOW);
  colorActual = color;
}

const char* nombreColor(Color color) {
  switch (color) {
    case ROJO:     return "rojo";
    case AMARILLO: return "amarillo";
    default:       return "verde";
  }
}

/* Lee el HC-SR04 y devuelve centímetros. 0 = fuera de rango / error. */
int medirDistancia() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(4);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long microsegundos = pulseIn(PIN_ECHO, HIGH, 30000UL);
  if (microsegundos == 0) {
    return 0;
  }
  int cm = (int)(microsegundos * 0.0343f / 2.0f);
  if (cm < 2 || cm > 400) {
    return 0;
  }
  return cm;
}

/* Promedia varias lecturas para reducir el ruido del sensor. */
int medirDistanciaPromedio() {
  long suma = 0;
  int validas = 0;
  for (int i = 0; i < LECTURAS_PROMEDIO; i++) {
    int lectura = medirDistancia();
    if (lectura > 0) {
      suma += lectura;
      validas++;
    }
    delay(12);
  }
  if (validas == 0) {
    return distanciaCm;  // conserva la última válida
  }
  return (int)(suma / validas);
}

bool conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.print("[WiFi] Conectando a ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Conectado. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("[WiFi] No se pudo conectar. Revisa SSID, clave y que sea 2.4 GHz.");
  return false;
}

/* ======================= 6. LÓGICA DEL SEMÁFORO =========================== */

void actualizarSemaforo() {
  if (modoActual == "manual") {
    return;  // en manual el color lo decide el panel web
  }

  Color deseado = vehiculoDetectado ? VERDE : ROJO;

  if (colorActual == deseado) {
    enTransicion = false;
    return;
  }

  if (!enTransicion) {
    aplicarColor(AMARILLO);
    enTransicion = true;
    cambioAmarilloEn = millis();
    return;
  }

  if (millis() - cambioAmarilloEn >= AMARILLO_MS) {
    aplicarColor(deseado);
    enTransicion = false;
  }
}

/* ======================= 7. HTTP ========================================== */

bool enviarTelemetria() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String url = String(SERVIDOR) + "/api/telemetria";
  http.begin(url);
  http.setTimeout(TIMEOUT_HTTP);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String cuerpo = "distancia=" + String(distanciaCm) +
                  "&vehiculo=" + String(vehiculoDetectado ? 1 : 0) +
                  "&color=" + String(nombreColor(colorActual)) +
                  "&modo=" + modoActual +
                  "&dispositivo=ESP32";

  int codigo = http.POST(cuerpo);
  bool ok = (codigo == 200);

  if (ok) {
    Serial.print("[HTTP] POST 200 -> ");
    Serial.println(cuerpo);
  } else {
    Serial.print("[HTTP] POST fallo, codigo ");
    Serial.println(codigo);
  }

  http.end();
  return ok;
}

void consultarComando() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;
  String url = String(SERVIDOR) + "/api/control/pendiente";
  http.begin(url);
  http.setTimeout(TIMEOUT_HTTP);

  int codigo = http.GET();

  if (codigo == 200) {
    String respuesta = http.getString();

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, respuesta);
    if (!error) {
      String tipo  = doc["tipo"]  | "";
      String valor = doc["valor"] | "";

      Serial.print("[CMD] ");
      Serial.print(tipo);
      Serial.print(" = ");
      Serial.println(valor);

      if (tipo == "modo") {
        if (valor == "automatico" || valor == "manual") {
          modoActual = valor;
          enTransicion = false;
        }
      } else if (tipo == "color" && modoActual == "manual") {
        if (valor == "rojo") {
          aplicarColor(ROJO);
        } else if (valor == "amarillo") {
          aplicarColor(AMARILLO);
        } else if (valor == "verde") {
          aplicarColor(VERDE);
        }
      }
    } else {
      Serial.print("[CMD] JSON invalido: ");
      Serial.println(error.c_str());
    }
  } else if (codigo != 204) {
    Serial.print("[CMD] GET fallo, codigo ");
    Serial.println(codigo);
  }

  http.end();
}

/* ======================= 8. SETUP ========================================= */

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("========================================");
  Serial.println("  SEMAFORO+ · ESP32");
  Serial.println("========================================");

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_LED_ROJO, OUTPUT);
  pinMode(PIN_LED_AMARILLO, OUTPUT);
  pinMode(PIN_LED_VERDE, OUTPUT);

  aplicarColor(ROJO);
  conectarWiFi();
}

/* ======================= 9. LOOP ========================================== */

void loop() {
  unsigned long ahora = millis();

  /* --- Mantener el WiFi vivo --- */
  if (WiFi.status() != WL_CONNECTED && ahora - ultimoIntentoWifi >= WIFI_RETRY_MS) {
    ultimoIntentoWifi = ahora;
    conectarWiFi();
  }

  /* --- Medir el sensor --- */
  distanciaCm = medirDistanciaPromedio();
  vehiculoDetectado = (distanciaCm > 0 && distanciaCm < UMBRAL_VEHICULO);

  /* --- Decidir el color (modo automático) --- */
  actualizarSemaforo();

  /* --- Enviar telemetría --- */
  if (ahora - ultimaTelemetria >= TELEMETRIA_MS) {
    ultimaTelemetria = ahora;
    enviarTelemetria();
  }

  /* --- Recibir comandos del panel --- */
  if (ahora - ultimoComando >= COMANDOS_MS) {
    ultimoComando = ahora;
    consultarComando();
  }

  delay(20);
}
