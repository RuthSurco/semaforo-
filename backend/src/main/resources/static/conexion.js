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

    /* El sondeo solo funciona con sesión iniciada. */
    var activo = false;
    var temporizador = null;
    var generacion = 0;
    var peticionEnCurso = null;

    var porId = function (id) { return document.getElementById(id); };

    function texto(id, valor) {
        var elemento = porId(id);
        if (elemento) { elemento.textContent = valor; }
    }

    function colorPunto(estado) {
        if (estado === 'real' || estado === 'simulado') { return 'verde'; }
        return 'gris';
    }

    /* ---------------------- Indicadores de conexión ---------------------- */

    function pintarConexion(dto) {
        var tipo = dto.esp32Conectado ? 'real' : 'simulado';
        var etiqueta = dto.esp32Conectado ? 'ESP32 conectado' : 'Sistema en línea';
        var detalle = dto.esp32Conectado ? 'conectado' : 'local';

        var chip = porId('chip-simulacion');
        if (chip) {
            chip.innerHTML = '<span class="punto-punto ' + colorPunto(tipo) + '"></span> ' + etiqueta;
            chip.title = 'Datos actualizados automáticamente';
        }

        texto('estado-conexion', etiqueta);
        texto('info-conexion', dto.esp32Conectado ? 'Conectado' : 'En línea');
        texto('sensor-conexion', dto.esp32Conectado ? 'Conectado' : 'En línea');
        texto('estado-dispositivo', dto.dispositivo || 'Semáforo Principal');
        texto('info-dispositivo', dto.dispositivo || 'Controlador ESP32');
        texto('info-ubicacion', dto.ubicacion || 'Avenida Central');

        var lista = porId('lista-conexion');
        if (lista) {
            lista.innerHTML =
                '<li><span class="punto-punto verde"></span> Controlador ESP32 <small>' + detalle + '</small></li>' +
                '<li><span class="punto-punto ' + colorPunto(tipo) + '"></span> Sensor HC-SR04 <small>' +
                (dto.distanciaCm + ' cm') + '</small></li>' +
                '<li><span class="punto-punto ' + (dto.camaraConectada ? 'verde' : 'gris') +
                '"></span> Cámara <small>' + (dto.camaraConectada ? 'activa' : 'sin conexión') + '</small></li>' +
                '<li><span class="punto-punto verde"></span> Servidor <small>en línea</small></li>';
        }

        var pie = porId('pie-nota');
        if (pie) {
            pie.textContent = 'Sistema en línea · ' + (dto.esp32Conectado
                ? 'telemetría del dispositivo'
                : 'datos actualizados');
        }

        conexion.totalLecturas = Number(dto.totalLecturas) || 0;
    }

    function marcarSinServidor() {
        var chip = porId('chip-simulacion');
        if (chip) {
            chip.innerHTML = '<span class="punto-punto gris"></span> Modo local (sin servidor)';
            chip.title = 'El servidor no responde; se muestran los datos locales.';
        }
        texto('estado-conexion', 'Servidor no disponible');
        texto('info-conexion', 'Datos locales');
        texto('sensor-conexion', 'Datos locales');

        var lista = porId('lista-conexion');
        if (lista) {
            lista.innerHTML =
                '<li><span class="punto-punto gris"></span> Servidor <small>sin conexión</small></li>' +
                '<li><span class="punto-punto amarillo"></span> Sensor local <small>activo</small></li>' +
                '<li><span class="punto-punto amarillo"></span> Datos locales <small>disponibles</small></li>';
        }

        if (!conexion.avisoMostrado) {
            conexion.avisoMostrado = true;
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion('Sin conexión con el servidor: mostrando datos locales.', 'advertencia');
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
                    mostrarNotificacion('Acción no disponible: ' + error.message, 'advertencia');
                }
            });
    }

    function consultarEstado() {
        if (!activo) { return; }

        /* Cada sesión tiene su propia "generación": si se cierra sesión mientras
           hay una petición en vuelo, su respuesta se ignora. */
        var genActual = generacion;
        peticionEnCurso = new AbortController();

        fetch(CONFIG.base + '/api/estado', {
            cache: 'no-store',
            signal: peticionEnCurso.signal
        })
            .then(function (respuesta) {
                if (genActual !== generacion) { return null; }
                if (respuesta.status === 401) {
                    /* La sesión caducó: se deja de consultar y se pide login. */
                    detenerPolling();
                    if (typeof mostrarNotificacion === 'function') {
                        mostrarNotificacion('Tu sesión caducó. Inicia sesión de nuevo.', 'advertencia');
                    }
                    if (typeof mostrarPantallaLogin === 'function') {
                        mostrarPantallaLogin();
                    }
                    return null;
                }
                if (!respuesta.ok) { throw new Error('HTTP ' + respuesta.status); }
                return respuesta.json();
            })
            .then(function (dto) {
                if (!dto || genActual !== generacion) { return; }
                conexion.disponible = true;
                conexion.avisoMostrado = false;
                aplicarEstado(dto);
            })
            .catch(function (error) {
                if ((error && error.name === 'AbortError') || genActual !== generacion) { return; }
                conexion.disponible = false;
                marcarSinServidor();
            })
            .finally(function () {
                if (activo && genActual === generacion) {
                    temporizador = window.setTimeout(consultarEstado, CONFIG.intervaloMs);
                }
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
                        mostrarNotificacion('El ESP32 está conectado: los controles manuales del sensor están deshabilitados.', 'advertencia');
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
        if (activo) { return; }
        activo = true;
        generacion += 1;
        conexion.avisoMostrado = false;
        consultarEstado();
    }

    function detenerPolling() {
        activo = false;
        generacion += 1;
        if (temporizador) {
            window.clearTimeout(temporizador);
            temporizador = null;
        }
        if (peticionEnCurso) {
            peticionEnCurso.abort();
            peticionEnCurso = null;
        }
    }

    /* app.js avisa cuando hay sesión. Antes del login no se consulta nada. */
    document.addEventListener('semaforoplus:sesion-iniciada', arrancarPolling);
    document.addEventListener('semaforoplus:sesion-cerrada', function () {
        detenerPolling();
        conexion.disponible = false;
        conexion.esp32 = false;
    });

    if (typeof window.cambiarModo === 'function') {
        prepararEnvoltorios();
    }

    /* API pública mínima para depurar desde la consola del navegador. */
    window.SemaforoPlus = {
        conexion: conexion,
        recargar: consultarEstado,
        estado: function () { return estadoAplicacion; }
    };
})();
