/* ============================================================================
   SEMÁFORO+ · CAPA DE CONEXIÓN CON EL BACKEND (Spring Boot)
   ----------------------------------------------------------------------------
   Este archivo NO reemplaza la simulación original de app.js: la complementa.
   - Consulta /api/estado cada segundo y pinta el estado real en la interfaz.
   - Si el servidor no responde, todo sigue funcionando con la simulación
     local que ya existía.
   - Los botones de control y de simulación se envían al backend cuando está
     disponible.
   ============================================================================ */
(function () {
    'use strict';

    var CONFIG = {
        intervaloMs: 1000,
        base: ''
    };

    var conexion = {
        disponible: false,
        esp32: false,
        origen: null,
        totalLecturas: 0,
        avisoMostrado: false
    };

    var porId = function (id) { return document.getElementById(id); };

    function texto(id, valor) {
        var elemento = porId(id);
        if (elemento) { elemento.textContent = valor; }
    }

    function colorPunto(estado) {
        if (estado === 'real') { return 'verde'; }
        if (estado === 'simulado') { return 'amarillo'; }
        return 'gris';
    }

    /* ---------------------- Indicadores de conexión ---------------------- */

    function pintarConexion(dto) {
        var tipo = dto.esp32Conectado ? 'real' : 'simulado';
        var etiqueta = dto.esp32Conectado ? 'ESP32 conectado' : 'Simulación del servidor';
        var detalle = dto.esp32Conectado ? 'conectado' : 'simulado';

        var chip = porId('chip-simulacion');
        if (chip) {
            chip.innerHTML = '<span class="punto-punto ' + colorPunto(tipo) + '"></span> ' + etiqueta;
            chip.title = 'Origen de los datos: ' + (dto.origen || 'SIMULADO');
        }

        texto('estado-conexion', etiqueta);
        texto('info-conexion', dto.esp32Conectado ? 'Conectado' : 'Simulado');
        texto('sensor-conexion', dto.esp32Conectado ? 'Conectado' : 'Simulado');
        texto('estado-dispositivo', dto.dispositivo || 'Semáforo Principal');
        texto('info-dispositivo', dto.dispositivo || 'ESP32');
        texto('info-ubicacion', dto.ubicacion || 'Avenida Central');

        var lista = porId('lista-conexion');
        if (lista) {
            lista.innerHTML =
                '<li><span class="punto-punto verde"></span> ESP32 <small>' + detalle + '</small></li>' +
                '<li><span class="punto-punto ' + colorPunto(tipo) + '"></span> Sensor HC-SR04 <small>' +
                (dto.distanciaCm + ' cm') + '</small></li>' +
                '<li><span class="punto-punto ' + (dto.camaraConectada ? 'verde' : 'gris') +
                '"></span> Cámara <small>' + (dto.camaraConectada ? 'activa' : 'sin conexión') + '</small></li>' +
                '<li><span class="punto-punto verde"></span> Backend Spring Boot <small>en línea</small></li>';
        }

        var pie = porId('pie-nota');
        if (pie) {
            pie.textContent = 'Backend Spring Boot · ' + (dto.esp32Conectado
                ? 'telemetría real del ESP32'
                : 'simulación generada por el servidor');
        }

        conexion.totalLecturas = Number(dto.totalLecturas) || 0;
    }

    function marcarSinServidor() {
        var chip = porId('chip-simulacion');
        if (chip) {
            chip.innerHTML = '<span class="punto-punto gris"></span> Modo local (sin servidor)';
            chip.title = 'El backend no responde; se usa la simulación del navegador.';
        }
        texto('estado-conexion', 'Servidor no disponible');
        texto('info-conexion', 'Simulación local');
        texto('sensor-conexion', 'Simulación local');

        var lista = porId('lista-conexion');
        if (lista) {
            lista.innerHTML =
                '<li><span class="punto-punto gris"></span> Backend Spring Boot <small>sin conexión</small></li>' +
                '<li><span class="punto-punto amarillo"></span> Sensor local <small>simulado</small></li>' +
                '<li><span class="punto-punto amarillo"></span> Simulación del navegador <small>activa</small></li>';
        }

        if (!conexion.avisoMostrado) {
            conexion.avisoMostrado = true;
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('Sin conexión con el servidor: usando simulación local.', 'advertencia');
            }
        }
    }

    /* ------------------------- Aplicar el estado ------------------------- */

    function aplicarEstado(dto) {
        if (!dto) { return; }

        estadoAplicacion.distancia = dto.distanciaCm;
        estadoAplicacion.vehiculoDetectado = dto.vehiculoDetectado;
        estadoAplicacion.modo = dto.modo;
        estadoAplicacion.colorSemaforo = dto.color;
        estadoAplicacion.vehiculosDetectados = dto.vehiculosDetectados;
        estadoAplicacion.camaraConectada = dto.camaraConectada;
        auxiliar.cambiosColor = dto.cambiosColor;
        if (dto.ultimaLectura) {
            auxiliar.ultimaLectura = dto.ultimaLectura;
        }

        actualizarSemaforo();
        actualizarControlesModo();
        pintarConexion(dto);

        conexion.esp32 = Boolean(dto.esp32Conectado);
        conexion.origen = dto.origen;
    }

    /* --------------------------- Peticiones ----------------------------- */

    function leerError(respuesta) {
        return respuesta.json()
            .catch(function () { return {}; })
            .then(function (cuerpo) {
                throw new Error(cuerpo.mensaje || ('HTTP ' + respuesta.status));
            });
    }

    function enviarControl(tipo, valor) {
        var cuerpo = {};
        cuerpo[tipo] = valor;
        fetch(CONFIG.base + '/api/control/' + tipo, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        }).then(function (respuesta) {
            if (!respuesta.ok) { return leerError(respuesta); }
            return respuesta.json();
        }).then(function (dto) {
            aplicarEstado(dto);
        }).catch(function (error) {
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('No se pudo guardar el cambio en el servidor: ' + error.message, 'error');
            }
        });
    }

    function enviarSimulacion(accion) {
        fetch(CONFIG.base + '/api/simulacion/' + accion, { method: 'POST' })
            .then(function (respuesta) {
                if (!respuesta.ok) { return leerError(respuesta); }
                return respuesta.json();
            })
            .then(function (dto) { aplicarEstado(dto); })
            .catch(function (error) {
                if (typeof mostrarNotificacion === 'function') {
                    mostrarNotificacion('Simulación no disponible: ' + error.message, 'advertencia');
                }
            });
    }

    function consultarEstado() {
        fetch(CONFIG.base + '/api/estado', { cache: 'no-store' })
            .then(function (respuesta) {
                if (!respuesta.ok) { throw new Error('HTTP ' + respuesta.status); }
                return respuesta.json();
            })
            .then(function (dto) {
                conexion.disponible = true;
                conexion.avisoMostrado = false;
                aplicarEstado(dto);
            })
            .catch(function () {
                conexion.disponible = false;
                marcarSinServidor();
            })
            .finally(function () {
                window.setTimeout(consultarEstado, CONFIG.intervaloMs);
            });
    }

    /* ------------------------ Interceptar botones ----------------------- */

    function envolverControl(nombre, tipo) {
        var original = window[nombre];
        if (typeof original !== 'function') { return; }
        window[nombre] = function () {
            var antes = tipo === 'modo'
                ? estadoAplicacion.modo
                : estadoAplicacion.colorSemaforo;
            var resultado = original.apply(this, arguments);
            var despues = tipo === 'modo'
                ? estadoAplicacion.modo
                : estadoAplicacion.colorSemaforo;

            if (despues !== antes && conexion.disponible) {
                enviarControl(tipo, despues);
            }
            return resultado;
        };
    }

    function envolverSimulacion(nombre, accion) {
        var original = window[nombre];
        if (typeof original !== 'function') { return; }
        window[nombre] = function () {
            if (conexion.disponible) {
                if (conexion.esp32) {
                    if (typeof mostrarNotificacion === 'function') {
                        mostrarNotificacion('El ESP32 está conectado: la simulación está deshabilitada.', 'advertencia');
                    }
                    return undefined;
                }
                enviarSimulacion(accion);
                return undefined;
            }
            return original.apply(this, arguments);
        };
    }

    /* --------------------------- Estadísticas --------------------------- */

    function pintarEstadisticas(datos) {
        if (!datos) { return false; }
        /* Con muy poco historial (recién arrancado) se muestran los datos base
           del prototipo para que la pantalla no aparezca vacía. */
        if (conexion.totalLecturas < 10) {
            return false;
        }

        texto('stat-vehiculos', datos.totalVehiculos);
        texto('stat-vehiculos-pie', 'Historial real · ' + String(datos.etiqueta || '').toLowerCase());
        texto('stat-espera', datos.esperaPromedioSegundos + ' s');
        texto('stat-cambios', datos.cambios);
        texto('stat-hora-pico', datos.horaPico);

        renderizarBarras('grafico-vehiculos', datos.porHora, datos.horaPico);
        renderizarBarras('grafico-semanal', datos.semanal, null);
        renderizarDonut(datos.tiempos);
        renderizarTrafico(datos.trafico);
        return true;
    }

    var renderizarEstadisticasOriginal = window.renderizarEstadisticas;

    window.renderizarEstadisticas = function (periodo) {
        var elegido = periodo || 'hoy';
        if (!conexion.disponible) {
            return renderizarEstadisticasOriginal.apply(this, arguments);
        }
        fetch(CONFIG.base + '/api/estadisticas?periodo=' + encodeURIComponent(elegido), { cache: 'no-store' })
            .then(function (respuesta) {
                if (!respuesta.ok) { throw new Error('HTTP ' + respuesta.status); }
                return respuesta.json();
            })
            .then(function (datos) {
                if (!pintarEstadisticas(datos)) {
                    renderizarEstadisticasOriginal.call(null, elegido);
                }
            })
            .catch(function () {
                renderizarEstadisticasOriginal.call(null, elegido);
            });
    };

    /* ----------------------------- Arranque ----------------------------- */

    /* Los envoltorios se instalan en cuanto se evalúa este archivo (app.js ya
       se ejecutó) para que registrarEventos capture las versiones conectadas. */
    function prepararEnvoltorios() {
        envolverControl('cambiarModo', 'modo');
        envolverControl('cambiarColor', 'color');

        envolverSimulacion('simularVehiculoAcercandose', 'acercar');
        envolverSimulacion('simularVehiculoAlejandose', 'alejar');
        envolverSimulacion('simularViaLibre', 'via-libre');
        envolverSimulacion('restablecerSimulacion', 'restablecer');

        var navEstadisticas = porId('nav-estadisticas');
        if (navEstadisticas) {
            navEstadisticas.addEventListener('click', function () {
                window.setTimeout(function () { window.renderizarEstadisticas('hoy'); }, 60);
            });
        }
    }

    function arrancarPolling() {
        consultarEstado();
    }

    if (typeof window.cambiarModo === 'function') {
        prepararEnvoltorios();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancarPolling);
    } else {
        arrancarPolling();
    }

    /* API pública mínima para depurar desde la consola del navegador. */
    window.SemaforoPlus = {
        conexion: conexion,
        recargar: consultarEstado,
        estado: function () { return estadoAplicacion; }
    };
})();
