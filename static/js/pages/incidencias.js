/* static/js/pages/incidencias.js */
document.addEventListener('DOMContentLoaded', function() {
    var cuerpo = document.getElementById('contenedorListaIncidencias') || document.getElementById('tablaIncidenciasCuerpo');
    if (!cuerpo) return;

    var todasLasTareas = [];
    var filtroTexto = '';

    function renderizarTabla() {
        var filtradas = todasLasTareas.filter(t => {
            if (filtroTexto) {
                var blob = `${t.clave_incidencia || ''} ${t.titulo || ''} ${t.componente || ''} ${t.proyecto_nombre || ''}`.toLowerCase();
                if (!blob.includes(filtroTexto)) return false;
            }
            return true;
        });

        cuerpo.innerHTML = "";
        if (filtradas.length === 0) {
            cuerpo.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No hay incidencias registradas para este proyecto</td></tr>';
            return;
        }

        filtradas.forEach(t => {
            var asignadoNombre = t.asignado_nombre || 'Abel Martinez';
            var iniciales = asignadoNombre.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
            var tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.setAttribute('onclick', `window.abrirDetalleIncidencia(${t.id})`);
            tr.innerHTML = `
                <td class="ps-4"><span class="fw-bold text-primary">${t.clave_incidencia}</span></td>
                <td class="fw-medium text-dark">${t.titulo}</td>
                <td><span class="text-secondary"><i class="fas fa-tag fa-xs me-1"></i>${t.componente || 'General'}</span></td>
                <td><span class="badge-priority priority-${t.prioridad}">${t.prioridad}</span></td>
                <td><span class="badge-status status-${t.estado}">${t.estado.toUpperCase()}</span></td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-kanban me-2" style="width:24px; height:24px; font-size:0.68rem;">${iniciales}</div>
                        <span class="text-dark fw-medium" style="font-size:0.82rem;">${asignadoNombre}</span>
                    </div>
                </td>
                <td class="pe-4 text-end">
                    <button type="button" class="btn btn-sm btn-light border" style="font-size:0.75rem;">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </td>
            `;
            cuerpo.appendChild(tr);
        });
    }

    function cargarIncidencias() {
        var activoId = window.obtenerProyectoActivoId ? window.obtenerProyectoActivoId() : '';
        var url = activoId ? `/api/tareas?proyecto_id=${encodeURIComponent(activoId)}` : '/api/tareas';

        fetch(url)
            .then(res => res.json())
            .then(data => {
                todasLasTareas = Array.isArray(data) ? data : [];
                if (window.registrarTareasEnCache) {
                    window.registrarTareasEnCache(todasLasTareas);
                }
                renderizarTabla();
            })
            .catch(err => {
                console.error("Error al cargar lista de incidencias:", err);
                cuerpo.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Error al cargar las incidencias</td></tr>';
            });
    }

    window.addEventListener('proyectoCambiado', cargarIncidencias);
    window.addEventListener('incidenciasActualizadas', cargarIncidencias);
    window.addEventListener('busquedaGlobalJira', function(e) {
        filtroTexto = (e.detail && e.detail.texto) || '';
        renderizarTabla();
    });

    cargarIncidencias();
});
