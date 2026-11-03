// static/js/pages/kanban.js
document.addEventListener('DOMContentLoaded', function() {
    const contenedorTablero = document.querySelector('.kanban-board-row');
    if (!contenedorTablero) return;

    let todasLasTareas = [];
    let filtroTexto = '';

    function obtenerIniciales(nombre, fallback) {
        if (!nombre) return fallback || 'AM';
        return nombre
            .trim()
            .split(/\s+/)
            .map(parte => parte[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    function limpiarColumnas() {
        document.querySelectorAll('.kanban-cards-container').forEach(col => {
            col.innerHTML = '';
        });
    }

    function obtenerContenedorEstado(estado) {
        return (
            document.querySelector(`.kanban-cards-container[data-estado="${estado}"]`) ||
            document.querySelector(`#col-${estado} .kanban-cards-container`) ||
            document.getElementById(estado)
        );
    }

    function aplicarFiltrosYRenderizar() {
        const filtradas = todasLasTareas.filter(t => {
            if (filtroTexto) {
                const blob = `${t.clave_incidencia || ''} ${t.titulo || ''} ${t.descripcion || ''} ${t.componente || ''}`.toLowerCase();
                if (!blob.includes(filtroTexto)) return false;
            }
            return true;
        });

        renderizarTarjetasKanban(filtradas);
    }

    function renderizarTarjetasKanban(listaTareas) {
        limpiarColumnas();

        listaTareas.forEach(tarea => {
            const columnaDestino = obtenerContenedorEstado(tarea.estado);
            if (!columnaDestino) return;

            const iniciales = obtenerIniciales(tarea.asignado_nombre, 'AM');
            const prioridad = tarea.prioridad || 'Media';
            const fechaInicio = (tarea.fecha_inicio || tarea.fecha_creacion || '').slice(0, 10);
            const fechaDue = (tarea.due_date || tarea.fecha_limite || tarea.fecha_calendario || '').slice(0, 10);

            const tarjetaHTML = `
                <div class="kanban-item-card card-prio-${prioridad}" draggable="true" data-id="${tarea.id}" onclick="window.abrirDetalleIncidencia(${tarea.id})">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="card-key-link">${tarea.clave_incidencia}</span>
                        <span class="badge-priority priority-${prioridad}">${prioridad}</span>
                    </div>
                    <div class="card-title-text mb-2">${tarea.titulo}</div>
                    <div class="text-muted mb-2" style="font-size: 0.72rem;">
                        <i class="far fa-calendar-check text-primary me-1"></i>${fechaInicio || '-'}
                        <i class="fas fa-arrow-right mx-1" style="font-size: 0.6rem;"></i>
                        <i class="far fa-calendar-alt text-danger me-1"></i><strong>${fechaDue || '-'}</strong>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="card-tag-box"><i class="fas fa-tag fa-xs me-1"></i>${tarea.componente || 'General'}</span>
                        <div class="avatar-kanban" title="${tarea.asignado_nombre || 'Abel Martinez'}">${iniciales}</div>
                    </div>
                </div>
            `;
            columnaDestino.insertAdjacentHTML('beforeend', tarjetaHTML);
        });

        recalcularContadores();
        inicializarEventosTarjetasYColumnas();
    }

    function recalcularContadores() {
        document.querySelectorAll('.kanban-column').forEach(columna => {
            const contenedorCards = columna.querySelector('.kanban-cards-container');
            const contadorBadge = columna.querySelector('.kanban-badge-count');
            if (!contenedorCards) return;

            contenedorCards.querySelectorAll('.kanban-empty-state').forEach(el => el.remove());

            const numTarjetas = contenedorCards.querySelectorAll('.kanban-item-card').length;
            if (contadorBadge) {
                contadorBadge.innerText = numTarjetas;
            }

            if (numTarjetas === 0) {
                contenedorCards.insertAdjacentHTML(
                    'beforeend',
                    `<div class="kanban-empty-state">Sin incidencias</div>`
                );
            }
        });
    }

    function inicializarEventosTarjetasYColumnas() {
        const tarjetas = document.querySelectorAll('.kanban-item-card');
        const contenedores = document.querySelectorAll('.kanban-cards-container');

        tarjetas.forEach(tarjeta => {
            tarjeta.addEventListener('dragstart', function(e) {
                tarjeta.classList.add('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.setData('text/plain', tarjeta.getAttribute('data-id'));
                }
            });

            tarjeta.addEventListener('dragend', function() {
                setTimeout(() => tarjeta.classList.remove('dragging'), 50);
            });
        });

        contenedores.forEach(contenedor => {
            if (contenedor.dataset.dndInitialized === 'true') return;
            contenedor.dataset.dndInitialized = 'true';

            contenedor.addEventListener('dragover', function(e) {
                e.preventDefault();
                contenedor.classList.add('drag-over-active');
            });

            contenedor.addEventListener('dragleave', function() {
                contenedor.classList.remove('drag-over-active');
            });

            contenedor.addEventListener('drop', function(e) {
                e.preventDefault();
                contenedor.classList.remove('drag-over-active');
                const tarjetaArrastrada = document.querySelector('.kanban-item-card.dragging');
                if (!tarjetaArrastrada) return;

                contenedor.appendChild(tarjetaArrastrada);
                recalcularContadores();

                const tareaId = Number(tarjetaArrastrada.getAttribute('data-id'));
                const nuevoEstado =
                    contenedor.getAttribute('data-estado') ||
                    contenedor.getAttribute('id') ||
                    contenedor.closest('.kanban-column')?.id?.replace(/^col-/, '');

                const itemLocal = todasLasTareas.find(t => Number(t.id) === tareaId);
                if (itemLocal) itemLocal.estado = nuevoEstado;
                if (window.TAREAS_CACHE_GLOBAL && window.TAREAS_CACHE_GLOBAL[String(tareaId)]) {
                    window.TAREAS_CACHE_GLOBAL[String(tareaId)].estado = nuevoEstado;
                }

                fetch('/api/tareas/actualizar-estado', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: tareaId, estado: nuevoEstado })
                })
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(() => {
                    if (window.mostrarNotificacion) {
                        const clave = itemLocal ? itemLocal.clave_incidencia : `#${tareaId}`;
                        const tipoNotif = nuevoEstado === 'Finalizado' ? 'success' : (nuevoEstado === 'Revision' ? 'warning' : 'info');
                        window.mostrarNotificacion(
                            `Incidencia ${clave} movida a "${nuevoEstado}".`,
                            tipoNotif,
                            'Estado Kanban Actualizado'
                        );
                    }
                })
                .catch(err => {
                    console.error('Error al persistir el estado:', err);
                    if (window.mostrarNotificacion) {
                        window.mostrarNotificacion('No se pudo actualizar el estado de la tarea.', 'danger', 'Error');
                    }
                });
            });
        });
    }

    function cargarTareasDesdeAPI() {
        const proyectoActivoId = window.obtenerProyectoActivoId ? window.obtenerProyectoActivoId() : '';
        const url = proyectoActivoId ? `/api/tareas?proyecto_id=${encodeURIComponent(proyectoActivoId)}` : '/api/tareas';

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Error de red');
                return response.json();
            })
            .then(data => {
                todasLasTareas = Array.isArray(data) ? data : [];
                if (window.registrarTareasEnCache) {
                    window.registrarTareasEnCache(todasLasTareas);
                }
                aplicarFiltrosYRenderizar();
            })
            .catch(err => console.error('Fallo al conectar con la API:', err));
    }

    window.addEventListener('proyectoCambiado', cargarTareasDesdeAPI);
    window.addEventListener('incidenciasActualizadas', cargarTareasDesdeAPI);
    window.addEventListener('busquedaGlobalJira', function(e) {
        filtroTexto = (e.detail && e.detail.texto) || '';
        aplicarFiltrosYRenderizar();
    });

    cargarTareasDesdeAPI();
});
