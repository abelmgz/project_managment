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
    window.cargarSesionUsuariosGlobal().then((actual) => {
        window.dispatchEvent(new CustomEvent('usuarioSesionCambiado', { detail: { usuarioId: val } }));
        window.dispatchEvent(new CustomEvent('incidenciasActualizadas'));
        if (actual && window.mostrarNotificacion) {
            window.mostrarNotificacion(`Sesión activa cambiada a ${actual.nombre} (${actual.rol})`, 'info', 'Cambio de Sesión');
        }
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

window.establecerProyectoActivoId = function(proyectoId, infoProyectoExtra = null) {
    const val = proyectoId ? String(proyectoId) : '';
    if (val && infoProyectoExtra) {
        if (!window.PROYECTOS_GLOBAL.some(p => String(p.id) === val)) {
            window.PROYECTOS_GLOBAL.push({
                id: Number(val),
                nombre: infoProyectoExtra.nombre || 'Proyecto',
                clave_proyecto: infoProyectoExtra.clave || 'PROY',
                descripcion: ''
            });
        }
        const selector = document.getElementById('selectorProyectoGlobal');
        if (selector && !selector.querySelector(`option[value="${val}"]`)) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = `${infoProyectoExtra.nombre || 'Proyecto'} (${infoProyectoExtra.clave || 'PROY'})`;
            selector.appendChild(opt);
        }
    }
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

// --- SISTEMA GLOBAL DE NOTIFICACIONES FLOTANTES (ABAJO A LA DERECHA) ---
window.mostrarNotificacion = function(mensaje, tipo = 'success', titulo = '') {
    const contenedor = document.getElementById('jiraToastContainer');
    if (!contenedor) return;

    const configuracionTipos = {
        success: { clase: 'toast-tipo-success', icono: 'fa-check-circle', tituloDefault: 'Acción Completada' },
        info: { clase: 'toast-tipo-info', icono: 'fa-info-circle', tituloDefault: 'Actualización' },
        warning: { clase: 'toast-tipo-warning', icono: 'fa-exclamation-circle', tituloDefault: 'Aviso' },
        danger: { clase: 'toast-tipo-danger', icono: 'fa-trash-alt', tituloDefault: 'Elemento Eliminado' }
    };

    const cfg = configuracionTipos[tipo] || configuracionTipos.info;
    const tituloFinal = titulo || cfg.tituloDefault;

    const item = document.createElement('div');
    item.className = `jira-toast-item ${cfg.clase}`;
    item.innerHTML = `
        <i class="fas ${cfg.icono} jira-toast-icon"></i>
        <div class="jira-toast-body">
            <div class="jira-toast-title">${escaparHTML(tituloFinal)}</div>
            <div class="jira-toast-text">${escaparHTML(mensaje)}</div>
        </div>
        <button type="button" class="jira-toast-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>
    `;

    const cerrarToast = () => {
        item.classList.add('toast-hiding');
        setTimeout(() => {
            if (item.parentNode) item.parentNode.removeChild(item);
        }, 200);
    };

    item.querySelector('.jira-toast-close')?.addEventListener('click', cerrarToast);
    contenedor.appendChild(item);

    setTimeout(cerrarToast, 3800);
};

// --- POPUP DE ADVERTENCIA PARA CONFIRMAR ELIMINACIÓN (OK / CANCELAR) ---
window.confirmarEliminacion = function(opciones = {}) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('modalConfirmarEliminacion');
        const tituloEl = document.getElementById('modalConfirmarTitulo');
        const mensajeEl = document.getElementById('modalConfirmarMensaje');
        const btnOk = document.getElementById('btnConfirmarOk');
        const btnCancelar = document.getElementById('btnConfirmarCancelar');

        if (!modalEl || !btnOk || !window.bootstrap) {
            resolve(confirm(opciones.mensaje || '¿Estás seguro de que deseas borrar este elemento?'));
            return;
        }

        if (tituloEl) tituloEl.textContent = opciones.titulo || 'Advertencia de Eliminación';
        if (mensajeEl) mensajeEl.textContent = opciones.mensaje || '¿Estás seguro de que deseas borrar este registro?';

        const modalInst = bootstrap.Modal.getOrCreateInstance(modalEl);
        let resuelto = false;

        const limpiarYResolver = (valor) => {
            if (resuelto) return;
            resuelto = true;
            btnOk.removeEventListener('click', onOk);
            if (btnCancelar) btnCancelar.removeEventListener('click', onCancel);
            modalEl.removeEventListener('hidden.bs.modal', onHidden);
            resolve(valor);
        };

        const onOk = () => {
            limpiarYResolver(true);
            modalInst.hide();
        };

        const onCancel = () => {
            limpiarYResolver(false);
        };

        const onHidden = () => {
            limpiarYResolver(false);
        };

        btnOk.addEventListener('click', onOk);
        if (btnCancelar) btnCancelar.addEventListener('click', onCancel);
        modalEl.addEventListener('hidden.bs.modal', onHidden);

        modalInst.show();
    });
};

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
            contComentarios.scrollTop = 0;
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

