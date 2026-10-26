/* ============================================================================
   SEMÁFORO+ — Lógica del prototipo (JavaScript puro, sin dependencias)
   ----------------------------------------------------------------------------
   CONTENIDO:
     0. Seguridad y sesión
     1. Constantes: secciones, configuración, datos
     2. Estado central de la aplicación
     3. Utilidades de DOM, tiempo y formato
     4. Sesión: login, cierre y restauración con el backend
     5. Permisos y navegación
     6. Semáforo: modos, color y sensor simulado
     7. Dashboard, mapa y cámara simulados
     8. Estadísticas
     9. Gestión de usuarios (API del backend)
    10. Configuración
    11. Notificaciones (toast) y panel de la barra superior
    12. Reloj, menú móvil e inicialización
   ========================================================================= */

'use strict';

/* ==========================================================================
   0. SEGURIDAD Y SESIÓN
   ==========================================================================
   El login es REAL y lo valida el backend con Spring Security:
   - La contraseña se envía una sola vez y se guarda cifrada (BCrypt) en H2.
   - El navegador solo conserva la cookie de sesión JSESSIONID (HttpOnly).
   - Ningún usuario ni contraseña está escrito en este archivo.
   ========================================================================== */

/* ============================ 1. CONSTANTES ============================== */

const CLAVE_CONFIGURACION = 'semaforoplus_config';

/* Definición de las secciones: título, descripción y permisos. */
const SECCIONES = {
    dashboard: {
        titulo: 'Dashboard',
        descripcion: 'Monitoreo general del sistema de semáforos inteligentes',
        soloSuperadmin: false
    },
    semaforos: {
        titulo: 'Semáforos',
        descripcion: 'Control de semáforos, modos de operación y sensor de proximidad',
        soloSuperadmin: false
    },
    camaras: {
        titulo: 'Cámaras',
        descripcion: 'Monitoreo de cámaras de tráfico',
        soloSuperadmin: false
    },
    mapa: {
        titulo: 'Mapa y rutas',
        descripcion: 'Ubicación del dispositivo, rutas y nivel de tráfico',
        soloSuperadmin: false
    },
    estadisticas: {
        titulo: 'Estadísticas',
        descripcion: 'Indicadores y estadísticas del sistema',
        soloSuperadmin: false
    },
    usuarios: {
        titulo: 'Gestión de usuarios',
        descripcion: 'Administra los usuarios autorizados del sistema',
        soloSuperadmin: true
    },
    configuracion: {
        titulo: 'Configuración',
        descripcion: 'Ajustes generales del sistema, del semáforo y de la cámara',
        soloSuperadmin: true
    }
};

/* Configuración por defecto del sistema. */
const CONFIGURACION_POR_DEFECTO = {
    nombreSistema: 'Semáforo+',
    ubicacion: 'Avenida Central',
    estadoSistema: 'operativo',
    intervalo: 1000,
    distanciaMinima: 30,
    distanciaMaxima: 120,
    tiempoMinimoVerde: 8,
    tiempoMinimoRojo: 8,
    modoPorDefecto: 'automatico',
    camaraNombre: 'Cámara Semáforo Principal',
    camaraEstado: 'activada',
    camaraCalidad: '1080p'
};

const DISTANCIA_INICIAL = 120;
const DISTANCIA_MINIMA_SIMULADA = 30;

/* Datos simulados de las estadísticas, por periodo. */
const DATOS_ESTADISTICAS = {
    hoy: {
        etiqueta: 'Hoy',
        multiplicador: 1,
        vehiculoTotal: null,          /* null = usar el contador dinámico */
        espera: '14 s',
        cambios: 6,
        horaPico: '18:00',
        porHora: [
            { etiqueta: '07:00', valor: 18 }, { etiqueta: '09:00', valor: 42 },
            { etiqueta: '11:00', valor: 34 }, { etiqueta: '13:00', valor: 28 },
            { etiqueta: '15:00', valor: 46 }, { etiqueta: '18:00', valor: 82 },
            { etiqueta: '20:00', valor: 61 }
        ],
        semanal: [
            { etiqueta: 'Lun', valor: 62 }, { etiqueta: 'Mar', valor: 74 },
            { etiqueta: 'Mié', valor: 58 }, { etiqueta: 'Jue', valor: 86 },
            { etiqueta: 'Vie', valor: 71 }, { etiqueta: 'Sáb', valor: 48 },
            { etiqueta: 'Dom', valor: 33 }
        ],
        tiempos: { rojo: 46, amarillo: 12, verde: 42 },
        trafico: [
            { zona: 'Avenida Central', nivel: 'moderado', porcentaje: 68 },
            { zona: 'Calle Norte', nivel: 'normal', porcentaje: 34 },
            { zona: 'Cruce Costanera', nivel: 'intenso', porcentaje: 88 },
            { zona: 'Ronda Este', nivel: 'normal', porcentaje: 22 },
            { zona: 'Sensor 4 (sin conexión)', nivel: 'desconectado', porcentaje: 0 }
        ]
    },
    semana: {
        etiqueta: 'Esta semana',
        multiplicador: 7,
        vehiculoTotal: 168,
        espera: '16 s',
        cambios: 42,
        horaPico: '18:00',
        porHora: [
            { etiqueta: '07:00', valor: 55 }, { etiqueta: '09:00', valor: 88 },
            { etiqueta: '11:00', valor: 70 }, { etiqueta: '13:00', valor: 62 },
            { etiqueta: '15:00', valor: 79 }, { etiqueta: '18:00', valor: 96 },
            { etiqueta: '20:00', valor: 74 }
        ],
        semanal: [
            { etiqueta: 'Lun', valor: 70 }, { etiqueta: 'Mar', valor: 84 },
            { etiqueta: 'Mié', valor: 66 }, { etiqueta: 'Jue', valor: 92 },
            { etiqueta: 'Vie', valor: 80 }, { etiqueta: 'Sáb', valor: 55 },
            { etiqueta: 'Dom', valor: 40 }
        ],
        tiempos: { rojo: 48, amarillo: 11, verde: 41 },
        trafico: [
            { zona: 'Avenida Central', nivel: 'intenso', porcentaje: 82 },
            { zona: 'Calle Norte', nivel: 'moderado', porcentaje: 55 },
            { zona: 'Cruce Costanera', nivel: 'intenso', porcentaje: 94 },
            { zona: 'Ronda Este', nivel: 'normal', porcentaje: 38 },
            { zona: 'Sensor 4 (sin conexión)', nivel: 'desconectado', porcentaje: 0 }
        ]
    },
    mes: {
        etiqueta: 'Este mes',
        multiplicador: 30,
        vehiculoTotal: 721,
        espera: '15 s',
        cambios: 168,
        horaPico: '18:00',
        porHora: [
            { etiqueta: '07:00', valor: 48 }, { etiqueta: '09:00', valor: 76 },
            { etiqueta: '11:00', valor: 65 }, { etiqueta: '13:00', valor: 54 },
            { etiqueta: '15:00', valor: 72 }, { etiqueta: '18:00', valor: 92 },
            { etiqueta: '20:00', valor: 68 }
        ],
        semanal: [
            { etiqueta: 'Sem 1', valor: 64 }, { etiqueta: 'Sem 2', valor: 78 },
            { etiqueta: 'Sem 3', valor: 58 }, { etiqueta: 'Sem 4', valor: 88 },
            { etiqueta: 'Sem 5', valor: 74 }
        ],
        tiempos: { rojo: 45, amarillo: 13, verde: 42 },
        trafico: [
            { zona: 'Avenida Central', nivel: 'moderado', porcentaje: 72 },
            { zona: 'Calle Norte', nivel: 'normal', porcentaje: 40 },
            { zona: 'Cruce Costanera', nivel: 'intenso', porcentaje: 90 },
            { zona: 'Ronda Este', nivel: 'moderado', porcentaje: 58 },
            { zona: 'Sensor 4 (sin conexión)', nivel: 'desconectado', porcentaje: 0 }
        ]
    }
};

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const NOMBRES_COLOR = { rojo: 'Rojo', amarillo: 'Amarillo', verde: 'Verde' };
const TIPOS_TOAST = ['exito', 'advertencia', 'error', 'info'];

/* ========================= 2. ESTADO CENTRAL ============================ */

const estadoAplicacion = {
    usuarioId: null,
    usuarioActual: null,
    nombreActual: null,
    rolActual: null,
    rolCodigo: null,
    seccionActual: 'dashboard',
    colorSemaforo: 'rojo',
    distancia: DISTANCIA_INICIAL,
    vehiculoDetectado: false,
    modo: 'automatico',
    vehiculosDetectados: 24,
    alertas: 0,
    camaraConectada: true,
    usuarios: [],
    configuracion: {}
};

