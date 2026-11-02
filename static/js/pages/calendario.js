/* static/js/pages/calendario.js */
document.addEventListener('DOMContentLoaded', function() {
    var matriz = document.getElementById('cuadradaCalendarioMatriz');
    if (!matriz) return;

    var todasLasTareas = [];
    var filtroTexto = '';

    function clasePorEstado(estado) {
        if (estado === 'En-Curso') return 'event-blue-dark';
        if (estado === 'Revision') return 'event-amber-soft';
        if (estado === 'Finalizado') return 'event-green-soft';
        return 'event-blue-soft';
    }

    function construirCuadriculaOctubre() {
        var celdasHtml = "";

        // Días del mes anterior (Septiembre de relleno: Lun 28, Mar 29, Mié 30)
        celdasHtml += `<div class="calendar-day-box calendar-day-muted"><span class="day-number-text text-muted">28</span></div>`;
        celdasHtml += `<div class="calendar-day-box calendar-day-muted"><span class="day-number-text text-muted">29</span></div>`;
        celdasHtml += `<div class="calendar-day-box calendar-day-muted"><span class="day-number-text text-muted">30</span></div>`;

        // 31 días completos de Octubre 2026
        for (var d = 1; d <= 31; d++) {
            var dd = String(d).padStart(2, '0');
            var fechaISO = `2026-10-${dd}`;
            var clasesBox = "calendar-day-box";
            var etiquetaHoy = "";

            if (d === 19) {
                clasesBox += " day-box-today";
                etiquetaHoy = " (Hoy)";
            }

            celdasHtml += `
                <div class="${clasesBox}" id="day-oct-${d}" data-fecha="${fechaISO}">
                    <span class="day-number-text">${d}${etiquetaHoy}</span>
                    <div class="day-events-list" id="events-${fechaISO}"></div>
                </div>`;
        }

        // Domingo 1 de Noviembre para cerrar las 5 filas (35 celdas)
        celdasHtml += `<div class="calendar-day-box calendar-day-muted"><span class="day-number-text text-muted">1</span></div>`;

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
            var fecha = (t.fecha_limite || t.fecha_calendario || t.fecha_creacion || '2026-10-19').slice(0, 10);
            var contenedorDia = document.getElementById(`events-${fecha}`) || document.getElementById('events-2026-10-19');
            if (!contenedorDia) return;

            var badge = document.createElement('div');
            badge.className = `calendar-badge-event ${clasePorEstado(t.estado)}`;
            badge.title = `${t.clave_incidencia}: ${t.titulo}`;
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
                construirCuadriculaOctubre();
            })
            .catch(() => construirCuadriculaOctubre());
    }

    window.addEventListener('proyectoCambiado', cargarTareasCalendario);
    window.addEventListener('incidenciasActualizadas', cargarTareasCalendario);
    window.addEventListener('busquedaGlobalJira', function(e) {
        filtroTexto = (e.detail && e.detail.texto) || '';
        pintarIncidencias();
    });

    cargarTareasCalendario();
});
