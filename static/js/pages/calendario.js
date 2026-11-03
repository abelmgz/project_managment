/* static/js/pages/calendario.js */
document.addEventListener('DOMContentLoaded', function() {
    var matriz = document.getElementById('cuadradaCalendarioMatriz');
    var tituloMesEl = document.getElementById('calendarioMesTitulo');
    var btnAnterior = document.getElementById('btnCalMesAnterior');
    var btnHoy = document.getElementById('btnCalHoy');
    var btnSiguiente = document.getElementById('btnCalMesSiguiente');
    if (!matriz) return;

    var todasLasTareas = [];
    var filtroTexto = '';

    var nombresMeses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    function obtenerHoyLocal() {
        var ahora = new Date();
        return {
            anio: ahora.getFullYear(),
            mes: ahora.getMonth(), // 0-11
            dia: ahora.getDate(),
            iso: `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
        };
    }

    var hoyInfo = obtenerHoyLocal();
    var anioVista = hoyInfo.anio;
    var mesVista = hoyInfo.mes;

    function clasePorEstado(estado) {
        if (estado === 'En-Curso') return 'event-blue-dark';
        if (estado === 'Revision') return 'event-amber-soft';
        if (estado === 'Finalizado') return 'event-green-soft';
        return 'event-blue-soft';
    }

    function construirCuadriculaMes() {
        hoyInfo = obtenerHoyLocal();
        if (tituloMesEl) {
            tituloMesEl.textContent = `${nombresMeses[mesVista]} ${anioVista}`;
        }

        // Primer día del mes (convertir Domingo=0..Sábado=6 a Lunes=0..Domingo=6)
        var primerDiaSemanaJS = new Date(anioVista, mesVista, 1).getDay();
        var offsetLunes = (primerDiaSemanaJS + 6) % 7;

        var totalDiasMes = new Date(anioVista, mesVista + 1, 0).getDate();
        var totalDiasMesAnterior = new Date(anioVista, mesVista, 0).getDate();

        var celdasHtml = '';
        var celdasTotales = 0;

        // 1. Días de relleno del mes anterior
        for (var i = offsetLunes - 1; i >= 0; i--) {
            var diaAnt = totalDiasMesAnterior - i;
            celdasHtml += `<div class="calendar-day-box calendar-day-muted"><span class="day-number-text text-muted">${diaAnt}</span></div>`;
            celdasTotales++;
        }

        // 2. Días del mes activo
        var mm = String(mesVista + 1).padStart(2, '0');
        for (var d = 1; d <= totalDiasMes; d++) {
            var dd = String(d).padStart(2, '0');
            var fechaISO = `${anioVista}-${mm}-${dd}`;
            var esHoy = (fechaISO === hoyInfo.iso);
            var clasesBox = 'calendar-day-box' + (esHoy ? ' day-box-today' : '');
            var etiquetaHoy = esHoy ? ' <span class="badge bg-primary ms-1" style="font-size:0.62rem;">Hoy</span>' : '';

            celdasHtml += `
                <div class="${clasesBox}" data-fecha="${fechaISO}">
                    <span class="day-number-text">${d}${etiquetaHoy}</span>
                    <div class="day-events-list" id="events-${fechaISO}"></div>
                </div>`;
            celdasTotales++;
        }

        // 3. Días de relleno del mes siguiente para cerrar múltiplos de 7
        var resto = (7 - (celdasTotales % 7)) % 7;
        for (var sig = 1; sig <= resto; sig++) {
            celdasHtml += `<div class="calendar-day-box calendar-day-muted"><span class="day-number-text text-muted">${sig}</span></div>`;
        }

        matriz.innerHTML = celdasHtml;
        pintarIncidencias();
    }

    function pintarIncidencias() {
        matriz.querySelectorAll('.day-events-list').forEach(el => {
            el.innerHTML = '';
        });

        var filtradas = todasLasTareas.filter(t => {
            if (filtroTexto) {
                var blob = `${t.clave_incidencia || ''} ${t.titulo || ''} ${t.componente || ''}`.toLowerCase();
                if (!blob.includes(filtroTexto)) return false;
            }
            return true;
        });

        filtradas.forEach(t => {
            var fecha = (t.due_date || t.fecha_limite || t.fecha_calendario || t.fecha_creacion || '').slice(0, 10);
            var contenedorDia = document.getElementById(`events-${fecha}`);
            if (!contenedorDia) return;

            var badge = document.createElement('div');
            badge.className = `calendar-badge-event ${clasePorEstado(t.estado)}`;
            badge.title = `${t.clave_incidencia}: ${t.titulo} (Inicio: ${(t.fecha_inicio || '-').slice(0, 10)} → Due: ${fecha})`;
            badge.setAttribute('onclick', `window.abrirDetalleIncidencia(${t.id})`);
            badge.innerHTML = `<strong>${t.clave_incidencia}</strong> ${t.titulo}`;

            contenedorDia.appendChild(badge);
        });
    }

    function cargarTareasCalendario() {
        var activoId = window.obtenerProyectoActivoId ? window.obtenerProyectoActivoId() : '';
        var url = activoId ? `/api/tareas?proyecto_id=${encodeURIComponent(activoId)}` : '/api/tareas';

        fetch(url)
            .then(res => res.json())
            .then(data => {
                todasLasTareas = Array.isArray(data) ? data : [];
                if (window.registrarTareasEnCache) {
                    window.registrarTareasEnCache(todasLasTareas);
                }
                construirCuadriculaMes();
            })
            .catch(() => construirCuadriculaMes());
    }

    if (btnAnterior) {
        btnAnterior.addEventListener('click', function() {
            mesVista--;
            if (mesVista < 0) {
                mesVista = 11;
                anioVista--;
            }
            construirCuadriculaMes();
        });
    }

    if (btnSiguiente) {
        btnSiguiente.addEventListener('click', function() {
            mesVista++;
            if (mesVista > 11) {
                mesVista = 0;
                anioVista++;
            }
            construirCuadriculaMes();
        });
    }

    if (btnHoy) {
        btnHoy.addEventListener('click', function() {
            var h = obtenerHoyLocal();
            anioVista = h.anio;
            mesVista = h.mes;
            construirCuadriculaMes();
        });
    }

    window.addEventListener('proyectoCambiado', cargarTareasCalendario);
    window.addEventListener('incidenciasActualizadas', cargarTareasCalendario);
    window.addEventListener('usuarioSesionCambiado', cargarTareasCalendario);
    window.addEventListener('tareaSeleccionadaBuscador', function(e) {
        var tarea = e.detail && e.detail.tarea;
        if (!tarea) return;
        var fechaStr = (tarea.due_date || tarea.fecha_limite || tarea.fecha_calendario || '').slice(0, 10);
        var partes = fechaStr.split('-').map(Number);
        if (partes.length === 3 && partes[0] && partes[1]) {
            anioVista = partes[0];
            mesVista = partes[1] - 1;
            construirCuadriculaMes();
        }
    });
    window.addEventListener('busquedaGlobalJira', function(e) {
        filtroTexto = (e.detail && e.detail.texto) || '';
        pintarIncidencias();
    });

    cargarTareasCalendario();
});
