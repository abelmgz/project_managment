// static/js/layouts/base.js
window.PROYECTOS_GLOBAL = [];
window.TAREAS_CACHE_GLOBAL = {};
window.USUARIO_ACTUAL_SESION = null;
window.PERFILES_USUARIOS_DISPONIBLES = [];

window.registrarTareasEnCache = function(lista) {
    if (!Array.isArray(lista)) return;
    lista.forEach(t => {
        if (t && t.id != null) {
            const previo = window.TAREAS_CACHE_GLOBAL[String(t.id)] || {};
            window.TAREAS_CACHE_GLOBAL[String(t.id)] = Object.assign({}, previo, t);
        }
    });
};

// --- GESTIÓN DE USUARIO EN SESIÓN Y ROLES (Owner, Administrador, Usuario) ---

window.obtenerUsuarioActivoId = function() {
    return localStorage.getItem('jira_usuario_activo_id') || '';
};

function sincronizarCookieUsuario(uid) {
    if (uid) {
        document.cookie = `jira_user_id=${encodeURIComponent(uid)}; path=/; max-age=2592000`;
    } else {
        document.cookie = 'jira_user_id=; path=/; max-age=0';
    }
}

// Sincronizar cookie desde el inicio antes de que las páginas disparen sus fetch
sincronizarCookieUsuario(window.obtenerUsuarioActivoId());

window.establecerUsuarioActivoId = function(usuarioId) {
    const val = usuarioId ? String(usuarioId) : '';
    localStorage.setItem('jira_usuario_activo_id', val);
    sincronizarCookieUsuario(val);
    window.cargarSesionUsuariosGlobal().then(() => {
        window.dispatchEvent(new CustomEvent('usuarioSesionCambiado', { detail: { usuarioId: val } }));
        window.dispatchEvent(new CustomEvent('incidenciasActualizadas'));
    });
};

function obtenerInicialesTexto(nombre) {
    return String(nombre || 'AM')
        .trim()
        .split(/\s+/)
        .map(p => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

window.cargarSesionUsuariosGlobal = function() {
    const uid = window.obtenerUsuarioActivoId();
    const url = uid ? `/api/usuarios?usuario_id=${encodeURIComponent(uid)}` : '/api/usuarios';

    return fetch(url)
        .then(res => res.json())
        .then(data => {
            const actual = data.usuario_actual;
            const perfiles = data.perfiles_disponibles || [];
            window.USUARIO_ACTUAL_SESION = actual;
            window.PERFILES_USUARIOS_DISPONIBLES = perfiles;

            if (actual && actual.id) {
                localStorage.setItem('jira_usuario_activo_id', String(actual.id));
                sincronizarCookieUsuario(String(actual.id));
            }

            // Actualizar datos del usuario en la barra superior
            const navNombre = document.getElementById('navbarUsuarioNombre');
            const navRol = document.getElementById('navbarUsuarioRol');
            const navAvatar = document.getElementById('navbarUsuarioAvatar');

            if (actual) {
                if (navNombre) navNombre.textContent = actual.nombre;
                if (navRol) navRol.textContent = actual.rol.toUpperCase();
                if (navAvatar) navAvatar.textContent = obtenerInicialesTexto(actual.nombre);
            }

            // Poblar menú desplegable de cambio rápido de sesión en navbar
            const menuSesion = document.getElementById('navbarMenuUsuariosSesion');
            if (menuSesion && actual) {
                let html = `
                    <li class="px-3 py-2 border-bottom bg-light">
                        <div class="fw-bold text-dark">${escaparHTML(actual.nombre)}</div>
                        <small class="text-muted d-block">${escaparHTML(actual.email)}</small>
                        <span class="badge bg-primary mt-1">${escaparHTML(actual.rol)}</span>
                    </li>
                    <li><h6 class="dropdown-header text-uppercase mt-1" style="font-size: 0.68rem;">Ingresar como otro usuario</h6></li>
                `;
                perfiles.forEach(p => {
                    const activo = p.id === actual.id;
                    html += `
                        <li>
                            <a class="dropdown-item d-flex justify-content-between align-items-center ${activo ? 'active fw-bold' : ''}" href="#" data-switch-uid="${p.id}">
                                <span>${escaparHTML(p.nombre)}</span>
                                <span class="badge ${activo ? 'bg-light text-primary' : 'bg-secondary'} ms-2" style="font-size: 0.66rem;">${escaparHTML(p.rol)}</span>
                            </a>
                        </li>
                    `;
                });
                html += `
                    <li><hr class="dropdown-divider"></li>
                    <li>
                        <a class="dropdown-item fw-semibold text-primary" href="/usuarios">
                            <i class="fas fa-users-cog me-2"></i>Administrar Usuarios & Roles
                        </a>
                    </li>
                `;
                menuSesion.innerHTML = html;

                menuSesion.querySelectorAll('a[data-switch-uid]').forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        const nuevoId = this.getAttribute('data-switch-uid');
                        window.establecerUsuarioActivoId(nuevoId);
                    });
                });
            }

            // Poblar selector de asignado en modal de detalle de incidencia
            const selAsignado = document.getElementById('detalleAsignadoSelect');
            if (selAsignado) {
                const valorPrevio = selAsignado.value;
                selAsignado.innerHTML = '';
                perfiles.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = String(p.id);
                    opt.textContent = `${p.nombre} (${p.rol})`;
                    selAsignado.appendChild(opt);
                });
                if (valorPrevio) selAsignado.value = valorPrevio;
                // Si el rol es Usuario no puede reasignar tareas a otros
                selAsignado.disabled = !(actual && actual.rol !== 'Usuario');
            }

            // Mostrar u ocultar botón Eliminar Incidencia (exclusivo Owner)
            const btnEliminarInc = document.getElementById('btnEliminarIncidenciaModal');
            if (btnEliminarInc) {
                if (actual && actual.rol === 'Owner') {
                    btnEliminarInc.classList.remove('d-none');
                } else {
                    btnEliminarInc.classList.add('d-none');
                }
            }

            return actual;
        })
        .catch(err => console.error('Error al cargar sesión de usuario:', err));
};