window.obtenerFechaHoyLocalISO = function() {
    const ahora = new Date();
    const y = ahora.getFullYear();
    const m = String(ahora.getMonth() + 1).padStart(2, '0');
    const d = String(ahora.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

function poblarCamposModalDetalle(tarea) {
    if (!tarea) return;
    const hoyLocal = window.obtenerFechaHoyLocalISO();
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
    setVal('detalleFechaInicio', (tarea.fecha_inicio || tarea.fecha_creacion || hoyLocal).slice(0, 10));
    setVal('detalleFechaLimite', (tarea.due_date || tarea.fecha_limite || tarea.fecha_calendario || hoyLocal).slice(0, 10));
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
        if (window.mostrarNotificacion) {
            window.mostrarNotificacion('Comentario publicado en la incidencia.', 'success', 'Nuevo Comentario');
        }
    })
    .catch(err => {
        console.error('Error al agregar comentario:', err);
        if (window.mostrarNotificacion) {
            window.mostrarNotificacion('No se pudo publicar el comentario.', 'danger', 'Error');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    window.cargarSesionUsuariosGlobal();
    window.cargarProyectosGlobales();

    const selectorProy = document.getElementById('selectorProyectoGlobal');
    if (selectorProy) {
        selectorProy.addEventListener('change', function() {
            window.establecerProyectoActivoId(this.value);
            if (window.mostrarNotificacion) {
                const textoSel = this.options[this.selectedIndex]?.textContent || 'Todos los proyectos';
                window.mostrarNotificacion(`Vista filtrada por: ${textoSel}`, 'info', 'Filtro de Proyecto');
            }
        });
    }

    const buscador = document.getElementById('buscadorGlobalJira');
    const dropdownBuscador = document.getElementById('buscadorGlobalDropdown');
    const btnLimpiarBuscador = document.getElementById('btnLimpiarBuscadorGlobal');
    const contenedorBuscador = document.getElementById('contenedorBuscadorGlobal');

    window.CATALOGO_GLOBAL_INCIDENCIAS = [];
    let resultadosActualesBuscador = [];
    let indiceActivoBuscador = -1;
    let timerDebounceBuscador = null;

    window.cargarCatalogoBusquedaGlobal = function() {
        return fetch('/api/tareas/buscar')
            .then(res => res.ok ? res.json() : [])
            .then(lista => {
                window.CATALOGO_GLOBAL_INCIDENCIAS = Array.isArray(lista) ? lista : [];
                window.registrarTareasEnCache(window.CATALOGO_GLOBAL_INCIDENCIAS);
                return window.CATALOGO_GLOBAL_INCIDENCIAS;
            })
            .catch(() => []);
    };

    window.cargarCatalogoBusquedaGlobal();
    window.addEventListener('incidenciasActualizadas', window.cargarCatalogoBusquedaGlobal);
    window.addEventListener('usuarioSesionCambiado', window.cargarCatalogoBusquedaGlobal);

    function resaltarTextoBusqueda(textoOriginal, termino) {
        const seguro = escaparHTML(textoOriginal || '');
        if (!termino) return seguro;
        const termEscapado = escaparHTML(termino).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!termEscapado) return seguro;
        try {
            const regex = new RegExp(`(${termEscapado})`, 'gi');
            return seguro.replace(regex, '<mark class="jira-search-highlight">$1</mark>');
        } catch (_) {
            return seguro;
        }
    }

    function cerrarDropdownBuscador() {
        if (dropdownBuscador) {
            dropdownBuscador.classList.add('d-none');
            dropdownBuscador.innerHTML = '';
        }
        resultadosActualesBuscador = [];
        indiceActivoBuscador = -1;
    }

    function actualizarHighlightTecladoBuscador() {
        if (!dropdownBuscador) return;
        const items = dropdownBuscador.querySelectorAll('.jira-search-item');
        items.forEach((el, idx) => {
            if (idx === indiceActivoBuscador) {
                el.classList.add('active');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('active');
            }
        });
    }

    window.seleccionarTareaDesdeBuscador = function(tarea) {
        if (!tarea) return;
        cerrarDropdownBuscador();
        if (buscador) {
            buscador.value = '';
            buscador.blur();
        }
        if (btnLimpiarBuscador) {
            btnLimpiarBuscador.classList.add('d-none');
        }

        window.registrarTareasEnCache([tarea]);

        const proyectoIdDestino = tarea.proyecto_id != null ? String(tarea.proyecto_id) : '';
        if (proyectoIdDestino) {
            window.establecerProyectoActivoId(proyectoIdDestino, {
                nombre: tarea.proyecto_nombre || 'Proyecto',
                clave: tarea.proyecto_clave || 'PROY'
            });
        }

        window.dispatchEvent(new CustomEvent('tareaSeleccionadaBuscador', { detail: { tarea } }));

        if (window.mostrarNotificacion) {
            window.mostrarNotificacion(
                `Proyecto seleccionado: ${tarea.proyecto_nombre || 'Proyecto'} (${tarea.proyecto_clave || ''}) · Mostrando ${tarea.clave_incidencia}`,
                'info',
                'Incidencia Encontrada'
            );
        }

        const rutaActual = window.location.pathname;
        if (rutaActual === '/proyectos' || rutaActual === '/usuarios') {
            window.location.href = `/kanban?abrir_tarea=${encodeURIComponent(tarea.id)}`;
            return;
        }

        window.abrirDetalleIncidencia(tarea.id);
    };

    function renderizarResultadosAutocompletado(lista, termino) {
        if (!dropdownBuscador) return;
        resultadosActualesBuscador = Array.isArray(lista) ? lista.slice(0, 12) : [];
        indiceActivoBuscador = resultadosActualesBuscador.length > 0 ? 0 : -1;

        if (resultadosActualesBuscador.length === 0) {
            dropdownBuscador.innerHTML = `
                <div class="jira-search-header">
                    <span>Búsqueda global (Todos los proyectos)</span>
                    <span>0 resultados</span>
                </div>
                <div class="p-3 text-center text-muted" style="font-size: 0.82rem;">
                    <i class="fas fa-search me-1"></i>No se encontraron incidencias para "<strong>${escaparHTML(termino)}</strong>" en ningún proyecto.
                </div>
            `;
            dropdownBuscador.classList.remove('d-none');
            return;
        }

        const itemsHtml = resultadosActualesBuscador.map((t, idx) => {
            const claveHtml = resaltarTextoBusqueda(t.clave_incidencia || `#${t.id}`, termino);
            const tituloHtml = resaltarTextoBusqueda(t.titulo || '', termino);
            const proyTexto = `${t.proyecto_nombre || 'Proyecto'}${t.proyecto_clave ? ` (${t.proyecto_clave})` : ''}`;
            const proyHtml = resaltarTextoBusqueda(proyTexto, termino);
            const compHtml = resaltarTextoBusqueda(t.componente || 'General', termino);
            const asigHtml = resaltarTextoBusqueda(t.asignado_nombre || 'Abel Martinez', termino);
            const dueStr = (t.due_date || t.fecha_limite || '').slice(0, 10);

            return `
                <div class="jira-search-item ${idx === 0 ? 'active' : ''}" data-search-index="${idx}" role="option">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-1">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="jira-search-key">${claveHtml}</span>
                            <span class="jira-search-project-badge"><i class="fas fa-folder-open text-primary me-1"></i>${proyHtml}</span>
                        </div>
                        <span class="badge bg-light text-dark border" style="font-size: 0.68rem;">${escaparHTML(t.estado || 'Por-Hacer')}</span>
                    </div>
                    <div class="jira-search-title">${tituloHtml}</div>
                    <div class="jira-search-meta">
                        <span><i class="fas fa-flag me-1"></i>${escaparHTML(t.prioridad || 'Media')}</span>
                        <span><i class="fas fa-tag me-1"></i>${compHtml}</span>
                        <span><i class="far fa-user me-1"></i>${asigHtml}</span>
                        ${dueStr ? `<span><i class="far fa-calendar-alt text-danger me-1"></i>Due: ${escaparHTML(dueStr)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        dropdownBuscador.innerHTML = `
            <div class="jira-search-header">
                <span><i class="fas fa-globe-americas me-1 text-primary"></i>Autocompletado Global (Sin filtro de proyecto)</span>
                <span>${resultadosActualesBuscador.length} ${resultadosActualesBuscador.length === 1 ? 'incidencia' : 'incidencias'}</span>
            </div>
            ${itemsHtml}
        `;
        dropdownBuscador.classList.remove('d-none');

        dropdownBuscador.querySelectorAll('.jira-search-item').forEach(itemEl => {
            itemEl.addEventListener('mouseenter', function() {
                const idx = Number(this.getAttribute('data-search-index'));
                if (!Number.isNaN(idx)) {
                    indiceActivoBuscador = idx;
                    actualizarHighlightTecladoBuscador();
                }
            });
            itemEl.addEventListener('mousedown', function(e) {
                // mousedown se ejecuta antes de blur para garantizar selección inmediata al hacer clic
                e.preventDefault();
                const idx = Number(this.getAttribute('data-search-index'));
                const tareaElegida = resultadosActualesBuscador[idx];
                if (tareaElegida) {
                    window.seleccionarTareaDesdeBuscador(tareaElegida);
                }
            });
        });
    }

    function filtrarCatalogoLocal(termino) {
        const q = (termino || '').trim().toLowerCase();
        if (!q) return window.CATALOGO_GLOBAL_INCIDENCIAS.slice(0, 10);
        return window.CATALOGO_GLOBAL_INCIDENCIAS.filter(t => {
            const blob = [
                t.clave_incidencia,
                t.titulo,
                t.descripcion,
                t.componente,
                t.proyecto_nombre,
                t.proyecto_clave,
                t.asignado_nombre,
                t.estado
            ].join(' ').toLowerCase();
            return blob.includes(q);
        });
    }

    function ejecutarAutocompletadoBuscador(mostrarSiVacio = false) {
        if (!buscador) return;
        const textoRaw = buscador.value.trim();
        if (btnLimpiarBuscador) {
            btnLimpiarBuscador.classList.toggle('d-none', textoRaw.length === 0);
        }

        if (!textoRaw && !mostrarSiVacio) {
            cerrarDropdownBuscador();
            return;
        }

        // 1. Respuesta inmediata desde el catálogo global en memoria (sin filtro de proyecto)
        const locales = filtrarCatalogoLocal(textoRaw);
        renderizarResultadosAutocompletado(locales, textoRaw);

        // 2. Sincronización con el backend (/api/tareas/buscar) sin tomar en cuenta el filtro de proyectos
        if (timerDebounceBuscador) clearTimeout(timerDebounceBuscador);
        timerDebounceBuscador = setTimeout(() => {
            const url = textoRaw
                ? `/api/tareas/buscar?q=${encodeURIComponent(textoRaw)}`
                : '/api/tareas/buscar';
            fetch(url)
                .then(res => res.ok ? res.json() : [])
                .then(remotas => {
                    if (!Array.isArray(remotas)) return;
                    window.registrarTareasEnCache(remotas);
                    if (!textoRaw) {
                        window.CATALOGO_GLOBAL_INCIDENCIAS = remotas;
                    }
                    if (document.activeElement === buscador && buscador.value.trim() === textoRaw) {
                        renderizarResultadosAutocompletado(remotas, textoRaw);
                    }
                })
                .catch(() => {});
        }, 120);
    }

    if (buscador) {
        buscador.addEventListener('input', function() {
            ejecutarAutocompletadoBuscador(false);
        });

        buscador.addEventListener('focus', function() {
            if (this.value.trim().length > 0) {
                ejecutarAutocompletadoBuscador(false);
            } else if (window.CATALOGO_GLOBAL_INCIDENCIAS.length > 0) {
                ejecutarAutocompletadoBuscador(true);
            } else {
                window.cargarCatalogoBusquedaGlobal().then(() => {
                    if (document.activeElement === buscador) {
                        ejecutarAutocompletadoBuscador(true);
                    }
                });
            }
        });

        buscador.addEventListener('keydown', function(e) {
            if (!dropdownBuscador || dropdownBuscador.classList.contains('d-none')) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    ejecutarAutocompletadoBuscador(true);
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (resultadosActualesBuscador.length > 0) {
                    indiceActivoBuscador = (indiceActivoBuscador + 1) % resultadosActualesBuscador.length;
                    actualizarHighlightTecladoBuscador();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (resultadosActualesBuscador.length > 0) {
                    indiceActivoBuscador = (indiceActivoBuscador - 1 + resultadosActualesBuscador.length) % resultadosActualesBuscador.length;
                    actualizarHighlightTecladoBuscador();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const idx = indiceActivoBuscador >= 0 ? indiceActivoBuscador : 0;
                const tareaElegida = resultadosActualesBuscador[idx];
                if (tareaElegida) {
                    window.seleccionarTareaDesdeBuscador(tareaElegida);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cerrarDropdownBuscador();
            }
        });
    }

    if (btnLimpiarBuscador) {
        btnLimpiarBuscador.addEventListener('click', function() {
            if (buscador) {
                buscador.value = '';
                buscador.focus();
            }
            btnLimpiarBuscador.classList.add('d-none');
            cerrarDropdownBuscador();
        });
    }

    document.addEventListener('click', function(e) {
        if (contenedorBuscador && !contenedorBuscador.contains(e.target)) {
            cerrarDropdownBuscador();
        }
    });

    // Si se redirigió con ?abrir_tarea=ID desde otra vista, sincronizar proyecto y abrir el modal de la tarea
    const paramsUrl = new URLSearchParams(window.location.search);
    const idTareaAbrirUrl = paramsUrl.get('abrir_tarea');
    if (idTareaAbrirUrl && /^\d+$/.test(idTareaAbrirUrl)) {
        paramsUrl.delete('abrir_tarea');
        const nuevaQuery = paramsUrl.toString();
        const urlLimpia = window.location.pathname + (nuevaQuery ? `?${nuevaQuery}` : '');
        window.history.replaceState({}, '', urlLimpia);

        fetch(`/api/tareas/${idTareaAbrirUrl}`)
            .then(res => res.ok ? res.json() : null)
            .then(tarea => {
                if (!tarea) return;
                window.registrarTareasEnCache([tarea]);
                if (tarea.proyecto_id != null) {
                    window.establecerProyectoActivoId(String(tarea.proyecto_id), {
                        nombre: tarea.proyecto_nombre || 'Proyecto',
                        clave: tarea.proyecto_clave || 'PROY'
                    });
                }
                window.abrirDetalleIncidencia(tarea.id);
            })
            .catch(() => {});
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

    // Eliminar incidencia desde el modal con popup de advertencia (OK / Cancelar)
    const btnEliminarInc = document.getElementById('btnEliminarIncidenciaModal');
    if (btnEliminarInc) {
        btnEliminarInc.addEventListener('click', async function() {
            const tareaId = document.getElementById('detalleTareaId')?.value;
            if (!tareaId) return;

            const claveTxt = document.getElementById('detalleClaveBadge')?.textContent || `#${tareaId}`;
            const tituloTxt = document.getElementById('detalleTitulo')?.value || '';

            const confirmado = await window.confirmarEliminacion({
                titulo: 'Advertencia: Borrar Tarea',
                mensaje: `¿Estás seguro de que deseas borrar la tarea "${claveTxt} — ${tituloTxt}"? Se eliminarán también sus comentarios e historial.`
            });
            if (!confirmado) return;

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
                    if (window.mostrarNotificacion) {
                        window.mostrarNotificacion(`La tarea ${claveTxt} fue borrada permanentemente.`, 'danger', 'Tarea Eliminada');
                    }
                })
                .catch(err => {
                    if (window.mostrarNotificacion) {
                        window.mostrarNotificacion(err.message, 'danger', 'Acción Denegada');
                    }
                });
        });
    }

    // Inicializar fechas por defecto en el día de hoy y botones "Hoy" para inputs de fecha
    function inicializarFechasCrearIncidencia() {
        const hoyIso = window.obtenerFechaHoyLocalISO();
        const inpIni = document.getElementById('crearFechaInicio');
        const inpDue = document.getElementById('crearFechaDueDate');
        if (inpIni) inpIni.value = hoyIso;
        if (inpDue) inpDue.value = hoyIso;
    }
    inicializarFechasCrearIncidencia();

    const modalCrearEl = document.getElementById('crearIncidenciaModal');
    if (modalCrearEl) {
        modalCrearEl.addEventListener('show.bs.modal', inicializarFechasCrearIncidencia);
    }

    document.querySelectorAll('.btn-ir-hoy-fecha[data-target-input]').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target-input');
            const inputEl = document.getElementById(targetId);
            if (!inputEl) return;
            inputEl.value = window.obtenerFechaHoyLocalISO();
            inputEl.focus();
            if (typeof inputEl.showPicker === 'function') {
                try { inputEl.showPicker(); } catch (_) {}
            }
            if (window.mostrarNotificacion) {
                window.mostrarNotificacion(`Fecha establecida en el día de hoy (${inputEl.value}).`, 'info', 'Fecha Actualizada');
            }
        });
    });

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
            .then((resp) => {
                const modalEl = document.getElementById('crearIncidenciaModal');
                const modalInst = bootstrap.Modal.getInstance(modalEl);
                if (modalInst) modalInst.hide();
                formCrearIncidencia.reset();
                inicializarFechasCrearIncidencia();
                window.cargarProyectosGlobales();
                window.dispatchEvent(new CustomEvent('incidenciasActualizadas'));
                if (window.mostrarNotificacion) {
                    window.mostrarNotificacion(`Incidencia ${resp.clave_incidencia || ''} registrada exitosamente.`, 'success', 'Tarea Creada');
                }
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
                    if (resp && resp.proyecto && resp.proyecto.id && (!resp.proyecto.estado || resp.proyecto.estado === 'En proceso')) {
                        window.establecerProyectoActivoId(resp.proyecto.id);
                    }
                    window.dispatchEvent(new CustomEvent('incidenciasActualizadas'));
                    if (window.mostrarNotificacion) {
                        const nomProy = (resp && resp.proyecto && resp.proyecto.nombre) || 'Nuevo proyecto';
                        window.mostrarNotificacion(`El proyecto "${nomProy}" ha sido creado.`, 'success', 'Proyecto Creado');
                    }
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
                fecha_inicio: document.getElementById('detalleFechaInicio')?.value || '',
                fecha_limite: document.getElementById('detalleFechaLimite')?.value || '',
                due_date: document.getElementById('detalleFechaLimite')?.value || '',
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
                    if (window.mostrarNotificacion) {
                        window.mostrarNotificacion(`Cambios guardados en la incidencia "${payload.titulo}".`, 'info', 'Tarea Actualizada');
                    }
                })
                .catch(err => {
                    console.error('Error al actualizar incidencia:', err);
                    if (window.mostrarNotificacion) {
                        window.mostrarNotificacion('No se pudieron guardar los cambios.', 'danger', 'Error al Guardar');
                    }
                });
        });
    }
});
