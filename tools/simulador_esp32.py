#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simulador de ESP32 para Semáforo+
==================================

Envía telemetría al backend Spring Boot como si fuera el ESP32 real, y consulta
los comandos que llegan desde el panel web. Sirve para:

  - Probar la integración sin hardware.
  - Tener un plan B si el WiFi del aula falla en la exposición.
  - Que los compañeros de hardware vean el contrato de la API funcionando.

Solo usa la librería estándar de Python 3.8+. No hay que instalar nada.

Uso:
    python tools/simulador_esp32.py
    python tools/simulador_esp32.py --servidor http://192.168.1.50:8080
    python tools/simulador_esp32.py --intervalo 2 --ver-comandos
    python tools/simulador_esp32.py --duracion 60

Detener: Ctrl + C
"""

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# Windows: evita errores al imprimir acentos en consolas cp1252.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass


class Colores:
    """Códigos ANSI; se desactivan con --sin-color o si la consola no los admite."""
    ACTIVO = True

    @classmethod
    def _c(cls, codigo, texto):
        if not cls.ACTIVO:
            return texto
        return "\033[{}m{}\033[0m".format(codigo, texto)

    @classmethod
    def verde(cls, t):
        return cls._c("92", t)

    @classmethod
    def amarillo(cls, t):
        return cls._c("93", t)

    @classmethod
    def rojo(cls, t):
        return cls._c("91", t)

    @classmethod
    def gris(cls, t):
        return cls._c("90", t)

    @classmethod
    def cian(cls, t):
        return cls._c("96", t)


def pintar_color(color):
    if color == "verde":
        return Colores.verde(color.upper())
    if color == "amarillo":
        return Colores.amarillo(color.upper())
    if color == "rojo":
        return Colores.rojo(color.upper())
    return color


def peticion(url, datos=None, metodo="GET", timeout=5):
    """Hace una petición HTTP y devuelve (codigo, cuerpo_json_o_texto)."""
    cuerpo = None
    cabeceras = {"Accept": "application/json"}

    if datos is not None:
        if isinstance(datos, dict):
            cuerpo = urllib.parse.urlencode(datos).encode("utf-8")
            cabeceras["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            cuerpo = datos

    solicitud = urllib.request.Request(url, data=cuerpo, headers=cabeceras, method=metodo)

    try:
        with urllib.request.urlopen(solicitud, timeout=timeout) as respuesta:
            texto = respuesta.read().decode("utf-8", "replace")
            try:
                return respuesta.status, json.loads(texto)
            except json.JSONDecodeError:
                return respuesta.status, texto
    except urllib.error.HTTPError as error:
        texto = error.read().decode("utf-8", "replace")
        try:
            return error.code, json.loads(texto)
        except json.JSONDecodeError:
            return error.code, texto
    except urllib.error.URLError as error:
        raise ConnectionError(str(error.reason)) from error


def simular_distancia(anterior, hay_vehiculo):
    """Paseo aleatorio: se acerca de vez en cuando y luego se aleja."""
    if hay_vehiculo:
        # El vehículo se aleja hasta salir del umbral.
        nueva = anterior + random.randint(4, 12)
        return min(nueva, 150)
    # Sin vehículo: normalmente lejos; a veces se acerca.
    if random.random() < 0.18:
        return random.randint(20, 38)
    return max(45, min(180, anterior + random.randint(-15, 15)))


def main():
    parser = argparse.ArgumentParser(
        description="Simula un ESP32 enviando telemetría a Semáforo+."
    )
    parser.add_argument(
        "--servidor",
        default="http://localhost:8080",
        help="URL base del backend (por defecto http://localhost:8080)",
    )
    parser.add_argument(
        "--intervalo",
        type=float,
        default=1.0,
        help="Segundos entre lecturas (por defecto 1.0)",
    )
    parser.add_argument(
        "--duracion",
        type=float,
        default=0,
        help="Duración total en segundos; 0 = infinita (por defecto 0)",
    )
    parser.add_argument(
        "--ver-comandos",
        action="store_true",
        help="Muestra también los comandos que llegan desde el panel web",
    )
    parser.add_argument(
        "--sin-color",
        action="store_true",
        help="Desactiva los colores en la consola",
    )
    argumentos = parser.parse_args()

    Colores.ACTIVO = not argumentos.sin_color

    base = argumentos.servidor.rstrip("/")
    url_telemetria = base + "/api/telemetria"
    url_comando = base + "/api/control/pendiente"
    url_salud = base + "/api/salud"

    print("=" * 58)
    print("  SEMÁFORO+ · Simulador de ESP32")
    print("=" * 58)
    print("  Servidor : {}".format(base))
    print("  Intervalo: {} s".format(argumentos.intervalo))
    print("  Detener  : Ctrl + C")
    print("-" * 58)

    # 1) Comprobar que el backend responde.
    try:
        codigo, salud = peticion(url_salud)
        if codigo != 200:
            print(Colores.rojo("El servidor respondió {}.".format(codigo)))
            return 1
    except ConnectionError as error:
        print(Colores.rojo("No se pudo conectar con el backend: {}".format(error)))
        print(Colores.gris("¿Está arrancado?  cd backend && mvn spring-boot:run"))
        return 1

    print("  Backend  : {} v{}".format(salud.get("aplicacion", "?"), salud.get("version", "?")))
    print("-" * 58)

    distancia = 120
    hay_vehiculo = False
    enviadas = 0
    errores = 0
    modo = "automatico"
    inicio = time.time()
    ultimo_estado = ""

    try:
        while True:
            if argumentos.duracion > 0 and (time.time() - inicio) >= argumentos.duracion:
                break

            # 2) Avanzar la simulación física.
            distancia = simular_distancia(distancia, hay_vehiculo)
            hay_vehiculo = distancia < 40

            # 3) Enviar telemetría.
            datos = {
                "distancia": distancia,
                "vehiculo": 1 if hay_vehiculo else 0,
                "modo": modo,
                "dispositivo": "SimuladorPython",
            }

            try:
                codigo, estado = peticion(url_telemetria, datos, metodo="POST")
                if codigo == 200:
                    enviadas += 1
                    linea = "  {:>4} cm  {:<10} {}  vehiculos={}".format(
                        distancia,
                        "VEHICULO" if hay_vehiculo else "libre",
                        pintar_color(estado.get("color", "?")),
                        estado.get("vehiculosDetectados", 0),
                    )
                    if linea != ultimo_estado:
                        print(linea)
                        ultimo_estado = linea
                else:
                    errores += 1
                    mensaje = estado.get("mensaje") if isinstance(estado, dict) else estado
                    print(Colores.rojo("  HTTP {}: {}".format(codigo, mensaje)))
            except ConnectionError as error:
                errores += 1
                print(Colores.rojo("  Sin conexión: {}".format(error)))

            # 4) Consultar comandos del panel.
            if argumentos.ver_comandos:
                try:
                    codigo, comando = peticion(url_comando)
                    if codigo == 200 and isinstance(comando, dict):
                        tipo = comando.get("tipo", "?")
                        valor = comando.get("valor", "?")
                        print(Colores.cian("  [CMD] {} = {}".format(tipo, valor)))
                        if tipo == "modo":
                            modo = valor
                except ConnectionError:
                    pass

            time.sleep(max(0.1, argumentos.intervalo))

    except KeyboardInterrupt:
        print()
        print(Colores.gris("Detenido por el usuario."))

    print("-" * 58)
    print("  Lecturas enviadas: {}".format(enviadas))
    if errores:
        print(Colores.amarillo("  Errores: {}".format(errores)))
    print("  La web volverá a la simulación del servidor en 10 s.")
    print("=" * 58)
    return 0


if __name__ == "__main__":
    sys.exit(main())