/* Estado auxiliar interno del prototipo (no forma parte del modelo de datos real). */
const auxiliar = {
    actividades: [],
    notificaciones: [],
    ultimaLectura: null,
    cambiosColor: 0,
    contadorAplicado: false,
    intervaloDistancia: null,
    temporizadorAmarillo: null,
    sonidoCamara: false,
    vehiculosEnVista: 5,
    intervaloReloj: null
};

/* ======================== 3. UTILIDADES DE DOM ========================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.prototype.slice.call(document.querySelectorAll(selector));
const porId = (id) => document.getElementById(id);

function setTexto(id, valor) {
    const elemento = porId(id);
    if (elemento) { elemento.textContent = valor; }
}

function setHTML(id, valor) {
    const elemento = porId(id);
    if (elemento) { elemento.innerHTML = valor; }
}

/* Tiempo */
function dosDigitos(valor) { return valor < 10 ? '0' + valor : String(valor); }

function horaActual() {
    const ahora = new Date();
    return dosDigitos(ahora.getHours()) + ':' + dosDigitos(ahora.getMinutes()) + ':' + dosDigitos(ahora.getSeconds());
}

function horaCorta() {
    const ahora = new Date();
    return dosDigitos(ahora.getHours()) + ':' + dosDigitos(ahora.getMinutes());
}

function fechaActual() {
    const ahora = new Date();
    return DIAS_SEMANA[ahora.getDay()] + ', ' + ahora.getDate() + ' de ' + MESES[ahora.getMonth()] +
        ' de ' + ahora.getFullYear();
}

function iniciales(nombre) {
    if (!nombre) { return '—'; }
    const partes = String(nombre).trim().split(/\s+/);
    if (partes.length === 1) { return partes[0].slice(0, 2).toUpperCase(); }
    return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
}

/* ============================ 4. SESIÓN ================================= */

/* Inicia sesión contra el backend: el servidor decide si las credenciales valen. */
function iniciarSesion() {
    const campoUsuario = porId('campo-usuario');
    const campoClave = porId('campo-contrasena');
    const mensaje = porId('mensaje-login');
    const boton = porId('boton-login');

    const usuario = campoUsuario ? campoUsuario.value.trim() : '';
    const clave = campoClave ? campoClave.value : '';

    if (mensaje) { mensaje.textContent = ''; }

    if (usuario === '' || clave === '') {
        if (mensaje) { mensaje.textContent = 'Completa todos los campos.'; }
        mostrarNotificacion('Completa todos los campos.', 'error');
        if (!usuario && campoUsuario) { campoUsuario.focus(); }
        return;
    }

    if (boton) {
        boton.classList.add('cargando');
        boton.disabled = true;
    }

    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuario, clave: clave })
    }).then(function (respuesta) {
        return respuesta.json().catch(function () { return {}; }).then(function (cuerpo) {
            if (!respuesta.ok) {
                throw new Error(cuerpo.mensaje || 'No se pudo iniciar sesión.');
            }
            return cuerpo;
        });
    }).then(function (sesion) {
        if (campoClave) { campoClave.value = ''; }
        if (mensaje) { mensaje.textContent = ''; }

        aplicarSesion(sesion);
        mostrarPantallaAplicacion();
        mostrarNotificacion('Sesión iniciada correctamente.', 'exito');
    }).catch(function (error) {
        if (mensaje) { mensaje.textContent = error.message; }
        mostrarNotificacion(error.message, 'error');
        if (campoClave) { campoClave.select(); }
    }).finally(function () {
        if (boton) {
            boton.classList.remove('cargando');
            boton.disabled = false;
        }
    });
}

/* Guarda en memoria la sesión que devuelve el servidor y avisa a conexion.js. */
function aplicarSesion(sesion) {
    estadoAplicacion.usuarioId = sesion.id;
    estadoAplicacion.usuarioActual = sesion.usuario;
    estadoAplicacion.nombreActual = sesion.nombre;
    estadoAplicacion.rolActual = sesion.rol;
    estadoAplicacion.rolCodigo = sesion.rolCodigo;
    auxiliar.ultimaLectura = horaActual();

    document.dispatchEvent(new CustomEvent('semaforoplus:sesion-iniciada', { detail: sesion }));
}

/* Pregunta al servidor si la cookie de sesión sigue siendo válida. */
function verificarSesion() {
    fetch('/api/auth/yo', { cache: 'no-store' })
        .then(function (respuesta) {
            /* 204 = no hay sesión abierta. */
            if (respuesta.status === 204) { return null; }
            if (!respuesta.ok) { throw new Error('sin sesión'); }
            return respuesta.json();
        })
        .then(function (sesion) {
            if (!sesion) {
                mostrarPantallaLogin();
                return;
            }
            aplicarSesion(sesion);
            mostrarPantallaAplicacion();
        })
        .catch(function () {
            mostrarPantallaLogin();
        });
}

function mostrarPantallaLogin() {
    const login = porId('pantalla-login');
    const app = porId('aplicacion');
    if (login) { login.removeAttribute('hidden'); }
    if (app) { app.setAttribute('hidden', ''); }
}

function mostrarPantallaAplicacion() {
    const login = porId('pantalla-login');
    const app = porId('aplicacion');
    if (login) { login.setAttribute('hidden', ''); }
    if (app) { app.removeAttribute('hidden'); }

    actualizarBarraUsuario();

    aplicarPermisos();
    if (esSuperadministrador()) { cargarUsuarios(); }
    cargarConfiguracion();
    renderizarEstadisticas('hoy');
    actualizarDashboard();
    const nombre = estadoAplicacion.nombreActual || 'Usuario';
    agregarActividad('Sistema iniciado. Sesión de ' + nombre + '.');
    cambiarSeccion('dashboard');
    actualizarHora();
}

/* Pinta el nombre, el rol y las iniciales de la persona conectada. */
function actualizarBarraUsuario() {
    const nombre = estadoAplicacion.nombreActual || 'Usuario';
    const rol = estadoAplicacion.rolActual || '';

    setTexto('nombre-usuario-menu', nombre);
    setTexto('rol-usuario-menu', rol);
    setTexto('nombre-usuario-barra', nombre);
    setTexto('rol-usuario-barra', rol);
    setTexto('avatar-menu', iniciales(nombre));
    setTexto('avatar-barra', iniciales(nombre));
}

/* Cierra la sesión en el servidor y vuelve al login. */
function cerrarSesion() {
    fetch('/api/auth/logout', { method: 'POST' }).catch(function () {
        /* Si el servidor no responde, igual se limpia la interfaz. */
    });

    detenerAnimacionDistancia();
    if (auxiliar.temporizadorAmarillo) {
        window.clearTimeout(auxiliar.temporizadorAmarillo);
        auxiliar.temporizadorAmarillo = null;
    }

    estadoAplicacion.usuarioId = null;
    estadoAplicacion.usuarioActual = null;
    estadoAplicacion.nombreActual = null;
    estadoAplicacion.rolActual = null;
    estadoAplicacion.rolCodigo = null;
    estadoAplicacion.seccionActual = 'dashboard';
    estadoAplicacion.colorSemaforo = 'rojo';
    estadoAplicacion.distancia = DISTANCIA_INICIAL;
    estadoAplicacion.vehiculoDetectado = false;
    estadoAplicacion.modo = 'automatico';
    estadoAplicacion.vehiculosDetectados = 24;
    estadoAplicacion.alertas = 0;
    estadoAplicacion.camaraConectada = true;
    estadoAplicacion.usuarios = [];
    auxiliar.actividades = [];
    auxiliar.notificaciones = [];
    auxiliar.contadorAplicado = false;
    auxiliar.cambiosColor = 0;

    cerrarMenuMovil();
    cerrarModalUsuario();
    if (porId('panel-notificaciones')) { porId('panel-notificaciones').setAttribute('hidden', ''); }
    limpiarZonaNotificaciones();

    const campoUsuario = porId('campo-usuario');
    const campoClave = porId('campo-contrasena');
    if (campoUsuario) { campoUsuario.value = ''; }
    if (campoClave) { campoClave.value = ''; }
    setTexto('mensaje-login', 'Sesión cerrada correctamente.');

    document.dispatchEvent(new CustomEvent('semaforoplus:sesion-cerrada'));

    mostrarPantallaLogin();
    mostrarNotificacion('Sesión cerrada correctamente.', 'info');
    if (campoUsuario) { campoUsuario.focus(); }
}