// --- GESTIÓN DE PROYECTO ACTIVO ---

window.obtenerProyectoActivoId = function() {
    return localStorage.getItem('jira_proyecto_activo_id') || '';
};

window.establecerProyectoActivoId = function(proyectoId) {
    const val = proyectoId ? String(proyectoId) : '';
    localStorage.setItem('jira_proyecto_activo_id', val);
    actualizarUIProyectoActivo();
    window.dispatchEvent(new CustomEvent('proyectoCambiado', { detail: { proyectoId: val } }));
};

function actualizarUIProyectoActivo() {
    const activoId = window.obtenerProyectoActivoId();
    const selector = document.getElementById('selectorProyectoGlobal');
    if (selector && selector.value !== activoId) {
        selector.value = activoId;
    }

    const nombreEl = document.getElementById('sidebarProyectoNombre');
    const subEl = document.getElementById('sidebarProyectoSubtitulo');
    const breadcrumbProy = document.getElementById('breadcrumbProyectoActivo');
    const hiddenProyInput = document.getElementById('modalIncidenciaProyecto');

    const proy = window.PROYECTOS_GLOBAL.find(p => String(p.id) === String(activoId));
    if (proy) {
        if (nombreEl) nombreEl.textContent = proy.nombre;
        if (subEl) subEl.textContent = proy.descripcion || `Clave: ${proy.clave_proyecto}`;
        if (breadcrumbProy) breadcrumbProy.textContent = proy.nombre;
        if (hiddenProyInput) hiddenProyInput.value = String(proy.id);
    } else {
        const primerProy = window.PROYECTOS_GLOBAL[0];
        if (nombreEl) nombreEl.textContent = 'Todos los Proyectos';
        if (subEl) subEl.textContent = 'Proyecto de Software Ágil';
        if (breadcrumbProy) breadcrumbProy.textContent = 'Todos los Proyectos';
        if (hiddenProyInput) hiddenProyInput.value = primerProy ? String(primerProy.id) : '1';
    }
}

