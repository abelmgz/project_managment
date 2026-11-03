// static/js/pages/proyectos.js
document.addEventListener('DOMContentLoaded', function() {
    const cuerpoTabla = document.getElementById('cuerpoTablaProyectos');
    const buscadorInput = document.getElementById('buscadorTablaProyectos');
    const grupoFiltro = document.getElementById('grupoFiltroEstadoProyecto');
    if (!cuerpoTabla) return;

    let todosLosProyectos = [];
    let usuarioActual = null;
    let filtroEstadoActivo = 'TODOS';
    let textoBusqueda = '';

    function escaparHTML(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function actualizarKPIs() {
        const total = todosLosProyectos.length;
        const enProceso = todosLosProyectos.filter(p => p.estado === 'En proceso').length;
        const pausados = todosLosProyectos.filter(p => p.estado === 'Planeación' || p.estado === 'En pausa').length;
        const finalizados = todosLosProyectos.filter(p => p.estado === 'Finalizado').length;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(val);
        };
        setTxt('kpiTotalProyectos', total);
        setTxt('kpiProyectosEnProceso', enProceso);
        setTxt('kpiProyectosPausados', pausados);
        setTxt('kpiProyectosFinalizados', finalizados);
    }

    function renderizarTablaProyectos() {
        actualizarKPIs();

        const filtrados = todosLosProyectos.filter(p => {
            if (filtroEstadoActivo !== 'TODOS' && p.estado !== filtroEstadoActivo) {
                return false;
            }
            if (textoBusqueda) {
                const blob = `${p.nombre || ''} ${p.clave_proyecto || ''} ${p.descripcion || ''} ${p.estado || ''}`.toLowerCase();
                if (!blob.includes(textoBusqueda)) return false;
            }
            return true;
        });

        if (filtrados.length === 0) {
            cuerpoTabla.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">
                        No se encontraron proyectos con el filtro seleccionado.
                    </td>
                </tr>
            `;
            return;
        }

        const esOwner = usuarioActual && usuarioActual.rol === 'Owner';
        const estadosOpciones = ['En proceso', 'Planeación', 'En pausa', 'Finalizado'];

        cuerpoTabla.innerHTML = filtrados.map(p => {
            const esEnProceso = p.estado === 'En proceso';
            const badgeVisibilidad = esEnProceso
                ? `<span class="badge badge-estado-en-proceso px-2 py-1"><i class="fas fa-eye me-1"></i>En lista de proyectos</span>`
                : `<span class="badge bg-light text-secondary border px-2 py-1"><i class="fas fa-eye-slash me-1"></i>Oculto de lista activa</span>`;

            const opcionesHtml = estadosOpciones.map(est => `
                <option value="${escaparHTML(est)}" ${p.estado === est ? 'selected' : ''}>${escaparHTML(est)}</option>
            `).join('');

            return `
                <tr>
                    <td class="ps-4">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace px-2 py-1" style="font-size: 0.8rem;">
                            ${escaparHTML(p.clave_proyecto)}
                        </span>
                    </td>
                    <td>
                        <div class="fw-bold text-dark">${escaparHTML(p.nombre)}</div>
                        <div class="text-muted small">${escaparHTML(p.descripcion || 'Sin descripción registrada')}</div>
                    </td>
                    <td>
                        <select class="form-select form-select-sm select-estado-proyecto" data-proyecto-id="${p.id}">
                            ${opcionesHtml}
                        </select>
                    </td>
                    <td>${badgeVisibilidad}</td>
                    <td>
                        <div class="d-flex justify-content-between small mb-1">
                            <span class="fw-semibold text-dark">${p.tareas_finalizadas}/${p.total_tareas} tareas</span>
                            <span class="text-muted">${p.horas_totales}h · ${p.progreso_pct}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar bg-success" role="progressbar" style="width: ${p.progreso_pct}%"></div>
                        </div>
                    </td>
                    <td class="text-secondary small">${escaparHTML(p.fecha_creacion || '-')}</td>
                    <td class="pe-4 text-end">
                        <div class="btn-group btn-group-sm">
                            <button type="button" class="btn btn-light border btn-editar-proyecto" data-proyecto-id="${p.id}" title="Editar proyecto">
                                <i class="fas fa-pen text-primary"></i>
                            </button>
                            ${esOwner ? `
                            <button type="button" class="btn btn-light border btn-eliminar-proyecto" data-proyecto-id="${p.id}" title="Eliminar proyecto (Exclusivo Owner)">
                                <i class="fas fa-trash-alt text-danger"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function cargarProyectosAdmin() {
        try {
            const res = await fetch('/api/proyectos?incluir_todos=true');
            if (!res.ok) return;
            const data = await res.json();
            todosLosProyectos = Array.isArray(data.proyectos) ? data.proyectos : [];
            usuarioActual = data.usuario_actual || window.USUARIO_ACTUAL_SESION;
            renderizarTablaProyectos();
        } catch (err) {
            console.error('Error al cargar proyectos:', err);
        }
    }

    // Cambio rápido de estado en línea desde la tabla
    cuerpoTabla.addEventListener('change', async function(e) {
        const selectEl = e.target.closest('.select-estado-proyecto[data-proyecto-id]');
        if (!selectEl) return;

        const proyectoId = Number(selectEl.getAttribute('data-proyecto-id'));
        const nuevoEstado = selectEl.value;
        selectEl.disabled = true;

        try {
            const res = await fetch(`/api/proyectos/${proyectoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            if (res.ok) {
                const data = await res.json();
                const idx = todosLosProyectos.findIndex(p => p.id === proyectoId);
                if (idx !== -1 && data.proyecto) {
                    todosLosProyectos[idx] = data.proyecto;
                }
                renderizarTablaProyectos();
                // Actualizar inmediatamente la lista global de proyectos en la barra lateral (solo "En proceso")
                if (window.cargarProyectosGlobales) {
                    await window.cargarProyectosGlobales();
                }
                if (window.mostrarNotificacion) {
                    const tipoColor = nuevoEstado === 'En proceso' ? 'success' : (nuevoEstado === 'En pausa' ? 'warning' : 'info');
                    window.mostrarNotificacion(
                        `El proyecto "${data.proyecto?.nombre || ''}" cambió a estado "${nuevoEstado}".`,
                        tipoColor,
                        'Estado de Proyecto Actualizado'
                    );
                }
            }
        } catch (err) {
            console.error('Error al actualizar estado del proyecto:', err);
            if (window.mostrarNotificacion) {
                window.mostrarNotificacion('No se pudo actualizar el estado del proyecto.', 'danger', 'Error');
            }
        } finally {
            selectEl.disabled = false;
        }
    });

    // Clic en botones Editar o Eliminar de la tabla
    cuerpoTabla.addEventListener('click', async function(e) {
        const btnEditar = e.target.closest('.btn-editar-proyecto[data-proyecto-id]');
        if (btnEditar) {
            const proyectoId = Number(btnEditar.getAttribute('data-proyecto-id'));
            const proy = todosLosProyectos.find(p => p.id === proyectoId);
            if (!proy) return;

            document.getElementById('editProyectoId').value = String(proy.id);
            document.getElementById('editProyectoNombre').value = proy.nombre || '';
            document.getElementById('editProyectoClave').value = proy.clave_proyecto || '';
            document.getElementById('editProyectoEstado').value = proy.estado || 'En proceso';
            document.getElementById('editProyectoDescripcion').value = proy.descripcion || '';

            const modalEl = document.getElementById('modalEditarProyecto');
            if (modalEl && window.bootstrap) {
                bootstrap.Modal.getOrCreateInstance(modalEl).show();
            }
            return;
        }

        const btnEliminar = e.target.closest('.btn-eliminar-proyecto[data-proyecto-id]');
        if (btnEliminar) {
            const proyectoId = Number(btnEliminar.getAttribute('data-proyecto-id'));
            const proy = todosLosProyectos.find(p => p.id === proyectoId);
            if (!proy) return;

            const confirmado = window.confirmarEliminacion
                ? await window.confirmarEliminacion({
                      titulo: 'Advertencia: Borrar Proyecto',
                      mensaje: `¿Estás seguro de que deseas borrar el proyecto "${proy.nombre}" (${proy.clave_proyecto}) y todas sus tareas asociadas?`
                  })
                : confirm(`¿Eliminar permanentemente el proyecto "${proy.nombre}" (${proy.clave_proyecto})?`);

            if (!confirmado) return;

            const res = await fetch(`/api/proyectos/${proyectoId}`, { method: 'DELETE' });
            if (res.ok) {
                await cargarProyectosAdmin();
                if (window.cargarProyectosGlobales) {
                    await window.cargarProyectosGlobales();
                }
                if (window.mostrarNotificacion) {
                    window.mostrarNotificacion(
                        `El proyecto "${proy.nombre}" (${proy.clave_proyecto}) ha sido eliminado.`,
                        'danger',
                        'Proyecto Eliminado'
                    );
                }
            } else {
                const err = await res.json().catch(() => ({}));
                if (window.mostrarNotificacion) {
                    window.mostrarNotificacion(err.detail || 'No tienes permisos para eliminar proyectos.', 'danger', 'Acción Denegada');
                }
            }
        }
    });

    // Guardar edición de proyecto desde el modal
    const formEditar = document.getElementById('formEditarProyecto');
    if (formEditar) {
        formEditar.addEventListener('submit', async function(e) {
            e.preventDefault();
            const proyectoId = document.getElementById('editProyectoId').value;
            if (!proyectoId) return;

            const payload = {
                nombre: document.getElementById('editProyectoNombre').value.trim(),
                clave_proyecto: document.getElementById('editProyectoClave').value.trim().toUpperCase(),
                estado: document.getElementById('editProyectoEstado').value,
                descripcion: document.getElementById('editProyectoDescripcion').value.trim()
            };

            const res = await fetch(`/api/proyectos/${proyectoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const modalEl = document.getElementById('modalEditarProyecto');
                if (modalEl && window.bootstrap) {
                    const inst = bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                }
                await cargarProyectosAdmin();
                if (window.cargarProyectosGlobales) {
                    await window.cargarProyectosGlobales();
                }
                if (window.mostrarNotificacion) {
                    window.mostrarNotificacion(`Proyecto "${payload.nombre}" actualizado correctamente.`, 'info', 'Proyecto Editado');
                }
            } else {
                const err = await res.json().catch(() => ({}));
                if (window.mostrarNotificacion) {
                    window.mostrarNotificacion(err.detail || 'Error al actualizar el proyecto', 'danger', 'Error');
                }
            }
        });
    }

    // Filtros por pestaña de estado
    if (grupoFiltro) {
        grupoFiltro.addEventListener('click', function(e) {
            const btn = e.target.closest('button[data-filtro-estado]');
            if (!btn) return;
            grupoFiltro.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroEstadoActivo = btn.getAttribute('data-filtro-estado') || 'TODOS';
            renderizarTablaProyectos();
        });
    }

    // Buscador por texto
    if (buscadorInput) {
        buscadorInput.addEventListener('input', function() {
            textoBusqueda = this.value.trim().toLowerCase();
            renderizarTablaProyectos();
        });
    }

    window.addEventListener('incidenciasActualizadas', cargarProyectosAdmin);
    window.addEventListener('usuarioSesionCambiado', cargarProyectosAdmin);

    cargarProyectosAdmin();
});