/* ==================== 5. PERMISOS Y NAVEGACIÓN ========================== */

function esSuperadministrador() {
    return estadoAplicacion.rolActual === 'Superadministrador';
}

function seccionPermitida(seccion) {
    const definicion = SECCIONES[seccion];
    if (!definicion) { return false; }
    if (definicion.soloSuperadmin && !esSuperadministrador()) { return false; }
    return true;
}

/* Muestra u oculta las secciones restringidas según el rol conectado. */
function aplicarPermisos() {
    const superadmin = esSuperadministrador();
    $$('.nav-restringido').forEach(function (item) {
        if (superadmin) {
            item.removeAttribute('hidden');
        } else {
            item.setAttribute('hidden', '');
            const seccion = item.getAttribute('data-seccion');
            if (estadoAplicacion.seccionActual === seccion) {
                estadoAplicacion.seccionActual = 'dashboard';
            }
        }
    });

    if (!superadmin) {
        ['usuarios', 'configuracion'].forEach(function (seccion) {
            const panel = porId('seccion-' + seccion);
            if (panel) { panel.setAttribute('hidden', ''); panel.classList.remove('activa'); }
        });
        const panelDashboard = porId('seccion-dashboard');
        if (panelDashboard) { panelDashboard.classList.add('activa'); }
    }
}

/* Navegación dinámica entre secciones (sin recargar la página). */
function cambiarSeccion(seccion) {
    if (!SECCIONES[seccion]) {
        mostrarNotificacion('Sección no encontrada.', 'error');
        return;
    }

    if (!seccionPermitida(seccion)) {
        mostrarNotificacion('No tienes permisos para acceder a esta sección.', 'error');
        cambiarSeccion('dashboard');
        return;
    }

    estadoAplicacion.seccionActual = seccion;

    if (seccion === 'usuarios') { cargarUsuarios(); }

    $$('.seccion').forEach(function (panel) {
        const activo = panel.id === 'seccion-' + seccion;
        panel.classList.toggle('activa', activo);
        if (activo) {
            panel.removeAttribute('hidden');
        } else {
            panel.setAttribute('hidden', '');
        }
    });

    $$('.nav-item').forEach(function (item) {
        item.classList.toggle('activo', item.getAttribute('data-seccion') === seccion);
    });

    const definicion = SECCIONES[seccion];
    setTexto('titulo-seccion', definicion.titulo);
    setTexto('descripcion-seccion', definicion.descripcion);

    cerrarMenuMovil();
    if (porId('contenido')) { porId('contenido').scrollTop = 0; }
}

/* ================= 6. SEMÁFORO: MODOS, COLOR Y SENSOR ================== */

/* Aplica en la interfaz el color actual del semáforo. */
function actualizarSemaforo() {
    const color = estadoAplicacion.colorSemaforo;
    const nombre = NOMBRES_COLOR[color] || 'Rojo';

    /* Semáforo grande */
    ['rojo', 'amarillo', 'verde'].forEach(function (clave) {
        const luz = porId('luz-' + clave);
        if (luz) { luz.classList.toggle('activa', clave === color); }
    });

    /* Semáforo pequeño del dashboard */
    $$('#mini-semaforo .mini-luz').forEach(function (luz) {
        luz.classList.toggle('activa', luz.getAttribute('data-color') === color);
    });

    /* Semáforo dentro de la escena de la cámara */
    $$('#semaforo-calle .luz-calle').forEach(function (luz) {
        const clave = luz.classList.contains('lc-r') ? 'rojo'
            : (luz.classList.contains('lc-a') ? 'amarillo' : 'verde');
        luz.classList.toggle('activa', clave === color);
    });

    /* Texto de estado y patrón */
    setHTML('estado-actual', 'Estado actual: <strong>' + nombre + '</strong>');

    const barra = porId('barra-patron');
    if (barra) {
        barra.className = 'barra-patron-relleno ' + color;
        barra.style.width = '100%';
    }
    setTexto('patron-texto', PATRONES[color]);

    /* Datos del dispositivo */
    setTexto('info-estado', 'Operativo');
    setTexto('info-conexion', 'Conectado');

    /* Datos del sensor */
    setTexto('sensor-distancia', estadoAplicacion.distancia + ' cm');
    setTexto('sensor-vehiculo', estadoAplicacion.vehiculoDetectado ? 'Sí' : 'No');
    setTexto('sensor-lectura', auxiliar.ultimaLectura || '—');
    setTexto('sensor-conexion', 'Conectado');

    /* Insignias de modo y de estado */
    const insigniaModo = porId('insignia-modo');
    if (insigniaModo) {
        insigniaModo.textContent = estadoAplicacion.modo === 'automatico' ? 'Automático' : 'Manual';
        insigniaModo.className = 'insignia ' + (estadoAplicacion.modo === 'automatico' ? 'insignia-info' : 'insignia-alerta');
    }
    const insigniaLuz = porId('dash-estado-luz');
    if (insigniaLuz) { insigniaLuz.textContent = nombre; }

    actualizarDashboard();
    actualizarMapa();
}

const PATRONES = {
    verde: 'Vehículo en espera — el semáforo permanece en verde',
    amarillo: 'Cambio de fase — el semáforo está en amarillo',
    rojo: 'Vía libre — el semáforo permanece en rojo'
};

/* Cambia el color del semáforo respetando el modo de operación. */
function cambiarColor(color, opciones) {
    const automatico = Boolean(opciones && opciones.automatico);

    if (!NOMBRES_COLOR[color]) {
        mostrarNotificacion('Color no válido.', 'error');
        return false;
    }

    /* Validación: el control manual no existe en modo automático */
    if (estadoAplicacion.modo === 'automatico' && !automatico) {
        mostrarNotificacion('El control manual está deshabilitado en modo automático.', 'advertencia');
        return false;
    }

    if (estadoAplicacion.colorSemaforo === color) {
        return true;
    }

    estadoAplicacion.colorSemaforo = color;
    auxiliar.cambiosColor += 1;
    auxiliar.ultimaLectura = horaActual();
    actualizarSemaforo();
    agregarActividad('Semáforo cambiado a ' + NOMBRES_COLOR[color].toLowerCase() + '.');
    mostrarNotificacion('Semáforo cambiado a ' + NOMBRES_COLOR[color].toLowerCase() + '.', 'info');
    return true;
}

/* Cambia entre modo automático y modo manual. */
function cambiarModo(modo) {
    if (modo !== 'automatico' && modo !== 'manual') {
        mostrarNotificacion('Modo no válido.', 'error');
        return;
    }

    if (estadoAplicacion.modo === modo) {
        mostrarNotificacion('El modo ' + (modo === 'automatico' ? 'automático' : 'manual') + ' ya está activo.', 'advertencia');
        return;
    }

    estadoAplicacion.modo = modo;

    if (modo === 'automatico') {
        /* En automático el sistema decide el color según el sensor */
        aplicarColorAutomatico(true);
        agregarActividad('Modo automático activado.');
        mostrarNotificacion('Modo automático activado.', 'exito');
        setTexto('info-modo-ayuda', 'El sistema controla el semáforo automáticamente.');
    } else {
        agregarActividad('Modo manual activado.');
        mostrarNotificacion('Modo manual activado.', 'advertencia');
        setTexto('info-modo-ayuda', 'El control manual está habilitado.');
    }

    actualizarControlesModo();
    actualizarSemaforo();
}

/* Elige el color que corresponde al estado del sensor (solo modo automático). */
function aplicarColorAutomatico(forzar) {
    const colorDeseado = estadoAplicacion.vehiculoDetectado ? 'verde' : 'rojo';
    if (estadoAplicacion.colorSemaforo === colorDeseado && !forzar) {
        return;
    }

    /* Fase de transición en amarillo para que el cambio sea visible */
    if (estadoAplicacion.colorSemaforo !== colorDeseado && forzar === 'transicion') {
        /* reservado */
    }

    estadoAplicacion.colorSemaforo = colorDeseado;
    auxiliar.cambiosColor += 1;
    auxiliar.ultimaLectura = horaActual();
}

/* Habilita o deshabilita los botones según el modo. */
function actualizarControlesModo() {
    const manual = estadoAplicacion.modo === 'manual';

    const btnAutomatico = porId('btn-modo-automatico');
    const btnManual = porId('btn-modo-manual');
    if (btnAutomatico) { btnAutomatico.classList.toggle('activo', !manual); }
    if (btnManual) { btnManual.classList.toggle('activo', manual); }

    $$('.btn-manual').forEach(function (boton) {
        boton.disabled = !manual;
    });
}