window.cargarProyectosGlobales = function() {
    return fetch('/api/proyectos')
        .then(res => res.json())
        .then(proyectos => {
            window.PROYECTOS_GLOBAL = Array.isArray(proyectos) ? proyectos : [];
            let activoId = window.obtenerProyectoActivoId();

            if (activoId && !window.PROYECTOS_GLOBAL.some(p => String(p.id) === String(activoId))) {
                activoId = '';
                localStorage.setItem('jira_proyecto_activo_id', '');
            }

            const selector = document.getElementById('selectorProyectoGlobal');
            if (selector) {
                selector.innerHTML = `<option value="">Todos los proyectos</option>`;
                window.PROYECTOS_GLOBAL.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = String(p.id);
                    opt.textContent = `${p.nombre} (${p.clave_proyecto})`;
                    selector.appendChild(opt);
                });
                selector.value = activoId;
            }

            actualizarUIProyectoActivo();
            return window.PROYECTOS_GLOBAL;
        })
        .catch(err => console.error('Error al cargar proyectos:', err));
};

function escaparHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderizarComentariosEHistorial(comentarios, historial) {
    const contComentarios = document.getElementById('listaComentariosIncidencia');
    const badgeCom = document.getElementById('contadorComentariosModal');
    const listaCom = Array.isArray(comentarios) ? comentarios : [];

    if (badgeCom) badgeCom.textContent = String(listaCom.length);

    if (contComentarios) {
        if (listaCom.length === 0) {
            contComentarios.innerHTML = `<div class="text-muted py-2" style="font-size: 0.8rem;">Sin comentarios registrados aún.</div>`;
        } else {
            contComentarios.innerHTML = listaCom.map(c => {
                const iniciales = obtenerInicialesTexto(c.autor);
                return `
                    <div class="p-2 rounded border bg-light">
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <div class="d-flex align-items-center gap-2">
                                <span class="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold" style="width: 20px; height: 20px; font-size: 0.62rem;">${escaparHTML(iniciales)}</span>
                                <strong class="text-dark" style="font-size: 0.78rem;">${escaparHTML(c.autor)}</strong>
                            </div>
                            <small class="text-muted" style="font-size: 0.7rem;">${escaparHTML(c.fecha_creacion)}</small>
                        </div>
                        <div class="text-dark ps-4" style="font-size: 0.82rem; line-height: 1.35;">${escaparHTML(c.contenido)}</div>
                    </div>
                `;
            }).join('');
            contComentarios.scrollTop = contComentarios.scrollHeight;
        }
    }

    const contHistorial = document.getElementById('listaHistorialIncidencia');
    const badgeHist = document.getElementById('contadorHistorialModal');
    const listaHist = Array.isArray(historial) ? historial : [];

    if (badgeHist) badgeHist.textContent = String(listaHist.length);

    if (contHistorial) {
        if (listaHist.length === 0) {
            contHistorial.innerHTML = `<div class="text-muted py-1">Sin cambios registrados.</div>`;
        } else {
            contHistorial.innerHTML = listaHist.map(h => `
                <div class="p-2 rounded border bg-white">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-light text-dark border">${escaparHTML(h.campo_modificado)}</span>
                        <small class="text-muted" style="font-size: 0.68rem;">${escaparHTML(h.fecha_cambio)}</small>
                    </div>
                    <div class="text-secondary text-break">
                        <span>${escaparHTML(h.valor_anterior)}</span>
                        <i class="fas fa-arrow-right mx-1 text-primary" style="font-size: 0.65rem;"></i>
                        <strong class="text-dark">${escaparHTML(h.valor_nuevo)}</strong>
                    </div>
                </div>
            `).join('');
        }
    }
}

function poblarCamposModalDetalle(tarea) {
    if (!tarea) return;
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };

    setVal('detalleTareaId', tarea.id);
    setTxt('detalleClaveBadge', tarea.clave_incidencia || '');
    setTxt('detalleProyectoTexto', tarea.proyecto_nombre || 'IT Network & Systems');
    setVal('detalleTitulo', tarea.titulo || '');
    setVal('detalleDescripcion', tarea.descripcion || '');
    setVal('detalleEstado', tarea.estado || 'Por-Hacer');
    setVal('detallePrioridad', tarea.prioridad || 'Media');
    setVal('detalleComponente', tarea.componente || 'General');
    setVal('detalleFechaLimite', (tarea.fecha_limite || tarea.fecha_calendario || tarea.fecha_creacion || '').slice(0, 10));
    setVal('detalleHoras', tarea.horas_registradas ?? 0);
    setTxt('detalleAsignado', tarea.asignado_nombre || 'Abel Martinez');

    const selAsig = document.getElementById('detalleAsignadoSelect');
    if (selAsig && tarea.asignado_id) {
        selAsig.value = String(tarea.asignado_id);
    }

    if (tarea.comentarios || tarea.historial) {
        renderizarComentariosEHistorial(tarea.comentarios, tarea.historial);
    }
}