/* Anima la distancia del sensor de forma progresiva. */
function animarDistancia(destino, alFinalizar) {
    detenerAnimacionDistancia();

    const inicio = estadoAplicacion.distancia;
    const pasos = 16;
    let paso = 0;

    auxiliar.intervaloDistancia = window.setInterval(function () {
        paso += 1;
        const avance = paso / pasos;
        estadoAplicacion.distancia = Math.round(inicio + (destino - inicio) * avance);
        auxiliar.ultimaLectura = horaActual();
        actualizarSemaforo();

        if (paso >= pasos) {
            estadoAplicacion.distancia = destino;
            detenerAnimacionDistancia();
            actualizarSemaforo();
            if (typeof alFinalizar === 'function') { alFinalizar(); }
        }
    }, 55);
}

function detenerAnimacionDistancia() {
    if (auxiliar.intervaloDistancia) {
        window.clearInterval(auxiliar.intervaloDistancia);
        auxiliar.intervaloDistancia = null;
    }
}

/* --- Acciones del sensor simulado --- */

/* Vehículo acercándose: la distancia baja de 120 cm a 30 cm. */
function simularVehiculoAcercandose() {
    if (estadoAplicacion.modo === 'manual' && estadoAplicacion.vehiculoDetectado) {
        mostrarNotificacion('El sensor ya detecta un vehículo.', 'advertencia');
        return;
    }

    mostrarNotificacion('Simulando vehículo acercándose...', 'info');

    animarDistancia(DISTANCIA_MINIMA_SIMULADA, function () {
        estadoAplicacion.vehiculoDetectado = true;

        /* El contador de vehículos sube UNA sola vez por detección */
        if (!auxiliar.contadorAplicado) {
            estadoAplicacion.vehiculosDetectados += 1;
            auxiliar.contadorAplicado = true;
        }

        if (estadoAplicacion.modo === 'automatico') {
            cambiarColor('verde', { automatico: true });
            mostrarNotificacion('Vehículo detectado: semáforo en verde.', 'exito');
        } else {
            mostrarNotificacion('Vehículo detectado a ' + DISTANCIA_MINIMA_SIMULADA + ' cm (modo manual activo).', 'advertencia');
        }

        agregarActividad('Vehículo detectado a ' + DISTANCIA_MINIMA_SIMULADA + ' cm.');
        actualizarDashboard();
    });
}

/* Vehículo alejándose: la distancia sube de 30 cm a 120 cm. */
function simularVehiculoAlejandose() {
    if (!estadoAplicacion.vehiculoDetectado && estadoAplicacion.distancia >= DISTANCIA_INICIAL) {
        mostrarNotificacion('La vía ya está libre.', 'advertencia');
        return;
    }

    mostrarNotificacion('Simulando vehículo alejándose...', 'info');

    animarDistancia(DISTANCIA_INICIAL, function () {
        estadoAplicacion.vehiculoDetectado = false;
        auxiliar.contadorAplicado = false;

        if (estadoAplicacion.modo === 'automatico') {
            cambiarColor('rojo', { automatico: true });
            mostrarNotificacion('Vía libre: semáforo en rojo.', 'info');
        } else {
            mostrarNotificacion('Vía libre: el color se mantiene por control manual.', 'info');
        }

        agregarActividad('El vehículo se alejó del sensor.');
        actualizarDashboard();
    });
}

/* Vía libre: estado base del sistema. */
function simularViaLibre() {
    detenerAnimacionDistancia();

    estadoAplicacion.distancia = DISTANCIA_INICIAL;
    estadoAplicacion.vehiculoDetectado = false;
    auxiliar.contadorAplicado = false;
    auxiliar.ultimaLectura = horaActual();

    if (estadoAplicacion.modo === 'automatico') {
        cambiarColor('rojo', { automatico: true });
        mostrarNotificacion('Vía libre: semáforo en rojo.', 'info');
    } else {
        mostrarNotificacion('Vía libre simulada. El color se mantiene por control manual.', 'info');
    }

    agregarActividad('Vía libre: sin vehículos en el rango de detección.');
    actualizarSemaforo();
}

/* Restablece por completo la simulación del semáforo. */
function restablecerSimulacion() {
    detenerAnimacionDistancia();
    if (auxiliar.temporizadorAmarillo) {
        window.clearTimeout(auxiliar.temporizadorAmarillo);
        auxiliar.temporizadorAmarillo = null;
    }

    estadoAplicacion.colorSemaforo = 'rojo';
    estadoAplicacion.distancia = DISTANCIA_INICIAL;
    estadoAplicacion.vehiculoDetectado = false;
    estadoAplicacion.modo = 'automatico';
    auxiliar.contadorAplicado = false;
    auxiliar.ultimaLectura = horaActual();

    setTexto('info-modo-ayuda', 'El sistema controla el semáforo automáticamente.');
    actualizarControlesModo();
    actualizarSemaforo();
    agregarActividad('Sensor restablecido a valores iniciales.');
    mostrarNotificacion('Sensor restablecido.', 'info');
}

/* ============= 7. DASHBOARD, MAPA Y CÁMARA SIMULADOS =================== */

function actualizarDashboard() {
    setTexto('valor-semaforos', '1');
    setTexto('valor-vehiculos', String(estadoAplicacion.vehiculosDetectados));
    setTexto('valor-camaras', estadoAplicacion.camaraConectada ? '1' : '0');

    /* Alertas simuladas: solo existe una cuando el control manual
       choca con un vehículo detectado. */
    estadoAplicacion.alertas = (estadoAplicacion.modo === 'manual' && estadoAplicacion.vehiculoDetectado) ? 1 : 0;
    setTexto('valor-alertas', String(estadoAplicacion.alertas));

    const insignia = porId('insignia-alertas');
    if (insignia) {
        insignia.textContent = estadoAplicacion.alertas > 0 ? 'Requiere atención' : 'Sin alertas';
        insignia.className = 'insignia ' + (estadoAplicacion.alertas > 0 ? 'insignia-alerta' : 'insignia-exito');
    }

    setTexto('estado-general', 'Operativo');
    setTexto('estado-dispositivo', 'Semáforo Principal');
    setTexto('estado-conexion', 'En línea');
    setTexto('estado-actualizacion', auxiliar.ultimaLectura || horaActual());
    setTexto('estado-modo', estadoAplicacion.modo === 'automatico' ? 'Automático' : 'Manual');

    setTexto('dash-color', NOMBRES_COLOR[estadoAplicacion.colorSemaforo]);
    setTexto('dash-distancia', estadoAplicacion.distancia + ' cm');
    setTexto('dash-vehiculo', estadoAplicacion.vehiculoDetectado ? 'Sí' : 'No');
    setTexto('dash-modo', estadoAplicacion.modo === 'automatico' ? 'Automático' : 'Manual');
    setTexto('dash-lectura', auxiliar.ultimaLectura || '—');

    auxiliar.vehiculosEnVista = 3 + (estadoAplicacion.vehiculosDetectados % 6);
    setTexto('vehiculos-en-vista', auxiliar.vehiculosEnVista + ' vehículos en vista');

    if (porId('contador-actividad')) {
        setTexto('contador-actividad', auxiliar.actividades.length + ' eventos');
    }
}

function actualizarMapa() {
    setTexto('mapa-ubicacion', estadoAplicacion.configuracion.ubicacion || 'Avenida Central');
    setTexto('mapa-semaforo', 'Semáforo Principal');
    setTexto('mapa-estado', 'Operativo');
    setTexto('mapa-trafico', estadoAplicacion.vehiculoDetectado ? 'Intenso' : 'Moderado');
    setTexto('mapa-vehiculos', String(estadoAplicacion.vehiculosDetectados));
    setTexto('mapa-actualizacion', auxiliar.ultimaLectura || horaActual());
}

/* Cámara simulada: captura, pantalla completa y sonido. */
function capturarImagenSimulada() {
    const escena = porId('escena-camara');
    const flash = porId('flash-captura');

    if (flash) {
        flash.classList.add('activo');
        window.setTimeout(function () { flash.classList.remove('activo'); }, 220);
    }

    if (auxiliar.sonidoCamara) { reproducirPitidoSimulado(); }

    if (escena) { /* la escena sigue siendo un dibujo CSS, no una cámara real */ }

    agregarActividad('Captura simulada realizada a las ' + horaCorta() + '.');
    mostrarNotificacion('Captura simulada realizada.', 'exito');
}

function alternarPantallaCompleta() {
    const escena = porId('escena-camara');
    if (!escena) { return; }

    const sinFullscreen = !document.fullscreenElement && !escena.requestFullscreen;

    if (sinFullscreen) {
        mostrarNotificacion('Pantalla completa no disponible en este navegador.', 'advertencia');
        return;
    }

    try {
        if (!document.fullscreenElement) {
            const promesa = escena.requestFullscreen();
            if (promesa && typeof promesa.catch === 'function') {
                promesa.catch(function () {
                    mostrarNotificacion('El navegador bloqueó la pantalla completa.', 'advertencia');
                });
            }
            mostrarNotificacion('Pantalla completa activada.', 'info');
        } else if (typeof document.exitFullscreen === 'function') {
            const promesa = document.exitFullscreen();
            if (promesa && typeof promesa.catch === 'function') { promesa.catch(function () { }); }
        }
    } catch (error) {
        mostrarNotificacion('Pantalla completa no disponible.', 'advertencia');
    }
}

function alternarSonido() {
    auxiliar.sonidoCamara = !auxiliar.sonidoCamara;

    const boton = porId('btn-sonido');
    if (boton) {
        boton.textContent = auxiliar.sonidoCamara ? 'Desactivar sonido' : 'Activar sonido';
    }
    setTexto('estado-sonido', auxiliar.sonidoCamara
        ? 'Sonido activado: se emite un aviso al capturar.'
        : 'Sonido desactivado.');

    mostrarNotificacion(auxiliar.sonidoCamara ? 'Sonido de cámara activado.' : 'Sonido de cámara desactivado.', 'info');
}

/* Pitido corto generado con la Web Audio API (sin archivos externos). */
function reproducirPitidoSimulado() {
    try {
        const Contexto = window.AudioContext || window.webkitAudioContext;
        if (!Contexto) { return; }
        const contexto = new Contexto();
        const oscilador = contexto.createOscillator();
        const volumen = contexto.createGain();
        oscilador.type = 'sine';
        oscilador.frequency.value = 880;
        volumen.gain.value = 0.05;
        oscilador.connect(volumen);
        volumen.connect(contexto.destination);
        oscilador.start();
        oscilador.stop(contexto.currentTime + 0.12);
        window.setTimeout(function () {
            if (typeof contexto.close === 'function') { contexto.close(); }
        }, 400);
    } catch (error) {
        /* el audio no es esencial para el prototipo */
    }
}

/* ==================== 8. ESTADÍSTICAS SIMULADAS ========================= */

function renderizarEstadisticas(periodo) {
    const datos = DATOS_ESTADISTICAS[periodo] || DATOS_ESTADISTICAS.hoy;

    const total = datos.vehiculoTotal === null || datos.vehiculoTotal === undefined
        ? estadoAplicacion.vehiculosDetectados
        : datos.vehiculoTotal;

    setTexto('stat-vehiculos', String(total));
    setTexto('stat-vehiculos-pie', 'Historial del periodo · ' + datos.etiqueta.toLowerCase());
    setTexto('stat-espera', datos.espera);
    setTexto('stat-cambios', String(auxiliar.cambiosColor + datos.cambios));
    setTexto('stat-hora-pico', datos.horaPico);

    renderizarBarras('grafico-vehiculos', datos.porHora, datos.horaPico);
    renderizarBarras('grafico-semanal', datos.semanal, null);
    renderizarDonut(datos.tiempos);
    renderizarTrafico(datos.trafico);
}

function renderizarBarras(idContenedor, datos, destacado) {
    const contenedor = porId(idContenedor);
    if (!contenedor) { return; }

    const maximo = datos.reduce(function (acumulado, item) {
        return Math.max(acumulado, item.valor);
    }, 0) || 1;

    contenedor.innerHTML = datos.map(function (item) {
        const altura = Math.round((item.valor / maximo) * 100);
        const clase = destacado && item.etiqueta === destacado ? ' barra-item destacada' : ' barra-item';
        return '<div class="' + clase + '">' +
            '<div class="barra" style="--h:' + altura + '%"></div>' +
            '<span class="barra-etiqueta">' + item.etiqueta + '</span>' +
            '</div>';
    }).join('');
}

function renderizarDonut(tiempos) {
    const donut = porId('grafico-tiempos');
    if (donut) {
        donut.style.background = 'conic-gradient(' +
            'var(--color-rojo) 0 ' + tiempos.rojo + '%, ' +
            'var(--color-amarillo) ' + tiempos.rojo + '% ' + (tiempos.rojo + tiempos.amarillo) + '%, ' +
            'var(--color-verde) ' + (tiempos.rojo + tiempos.amarillo) + '% 100%)';
    }
    setTexto('donut-rojo', tiempos.rojo + '%');
    setTexto('donut-amarillo', tiempos.amarillo + '%');
    setTexto('donut-verde', tiempos.verde + '%');
    setTexto('donut-total', (tiempos.rojo + tiempos.amarillo + tiempos.verde) + '%');
}

function renderizarTrafico(lista) {
    const contenedor = porId('grafico-trafico');
    if (!contenedor) { return; }

    const colores = { normal: 'verde', moderado: 'amarillo', intenso: 'rojo', desconectado: 'gris' };

    contenedor.innerHTML = lista.map(function (item) {
        return '<li class="barra-h-item">' +
            '<div class="barra-h-cabecera"><span>' + item.zona + '</span><span>' + item.porcentaje + '%</span></div>' +
            '<div class="barra-h"><div class="barra-h-relleno ' + (colores[item.nivel] || 'gris') +
            '" style="--h:' + item.porcentaje + '%"></div></div>' +
            '</li>';
    }).join('');
}

/* ====================== 9. GESTIÓN DE USUARIOS ========================== */

/* Carga los usuarios desde el backend (solo el superadministrador puede). */
function cargarUsuarios() {
    if (!esSuperadministrador()) {
        estadoAplicacion.usuarios = [];
        renderizarUsuarios();
        return;
    }

    fetch('/api/usuarios', { cache: 'no-store' })
        .then(function (respuesta) {
            if (!respuesta.ok) { throw new Error('No se pudo cargar la lista de usuarios.'); }
            return respuesta.json();
        })
        .then(function (usuarios) {
            estadoAplicacion.usuarios = usuarios;
            renderizarUsuarios();
        })
        .catch(function (error) {
            estadoAplicacion.usuarios = [];
            renderizarUsuarios();
            mostrarNotificacion(error.message, 'advertencia');
        });
}

function renderizarUsuarios() {
    const cuerpo = porId('tabla-usuarios');
    if (!cuerpo) { return; }

    setTexto('total-usuarios', estadoAplicacion.usuarios.length + ' usuarios');

    if (estadoAplicacion.usuarios.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="6" class="vacio-tabla">No hay usuarios registrados.</td></tr>';
        return;
    }

    cuerpo.innerHTML = estadoAplicacion.usuarios.map(function (usuario) {
        const insignia = usuario.estado === 'Activo' ? 'insignia-exito' : 'insignia-info';
        return '<tr data-id="' + usuario.id + '">' +
            '<td>' + escaparTexto(usuario.nombre) + '</td>' +
            '<td>' + escaparTexto(usuario.usuario) + '</td>' +
            '<td>' + escaparTexto(usuario.rol) + '</td>' +
            '<td><span class="insignia ' + insignia + '">' + escaparTexto(usuario.estado) + '</span></td>' +
            '<td>' + escaparTexto(usuario.ultimoAcceso) + '</td>' +
            '<td><div class="acciones">' +
            '<button type="button" class="boton-mini" data-accion="editar" data-id="' + usuario.id + '">Editar</button>' +
            '<button type="button" class="boton-mini peligro" data-accion="eliminar" data-id="' + usuario.id + '">Eliminar</button>' +
            '</div></td>' +
            '</tr>';
    }).join('');
}