// Abrir el modal de templates/partials/detalle_incidencia.html al hacer clic en una incidencia
window.abrirDetalleIncidencia = function(tareaId) {
    if (tareaId == null) return;
    const modalEl = document.getElementById('detalleIncidenciaModal');
    if (!modalEl) return;

    const inputCom = document.getElementById('inputNuevoComentario');
    if (inputCom) inputCom.value = '';

    const tareaEnCache = window.TAREAS_CACHE_GLOBAL[String(tareaId)];
    if (tareaEnCache) {
        poblarCamposModalDetalle(tareaEnCache);
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    fetch(`/api/tareas/${tareaId}`)
        .then(res => {
            if (!res.ok) throw new Error('Incidencia no encontrada');
            return res.json();
        })
        .then(tarea => {
            window.TAREAS_CACHE_GLOBAL[String(tarea.id)] = tarea;
            poblarCamposModalDetalle(tarea);
            renderizarComentariosEHistorial(tarea.comentarios, tarea.historial);
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        })
        .catch(err => console.error('Error al abrir detalle de incidencia:', err));
};

function enviarNuevoComentarioModal() {
    const tareaId = document.getElementById('detalleTareaId')?.value;
    const inputCom = document.getElementById('inputNuevoComentario');
    if (!tareaId || !inputCom) return;

    const texto = inputCom.value.trim();
    if (!texto) return;

    const autorActual = (window.USUARIO_ACTUAL_SESION && window.USUARIO_ACTUAL_SESION.nombre) || 'Abel Martinez';

    fetch(`/api/tareas/${tareaId}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: texto, autor: autorActual })
    })
    .then(res => {
        if (!res.ok) throw new Error('Error al guardar comentario');
        return res.json();
    })
    .then(data => {
        inputCom.value = '';
        if (window.TAREAS_CACHE_GLOBAL[String(tareaId)]) {
            window.TAREAS_CACHE_GLOBAL[String(tareaId)].comentarios = data.comentarios;
            window.TAREAS_CACHE_GLOBAL[String(tareaId)].historial = data.historial;
        }
        renderizarComentariosEHistorial(data.comentarios, data.historial);
    })
    .catch(err => console.error('Error al agregar comentario:', err));
}

document.addEventListener('DOMContentLoaded', function() {
    window.cargarSesionUsuariosGlobal();
    window.cargarProyectosGlobales();

    const selectorProy = document.getElementById('selectorProyectoGlobal');
    if (selectorProy) {
        selectorProy.addEventListener('change', function() {
            window.establecerProyectoActivoId(this.value);
        });
    }

    const buscador = document.getElementById('buscadorGlobalJira');
    if (buscador) {
        buscador.addEventListener('input', function() {
            window.dispatchEvent(new CustomEvent('busquedaGlobalJira', {
                detail: { texto: this.value.trim().toLowerCase() }
            }));
        });
    }

    const btnComentar = document.getElementById('btnAgregarComentario');
    const inputCom = document.getElementById('inputNuevoComentario');
    if (btnComentar) {
        btnComentar.addEventListener('click', enviarNuevoComentarioModal);
    }
    if (inputCom) {
        inputCom.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                enviarNuevoComentarioModal();
            }
        });
    }

    // Eliminar incidencia desde el modal (Exclusivo Owner)
    const btnEliminarInc = document.getElementById('btnEliminarIncidenciaModal');
    if (btnEliminarInc) {
        btnEliminarInc.addEventListener('click', function() {
            const tareaId = document.getElementById('detalleTareaId')?.value;
            if (!tareaId) return;

            fetch(`/api/tareas/${tareaId}`, { method: 'DELETE' })
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.detail || 'No tienes permiso para eliminar');
                    return data;
                })
                .then(() => {
                    const modalEl = document.getElementById('detalleIncidenciaModal');
                    const modalInst = bootstrap.Modal.getInstance(modalEl);
                    if (modalInst) modalInst.hide();
                    window.dispatchEvent(new CustomEvent('incidenciasActualizadas'));
                })
                .catch(err => alert(err.message));
        });
    }

    // Envío asíncrono de Crear Incidencia
    const formCrearIncidencia = document.getElementById('formCrearIncidencia');
    if (formCrearIncidencia) {
        formCrearIncidencia.addEventListener('submit', function(e) {
            e.preventDefault();
            const hiddenProy = document.getElementById('modalIncidenciaProyecto');
            const proyActivo = window.obtenerProyectoActivoId();
            if (hiddenProy) {
                hiddenProy.value = proyActivo || (window.PROYECTOS_GLOBAL[0] ? String(window.PROYECTOS_GLOBAL[0].id) : '1');
            }
            const formData = new FormData(formCrearIncidencia);
            fetch('/api/tareas', {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                body: formData
            })
            .then(res => {
                if (!res.ok) throw new Error('Error al crear tarea');
                return res.json();
            })
            .then(() => {
                const modalEl = document.getElementById('crearIncidenciaModal');
                const modalInst = bootstrap.Modal.getInstance(modalEl);
                if (modalInst) modalInst.hide();
                formCrearIncidencia.reset();
                window.cargarProyectosGlobales();
                window.dispatchEvent(new CustomEvent('incidenciasActualizadas'));
            })
            .catch(() => formCrearIncidencia.submit());
        });
    }

    // Envío asíncrono de Crear Proyecto
    const formProyecto = document.querySelector('#crearProyectoModal form');
    if (formProyecto) {
        formProyecto.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(formProyecto);
            fetch('/api/proyectos', {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                body: formData
            })
            .then(res => {
                if (!res.ok) throw new Error('Error al crear proyecto');
                return res.json();
            })
            .then(resp => {
                const modalEl = document.getElementById('crearProyectoModal');
                const modalInst = bootstrap.Modal.getInstance(modalEl);
                if (modalInst) modalInst.hide();
                formProyecto.reset();
                window.cargarProyectosGlobales().then(() => {
                    if (resp && resp.proyecto && resp.proyecto.id) {
                        window.establecerProyectoActivoId(resp.proyecto.id);
                    }
                    window.dispatchEvent(new CustomEvent('incidenciasActualizadas'));
                });
            })
            .catch(() => formProyecto.submit());
        });
    }

    // Guardar cambios en detalle_incidencia.html
    const formDetalle = document.getElementById('formDetalleIncidencia');
    if (formDetalle) {
        formDetalle.addEventListener('submit', function(e) {
            e.preventDefault();
            const tareaId = document.getElementById('detalleTareaId').value;
            if (!tareaId) return;

            const inputComentarioPendiente = document.getElementById('inputNuevoComentario');
            const textoPendiente = inputComentarioPendiente ? inputComentarioPendiente.value.trim() : '';
            const autorActual = (window.USUARIO_ACTUAL_SESION && window.USUARIO_ACTUAL_SESION.nombre) || 'Abel Martinez';

            const payload = {
                titulo: document.getElementById('detalleTitulo').value,
                descripcion: document.getElementById('detalleDescripcion').value,
                estado: document.getElementById('detalleEstado').value,
                prioridad: document.getElementById('detallePrioridad').value,
                componente: document.getElementById('detalleComponente').value,
                fecha_limite: document.getElementById('detalleFechaLimite').value,
                horas_registradas: Number(document.getElementById('detalleHoras').value || 0),
                asignado_id: Number(document.getElementById('detalleAsignadoSelect')?.value || 0) || undefined
            };

            const promesaComentario = textoPendiente
                ? fetch(`/api/tareas/${tareaId}/comentarios`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ contenido: textoPendiente, autor: autorActual })
                  }).then(() => { if (inputComentarioPendiente) inputComentarioPendiente.value = ''; })
                : Promise.resolve();

            promesaComentario
                .then(() => fetch(`/api/tareas/${tareaId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }))
                .then(res => {
                    if (!res.ok) throw new Error('Error al guardar cambios');
                    return res.json();
                })
                .then(() => {
                    const modalEl = document.getElementById('detalleIncidenciaModal');
                    const modalInst = bootstrap.Modal.getInstance(modalEl);
                    if (modalInst) modalInst.hide();
                    window.dispatchEvent(new CustomEvent('incidenciasActualizadas'));
                })
                .catch(err => console.error('Error al actualizar incidencia:', err));
        });
    }
});