/* Evita inyección de HTML en los datos escritos en la tabla. */
function escaparTexto(valor) {
    return String(valor === undefined || valor === null ? '' : valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function abrirModalUsuario(usuario) {
    const modal = porId('modal-usuario');
    if (!modal) { return; }

    const campoClave = porId('usuario-clave');

    if (usuario) {
        setTexto('modal-usuario-titulo', 'Editar usuario');
        porId('usuario-id').value = usuario.id;
        porId('usuario-nombre').value = usuario.nombre;
        porId('usuario-username').value = usuario.usuario;
        porId('usuario-rol').value = usuario.rol;
        porId('usuario-estado').value = usuario.estado;

        if (campoClave) {
            campoClave.value = '';
            campoClave.placeholder = 'Dejar vacío para conservar la actual';
        }
    } else {
        setTexto('modal-usuario-titulo', 'Nuevo usuario');
        porId('usuario-id').value = '';
        porId('usuario-nombre').value = '';
        porId('usuario-username').value = '';
        porId('usuario-rol').value = 'Administrador';
        porId('usuario-estado').value = 'Activo';

        if (campoClave) {
            campoClave.value = '';
            campoClave.placeholder = 'Mínimo 6 caracteres';
        }
    }

    setTexto('modal-error', '');
    modal.removeAttribute('hidden');
    const campoNombre = porId('usuario-nombre');
    if (campoNombre) { campoNombre.focus(); }
}

function cerrarModalUsuario() {
    const modal = porId('modal-usuario');
    if (modal) { modal.setAttribute('hidden', ''); }
}

/* Valida los datos del formulario antes de enviarlos al servidor. */
function validarUsuario(datos) {
    if (!datos.nombre) { return 'Completa el nombre del usuario.'; }
    if (!datos.usuario) { return 'Completa el nombre de acceso.'; }
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(datos.usuario)) {
        return 'El nombre de acceso debe tener entre 3 y 40 caracteres (letras, números, . _ -).';
    }

    const repetido = estadoAplicacion.usuarios.some(function (usuario) {
        return usuario.usuario.toLowerCase() === datos.usuario.toLowerCase() &&
            String(usuario.id) !== String(datos.id);
    });
    if (repetido) { return 'Ese nombre de acceso ya está en uso.'; }

    if (datos.rol !== 'Administrador' && datos.rol !== 'Superadministrador') {
        return 'Selecciona un rol válido.';
    }
    if (datos.estado !== 'Activo' && datos.estado !== 'Inactivo') {
        return 'Selecciona un estado válido.';
    }

    if (datos.clave) {
        if (datos.clave.length < 6) { return 'La contraseña debe tener al menos 6 caracteres.'; }
        if (datos.clave.length > 60) { return 'La contraseña no puede superar los 60 caracteres.'; }
    } else if (!datos.id) {
        return 'Escribe una contraseña de al menos 6 caracteres.';
    }

    return '';
}

/* Envía el formulario a la API y devuelve el usuario guardado. */
function enviarUsuario(metodo, url, datos) {
    return fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nombre: datos.nombre,
            usuario: datos.usuario,
            clave: datos.clave,
            rol: datos.rol,
            activo: datos.estado === 'Activo'
        })
    }).then(function (respuesta) {
        return respuesta.json().catch(function () { return {}; }).then(function (cuerpo) {
            if (!respuesta.ok) {
                if (respuesta.status === 401) { mostrarPantallaLogin(); }
                throw new Error(cuerpo.mensaje || 'No se pudo guardar el usuario.');
            }
            return cuerpo;
        });
    });
}

/* Crea un usuario nuevo en el backend. */
function crearUsuario() {
    const datos = leerFormularioUsuario();
    const error = validarUsuario(datos);
    if (error) {
        setTexto('modal-error', error);
        mostrarNotificacion(error, 'error');
        return;
    }

    enviarUsuario('POST', '/api/usuarios', datos)
        .then(function (usuario) {
            estadoAplicacion.usuarios.push(usuario);
            renderizarUsuarios();
            cerrarModalUsuario();
            agregarActividad('Usuario creado: ' + usuario.nombre + ' (' + usuario.rol + ').');
            mostrarNotificacion('Usuario creado correctamente.', 'exito');
        })
        .catch(function (fallo) {
            setTexto('modal-error', fallo.message);
            mostrarNotificacion(fallo.message, 'error');
        });
}

/* Actualiza un usuario existente en el backend. */
function editarUsuario(id) {
    const usuario = estadoAplicacion.usuarios.find(function (item) {
        return String(item.id) === String(id);
    });
    if (!usuario) {
        mostrarNotificacion('Usuario no encontrado.', 'error');
        return;
    }

    const datos = leerFormularioUsuario();
    datos.id = id;

    const error = validarUsuario(datos);
    if (error) {
        setTexto('modal-error', error);
        mostrarNotificacion(error, 'error');
        return;
    }

    enviarUsuario('PUT', '/api/usuarios/' + encodeURIComponent(id), datos)
        .then(function (actualizado) {
            const indice = estadoAplicacion.usuarios.findIndex(function (item) {
                return String(item.id) === String(actualizado.id);
            });
            if (indice >= 0) { estadoAplicacion.usuarios[indice] = actualizado; }

            /* Si la persona editó su propia cuenta, se refresca la barra. */
            if (String(actualizado.id) === String(estadoAplicacion.usuarioId)) {
                estadoAplicacion.nombreActual = actualizado.nombre;
                estadoAplicacion.usuarioActual = actualizado.usuario;
                estadoAplicacion.rolActual = actualizado.rol;
                estadoAplicacion.rolCodigo = actualizado.rolCodigo;
                actualizarBarraUsuario();
                aplicarPermisos();
                if (!seccionPermitida(estadoAplicacion.seccionActual)) {
                    cambiarSeccion('dashboard');
                }
            }

            renderizarUsuarios();
            cerrarModalUsuario();
            agregarActividad('Usuario actualizado: ' + actualizado.nombre + '.');
            mostrarNotificacion('Usuario actualizado correctamente.', 'exito');
        })
        .catch(function (fallo) {
            setTexto('modal-error', fallo.message);
            mostrarNotificacion(fallo.message, 'error');
        });
}

/* Elimina un usuario. El backend impide quedarse sin superadministrador. */
function eliminarUsuario(id) {
    const usuario = estadoAplicacion.usuarios.find(function (item) {
        return String(item.id) === String(id);
    });
    if (!usuario) {
        mostrarNotificacion('Usuario no encontrado.', 'error');
        return;
    }

    if (!window.confirm('¿Eliminar a ' + usuario.nombre + ' (' + usuario.usuario + ')?')) {
        return;
    }

    fetch('/api/usuarios/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function (respuesta) {
            return respuesta.json().catch(function () { return {}; }).then(function (cuerpo) {
                if (!respuesta.ok) {
                    throw new Error(cuerpo.mensaje || 'No se pudo eliminar el usuario.');
                }
                return cuerpo;
            });
        })
        .then(function () {
            estadoAplicacion.usuarios = estadoAplicacion.usuarios.filter(function (item) {
                return String(item.id) !== String(id);
            });
            renderizarUsuarios();
            agregarActividad('Usuario eliminado: ' + usuario.nombre + '.');
            mostrarNotificacion('Usuario eliminado correctamente.', 'exito');

            if (String(id) === String(estadoAplicacion.usuarioId)) {
                mostrarNotificacion('Tu cuenta fue eliminada. Vuelve a iniciar sesión.', 'advertencia');
                cerrarSesion();
            }
        })
        .catch(function (fallo) {
            mostrarNotificacion(fallo.message, 'error');
        });
}

function leerFormularioUsuario() {
    const campo = function (id) {
        const elemento = porId(id);
        return elemento ? elemento.value.trim() : '';
    };
    const campoClave = porId('usuario-clave');
    return {
        id: campo('usuario-id'),
        nombre: campo('usuario-nombre'),
        usuario: campo('usuario-username'),
        clave: campoClave ? campoClave.value : '',
        rol: campo('usuario-rol'),
        estado: campo('usuario-estado')
    };
}

/* ========================= 10. CONFIGURACIÓN ============================ */

function cargarConfiguracion() {
    let guardada = null;
    try {
        const texto = localStorage.getItem(CLAVE_CONFIGURACION);
        guardada = texto ? JSON.parse(texto) : null;
    } catch (error) {
        guardada = null;
    }

    estadoAplicacion.configuracion = Object.assign({}, CONFIGURACION_POR_DEFECTO, guardada || {});
    poblarFormularioConfiguracion();
}

function poblarFormularioConfiguracion() {
    const config = estadoAplicacion.configuracion;

    const asignar = function (id, valor) {
        const campo = porId(id);
        if (campo) { campo.value = valor; }
    };

    asignar('config-nombre-sistema', config.nombreSistema);
    asignar('config-ubicacion', config.ubicacion);
    asignar('config-estado', config.estadoSistema);
    asignar('config-intervalo', config.intervalo);
    asignar('config-distancia-min', config.distanciaMinima);
    asignar('config-distancia-max', config.distanciaMaxima);
    asignar('config-tiempo-verde', config.tiempoMinimoVerde);
    asignar('config-tiempo-rojo', config.tiempoMinimoRojo);
    asignar('config-modo', config.modoPorDefecto);
    asignar('config-camara-nombre', config.camaraNombre);
    asignar('config-camara-estado', config.camaraEstado);
    asignar('config-camara-calidad', config.camaraCalidad);

    actualizarVistaPreviaCamara();
    setTexto('camara-nombre', config.camaraNombre);
    estadoAplicacion.camaraConectada = config.camaraEstado === 'activada';
    setTexto('camara-estado', estadoAplicacion.camaraConectada ? 'Activa' : 'Desactivada');
}

function actualizarVistaPreviaCamara() {
    const campo = porId('config-camara-calidad');
    const calidad = campo ? campo.value : '1080p';
    const medidas = { '1080p': '1920×1080', '720p': '1280×720', '480p': '854×480' };
    setTexto('vista-previa-config', calidad + ' · ' + (medidas[calidad] || '—'));
}

function guardarConfiguracion() {
    const numero = function (id) {
        const campo = porId(id);
        return campo ? Number(campo.value) : NaN;
    };

    const nombreSistema = porId('config-nombre-sistema');
    const ubicacion = porId('config-ubicacion');

    if (!nombreSistema || !nombreSistema.value.trim()) {
        mostrarNotificacion('Completa el nombre del sistema.', 'error');
        return;
    }
    if (!ubicacion || !ubicacion.value.trim()) {
        mostrarNotificacion('Completa la ubicación principal.', 'error');
        return;
    }

    const intervalo = numero('config-intervalo');
    const distanciaMin = numero('config-distancia-min');
    const distanciaMax = numero('config-distancia-max');
    const tiempoVerde = numero('config-tiempo-verde');
    const tiempoRojo = numero('config-tiempo-rojo');

    if (!esNumeroValido(intervalo) || intervalo < 200) {
        mostrarNotificacion('El intervalo de actualización debe ser mínimo 200 ms.', 'error');
        return;
    }
    if (!esNumeroValido(distanciaMin) || distanciaMin < 5) {
        mostrarNotificacion('La distancia mínima debe ser al menos 5 cm.', 'error');
        return;
    }
    if (!esNumeroValido(distanciaMax) || distanciaMax <= distanciaMin) {
        mostrarNotificacion('La distancia máxima debe ser mayor que la mínima.', 'error');
        return;
    }
    if (!esNumeroValido(tiempoVerde) || tiempoVerde < 1 || !esNumeroValido(tiempoRojo) || tiempoRojo < 1) {
        mostrarNotificacion('Los tiempos mínimos deben ser de al menos 1 segundo.', 'error');
        return;
    }

    estadoAplicacion.configuracion = {
        nombreSistema: nombreSistema.value.trim(),
        ubicacion: ubicacion.value.trim(),
        estadoSistema: porId('config-estado') ? porId('config-estado').value : 'operativo',
        intervalo: intervalo,
        distanciaMinima: distanciaMin,
        distanciaMaxima: distanciaMax,
        tiempoMinimoVerde: tiempoVerde,
        tiempoMinimoRojo: tiempoRojo,
        modoPorDefecto: porId('config-modo') ? porId('config-modo').value : 'automatico',
        camaraNombre: porId('config-camara-nombre') ? porId('config-camara-nombre').value.trim() : 'Cámara simulada',
        camaraEstado: porId('config-camara-estado') ? porId('config-camara-estado').value : 'activada',
        camaraCalidad: porId('config-camara-calidad') ? porId('config-camara-calidad').value : '1080p'
    };

    try {
        localStorage.setItem(CLAVE_CONFIGURACION, JSON.stringify(estadoAplicacion.configuracion));
    } catch (error) {
        /* si no hay almacenamiento la configuración vive solo en memoria */
    }

    poblarFormularioConfiguracion();
    actualizarMapa();
    actualizarDashboard();
    agregarActividad('Configuración guardada correctamente.');
    mostrarNotificacion('Configuración guardada correctamente.', 'exito');
}

function restablecerConfiguracion() {
    estadoAplicacion.configuracion = Object.assign({}, CONFIGURACION_POR_DEFECTO);

    try {
        localStorage.removeItem(CLAVE_CONFIGURACION);
    } catch (error) {
        /* sin almacenamiento no hay nada que borrar */
    }

    poblarFormularioConfiguracion();
    actualizarMapa();
    agregarActividad('Configuración restablecida.');
    mostrarNotificacion('Configuración restablecida.', 'info');
}

function esNumeroValido(valor) {
    return typeof valor === 'number' && isFinite(valor) && !isNaN(valor);
}

/* =============== 11. NOTIFICACIONES Y ACTIVIDAD ======================== */

/* Registra un evento en la lista de actividad reciente. */
function agregarActividad(mensaje) {
    auxiliar.actividades.unshift({ mensaje: mensaje, hora: horaCorta() });
    if (auxiliar.actividades.length > 20) { auxiliar.actividades.pop(); }
    renderizarActividad();
}

function renderizarActividad() {
    const lista = porId('lista-actividad');
    if (!lista) { return; }

    if (auxiliar.actividades.length === 0) {
        lista.innerHTML = '<li class="vacio">Sin actividad registrada todavía.</li>';
        return;
    }

    lista.innerHTML = auxiliar.actividades.map(function (item) {
        return '<li><span class="punto-punto verde"></span>' +
            '<span>' + escaparTexto(item.mensaje) + '</span>' +
            '<time>' + escaparTexto(item.hora) + '</time></li>';
    }).join('');

    if (porId('contador-actividad')) {
        setTexto('contador-actividad', auxiliar.actividades.length + ' eventos');
    }
}

/* Notificación tipo toast en la esquina de la pantalla. */
function mostrarNotificacion(mensaje, tipo) {
    const zona = porId('zona-notificaciones');
    if (!zona) { return; }

    const estilo = tipo && TIPOS_TOAST.indexOf(tipo) !== -1 ? tipo : 'info';

    /* Como máximo 4 notificaciones simultáneas */
    while (zona.children.length >= 4) {
        zona.removeChild(zona.firstElementChild);
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + estilo;
    toast.innerHTML = '<span class="toast-texto">' + escaparTexto(mensaje) + '</span>';
    zona.appendChild(toast);

    registrarNotificacion(mensaje, estilo);

    window.setTimeout(function () {
        toast.classList.add('saliendo');
        window.setTimeout(function () {
            if (toast.parentNode) { toast.parentNode.removeChild(toast); }
        }, 280);
    }, 3400);
}

function registrarNotificacion(mensaje, tipo) {
    auxiliar.notificaciones.unshift({ mensaje: mensaje, tipo: tipo, hora: horaCorta() });
    if (auxiliar.notificaciones.length > 12) { auxiliar.notificaciones.pop(); }
    renderizarNotificaciones();
}

function renderizarNotificaciones() {
    const lista = porId('lista-notificaciones');
    const contador = porId('contador-notificaciones');
    if (!lista) { return; }

    if (auxiliar.notificaciones.length === 0) {
        lista.innerHTML = '<li class="vacio">Sin notificaciones nuevas.</li>';
    } else {
        const colores = {
            exito: 'var(--color-exito)',
            advertencia: 'var(--color-advertencia)',
            error: 'var(--color-error)',
            info: 'var(--color-primario)'
        };
        lista.innerHTML = auxiliar.notificaciones.map(function (item) {
            return '<li><i style="background:' + (colores[item.tipo] || colores.info) + '"></i>' +
                '<span>' + escaparTexto(item.mensaje) + '<br><small style="color:var(--color-texto-suave)">' +
                escaparTexto(item.hora) + '</small></span></li>';
        }).join('');
    }

    if (contador) {
        const total = auxiliar.notificaciones.length;
        if (total > 0) {
            contador.textContent = String(total);
            contador.removeAttribute('hidden');
        } else {
            contador.setAttribute('hidden', '');
        }
    }
}

function limpiarNotificaciones() {
    auxiliar.notificaciones = [];
    renderizarNotificaciones();
    limpiarZonaNotificaciones();
}

function limpiarZonaNotificaciones() {
    const zona = porId('zona-notificaciones');
    if (zona) { zona.innerHTML = ''; }
}

function alternarPanelNotificaciones() {
    const panel = porId('panel-notificaciones');
    if (!panel) { return; }
    if (panel.hasAttribute('hidden')) {
        panel.removeAttribute('hidden');
    } else {
        panel.setAttribute('hidden', '');
    }
}

/* ================ 12. RELOJ, MENÚ MÓVIL E INICIALIZACIÓN ================ */

/* Actualiza la fecha y hora de la barra superior. */
function actualizarHora() {
    setTexto('fecha-hora', horaActual());
    setTexto('fecha-actual', fechaActual());
}

function abrirMenuMovil() {
    const menu = porId('menu-lateral');
    const overlay = porId('overlay-menu');
    if (menu) { menu.classList.add('abierto'); }
    if (overlay) { overlay.removeAttribute('hidden'); }
}

function cerrarMenuMovil() {
    const menu = porId('menu-lateral');
    const overlay = porId('overlay-menu');
    if (menu) { menu.classList.remove('abierto'); }
    if (overlay) { overlay.setAttribute('hidden', ''); }
}

function alternarMenuMovil() {
    const menu = porId('menu-lateral');
    if (!menu) { return; }
    if (menu.classList.contains('abierto')) {
        cerrarMenuMovil();
    } else {
        abrirMenuMovil();
    }
}

/* --------------------- Asignación de eventos --------------------------- */

function registrarEventos() {
    /* Login */
    const formulario = porId('formulario-login');
    if (formulario) {
        formulario.addEventListener('submit', function (evento) {
            evento.preventDefault();
            iniciarSesion();
        });
    }

    const ver = porId('ver-contrasena');
    if (ver) {
        ver.addEventListener('click', function () {
            const campo = porId('campo-contrasena');
            if (!campo) { return; }
            const visible = campo.type === 'text';
            campo.type = visible ? 'password' : 'text';
            ver.textContent = visible ? 'ver' : 'ocultar';
        });
    }

    /* Navegación lateral */
    $$('.nav-item').forEach(function (item) {
        item.addEventListener('click', function () {
            cambiarSeccion(item.getAttribute('data-seccion'));
        });
    });

    /* Sesión */
    const cerrar = porId('cerrar-sesion');
    if (cerrar) { cerrar.addEventListener('click', cerrarSesion); }

    /* Barra superior */
    const hamburguesa = porId('boton-menu-movil');
    if (hamburguesa) { hamburguesa.addEventListener('click', alternarMenuMovil); }

    const overlay = porId('overlay-menu');
    if (overlay) { overlay.addEventListener('click', cerrarMenuMovil); }

    const botonNotificaciones = porId('boton-notificaciones');
    if (botonNotificaciones) { botonNotificaciones.addEventListener('click', alternarPanelNotificaciones); }

    const limpiar = porId('limpiar-notificaciones');
    if (limpiar) { limpiar.addEventListener('click', limpiarNotificaciones); }

    /* Semáforos */
    const btnAutomatico = porId('btn-modo-automatico');
    if (btnAutomatico) { btnAutomatico.addEventListener('click', function () { cambiarModo('automatico'); }); }

    const btnManual = porId('btn-modo-manual');
    if (btnManual) { btnManual.addEventListener('click', function () { cambiarModo('manual'); }); }

    const controles = [
        { id: 'btn-rojo', color: 'rojo' },
        { id: 'btn-amarillo', color: 'amarillo' },
        { id: 'btn-verde', color: 'verde' }
    ];
    controles.forEach(function (control) {
        const boton = porId(control.id);
        if (boton) { boton.addEventListener('click', function () { cambiarColor(control.color); }); }
    });

    const sensor = [
        { id: 'btn-acercando', accion: simularVehiculoAcercandose },
        { id: 'btn-alejandose', accion: simularVehiculoAlejandose },
        { id: 'btn-via-libre', accion: simularViaLibre },
        { id: 'btn-restablecer', accion: restablecerSimulacion }
    ];
    sensor.forEach(function (item) {
        const boton = porId(item.id);
        if (boton) { boton.addEventListener('click', item.accion); }
    });

    const selectorSemaforo = porId('selector-semaforo');
    if (selectorSemaforo) {
        selectorSemaforo.addEventListener('change', function () {
            mostrarNotificacion('Dispositivo seleccionado: Semáforo Principal.', 'info');
        });
    }

    /* Cámara */
    const capturar = porId('btn-capturar');
    if (capturar) { capturar.addEventListener('click', capturarImagenSimulada); }

    const pantallaCompleta = porId('btn-pantalla-completa');
    if (pantallaCompleta) { pantallaCompleta.addEventListener('click', alternarPantallaCompleta); }

    const sonido = porId('btn-sonido');
    if (sonido) { sonido.addEventListener('click', alternarSonido); }

    /* Estadísticas */
    const periodo = porId('selector-periodo');
    if (periodo) {
        periodo.addEventListener('change', function () {
            renderizarEstadisticas(periodo.value);
            mostrarNotificacion('Estadísticas actualizadas: ' + (DATOS_ESTADISTICAS[periodo.value] ? DATOS_ESTADISTICAS[periodo.value].etiqueta.toLowerCase() : '') + '.', 'info');
        });
    }

    /* Gestión de usuarios */
    const nuevoUsuario = porId('btn-nuevo-usuario');
    if (nuevoUsuario) { nuevoUsuario.addEventListener('click', function () { abrirModalUsuario(null); }); }

    const guardarUsuario = porId('btn-guardar-usuario');
    if (guardarUsuario) {
        guardarUsuario.addEventListener('click', function () {
            const id = porId('usuario-id');
            if (id && id.value) {
                editarUsuario(id.value);
            } else {
                crearUsuario();
            }
        });
    }

    const cancelarUsuario = porId('btn-cancelar-usuario');
    if (cancelarUsuario) { cancelarUsuario.addEventListener('click', cerrarModalUsuario); }

    const cerrarModal = porId('btn-cerrar-modal');
    if (cerrarModal) { cerrarModal.addEventListener('click', cerrarModalUsuario); }

    const fondoModal = $('#modal-usuario .modal-fondo');
    if (fondoModal) { fondoModal.addEventListener('click', cerrarModalUsuario); }

    const formularioUsuario = porId('formulario-usuario');
    if (formularioUsuario) {
        formularioUsuario.addEventListener('submit', function (evento) {
            evento.preventDefault();
            const id = porId('usuario-id');
            if (id && id.value) { editarUsuario(id.value); } else { crearUsuario(); }
        });
    }

    const cuerpoTabla = porId('tabla-usuarios');
    if (cuerpoTabla) {
        cuerpoTabla.addEventListener('click', function (evento) {
            const boton = evento.target.closest ? evento.target.closest('button[data-accion]') : null;
            if (!boton) { return; }
            const id = boton.getAttribute('data-id');
            const accion = boton.getAttribute('data-accion');

            if (accion === 'editar') {
                const usuario = estadoAplicacion.usuarios.find(function (item) {
                    return String(item.id) === String(id);
                });
                if (usuario) { abrirModalUsuario(usuario); }
            } else if (accion === 'eliminar') {
                eliminarUsuario(id);
            }
        });
    }

    /* Configuración */
    const guardarConfig = porId('btn-guardar-config');
    if (guardarConfig) { guardarConfig.addEventListener('click', guardarConfiguracion); }

    const restablecerConfig = porId('btn-restablecer-config');
    if (restablecerConfig) { restablecerConfig.addEventListener('click', restablecerConfiguracion); }

    const calidad = porId('config-camara-calidad');
    if (calidad) { calidad.addEventListener('change', actualizarVistaPreviaCamara); }

    /* Teclado: Enter envía el login, Escape cierra capas abiertas */
    document.addEventListener('keydown', function (evento) {
        if (evento.key === 'Escape') {
            cerrarMenuMovil();
            cerrarModalUsuario();
            const panel = porId('panel-notificaciones');
            if (panel) { panel.setAttribute('hidden', ''); }
        }
    });

    /* Al redimensionar a escritorio se cierra el menú móvil */
    window.addEventListener('resize', function () {
        if (window.innerWidth > 1024) { cerrarMenuMovil(); }
    });
}

/* ---------------------------- Arranque --------------------------------- */

function iniciar() {
    estadoAplicacion.configuracion = Object.assign({}, CONFIGURACION_POR_DEFECTO);
    cargarUsuarios();
    registrarEventos();
    renderizarActividad();
    renderizarNotificaciones();
    actualizarControlesModo();
    actualizarSemaforo();
    actualizarHora();
    verificarSesion();

    if (auxiliar.intervaloReloj) { window.clearInterval(auxiliar.intervaloReloj); }
    auxiliar.intervaloReloj = window.setInterval(actualizarHora, 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
} else {
    iniciar();
}