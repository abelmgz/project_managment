// static/js/pages/usuarios.js
document.addEventListener('DOMContentLoaded', function() {
    const tablaCuerpo = document.getElementById('tablaUsuariosCuerpo');
    if (!tablaCuerpo) return;

    let datosRespuesta = null;

    const ETIQUETAS_PERMISOS = {
        ver_todo: 'Ver todas las actividades',
        ver_propias: 'Ver solo mis actividades',
        ver_usuarios: 'Ver todos los usuarios',
        gestionar_usuarios: 'Administrar usuarios',
        crear_editar: 'Crear/Editar tareas',
        crear_propias: 'Crear tareas propias',
        comentar: 'Comentar incidencias',
        eliminar_todo: 'Eliminar registros (Owner)'
    };

    function obtenerIniciales(nombre) {
        return String(nombre || 'U')
            .trim()
            .split(/\s+/)
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    function sincronizarChecksSegunRol(rol) {
        const cPropias = document.getElementById('permVerPropias');
        const cTodo = document.getElementById('permVerTodo');
        const cVerUsu = document.getElementById('permVerUsuarios');
        const cGestUsu = document.getElementById('permGestionarUsuarios');
        const cEliminar = document.getElementById('permEliminarTodo');

        if (rol === 'Owner') {
            cPropias.checked = true;
            cTodo.checked = true;
            cVerUsu.checked = true;
            cGestUsu.checked = true;
            cEliminar.checked = true;
            cEliminar.disabled = false;
        } else if (rol === 'Administrador') {
            cPropias.checked = true;
            cTodo.checked = true;
            cVerUsu.checked = true;
            cGestUsu.checked = true;
            cEliminar.checked = false;
            cEliminar.disabled = true;
        } else {
            cPropias.checked = true;
            cTodo.checked = false;
            cVerUsu.checked = false;
            cGestUsu.checked = false;
            cEliminar.checked = false;
            cEliminar.disabled = true;
        }
    }

    function actualizarBannerYTabla(data) {
        datosRespuesta = data;
        const actual = data.usuario_actual;
        const listaUsuarios = data.usuarios || [];
        const perfiles = data.perfiles_disponibles || [];

        // Actualizar banner superior
        document.getElementById('bannerAvatar').textContent = obtenerIniciales(actual.nombre);
        document.getElementById('bannerNombre').textContent = `${actual.nombre} (${actual.email})`;
        const badgeRol = document.getElementById('bannerRolBadge');
        badgeRol.className = `badge badge-rol-${actual.rol}`;
        badgeRol.textContent = actual.rol.toUpperCase();

        const descEl = document.getElementById('bannerDescripcionPermisos');
        if (actual.rol === 'Owner') {
            descEl.textContent = 'Rol Owner activo: Puedes ver todas las actividades, administrar todos los usuarios y eres el único con privilegios para eliminar.';
        } else if (actual.rol === 'Administrador') {
            descEl.textContent = 'Rol Administrador activo: Puedes ver todos los usuarios y todas las actividades del sistema, pero no tienes privilegios para eliminar.';
        } else {
            descEl.textContent = 'Rol Usuario activo: En toda la aplicación solo visualizas tus propias actividades asignadas y tu propio perfil.';
        }

        // Botón Nuevo Usuario solo habilitado para Administrador u Owner
        const btnNuevo = document.getElementById('btnNuevoUsuario');
        if (btnNuevo) {
            btnNuevo.style.display = actual.puede_gestionar_usuarios ? 'inline-block' : 'none';
        }

        // Poblar selector rápido de sesión
        const selSesion = document.getElementById('selectorCambioRapidoUsuario');
        if (selSesion) {
            selSesion.innerHTML = '';
            perfiles.forEach(p => {
                const opt = document.createElement('option');
                opt.value = String(p.id);
                opt.textContent = `${p.nombre} — [${p.rol}]`;
                selSesion.appendChild(opt);
            });
            selSesion.value = String(actual.id);
        }

        // Contador y tabla
        document.getElementById('contadorUsuariosTabla').textContent = `${listaUsuarios.length} usuario(s) visible(s)`;
        tablaCuerpo.innerHTML = '';

        listaUsuarios.forEach(u => {
            const tr = document.createElement('tr');
            const esActual = u.id === actual.id;

            const chipsPermisos = (u.lista_permisos || []).map(p => {
                const claseExtra = p === 'eliminar_todo' ? 'perm-chip-danger' : '';
                return `<span class="perm-chip ${claseExtra}">${ETIQUETAS_PERMISOS[p] || p}</span>`;
            }).join('');

            // Acciones según rol del usuario activo en sesión
            let botonesAccion = '';

            if (!esActual) {
                botonesAccion += `
                    <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-action="activar" data-id="${u.id}" title="Ingresar como ${u.nombre}">
                        <i class="fas fa-sign-in-alt me-1"></i> Usar Perfil
                    </button>
                `;
            } else {
                botonesAccion += `<span class="badge bg-success-subtle text-success border border-success-subtle me-1">En Sesión</span>`;
            }

            if (actual.puede_gestionar_usuarios && (actual.rol === 'Owner' || u.rol !== 'Owner')) {
                botonesAccion += `
                    <button type="button" class="btn btn-sm btn-light border me-1" data-action="editar" data-id="${u.id}" title="Editar usuario y rol">
                        <i class="fas fa-pen text-primary"></i>
                    </button>
                `;
            }

            // Solo el Owner puede ver y usar el botón de eliminar
            if (actual.rol === 'Owner' && !esActual) {
                botonesAccion += `
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="eliminar" data-id="${u.id}" title="Eliminar usuario (Exclusivo Owner)">
                        <i class="far fa-trash-alt"></i>
                    </button>
                `;
            }

            tr.innerHTML = `
                <td class="ps-4 py-3">
                    <div class="d-flex align-items-center gap-2">
                        <div class="avatar-user-sm">${obtenerIniciales(u.nombre)}</div>
                        <div>
                            <div class="fw-bold text-dark">${u.nombre}</div>
                            <small class="text-muted">${u.email}</small>
                        </div>
                    </div>
                </td>
                <td class="text-secondary fw-medium">${u.cargo || 'Ingeniero de Red'}</td>
                <td><span class="badge badge-rol-${u.rol}">${u.rol.toUpperCase()}</span></td>
                <td>${chipsPermisos}</td>
                <td class="text-center"><span class="badge bg-light text-dark border">${u.total_tareas || 0}</span></td>
                <td class="pe-4 text-end text-nowrap">${botonesAccion}</td>
            `;
            tablaCuerpo.appendChild(tr);
        });

        // Eventos en botones de la tabla
        tablaCuerpo.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', function() {
                const accion = this.getAttribute('data-action');
                const uid = Number(this.getAttribute('data-id'));
                if (accion === 'activar') {
                    window.establecerUsuarioActivoId(uid);
                } else if (accion === 'editar') {
                    abrirModalEdicion(uid);
                } else if (accion === 'eliminar') {
                    eliminarUsuario(uid);
                }
            });
        });
    }

    function cargarDirectorioUsuarios() {
        const uid = window.obtenerUsuarioActivoId ? window.obtenerUsuarioActivoId() : '';
        const url = uid ? `/api/usuarios?usuario_id=${encodeURIComponent(uid)}` : '/api/usuarios';
        fetch(url)
            .then(res => res.json())
            .then(data => actualizarBannerYTabla(data))
            .catch(err => console.error('Error al cargar directorio de usuarios:', err));
    }

    function abrirModalNuevo() {
        const actual = datosRespuesta && datosRespuesta.usuario_actual;
        document.getElementById('usuarioIdEditar').value = '';
        document.getElementById('modalUsuarioTitulo').innerHTML = '<i class="fas fa-user-plus me-1 text-primary"></i> Registrar Nuevo Usuario';
        document.getElementById('formUsuarioRBAC').reset();
        document.getElementById('alertaErrorUsuario').classList.add('d-none');

        const optOwner = document.getElementById('opcionRolOwner');
        if (optOwner) {
            optOwner.disabled = !(actual && actual.rol === 'Owner');
        }

        document.getElementById('inputUsuarioRol').value = 'Usuario';
        sincronizarChecksSegunRol('Usuario');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFormularioUsuario')).show();
    }

    function abrirModalEdicion(uid) {
        if (!datosRespuesta) return;
        const u = (datosRespuesta.usuarios || []).find(item => item.id === uid);
        if (!u) return;

        const actual = datosRespuesta.usuario_actual;
        document.getElementById('usuarioIdEditar').value = String(u.id);
        document.getElementById('modalUsuarioTitulo').innerHTML = `<i class="fas fa-user-edit me-1 text-primary"></i> Editar Usuario: ${u.nombre}`;
        document.getElementById('alertaErrorUsuario').classList.add('d-none');

        document.getElementById('inputUsuarioNombre').value = u.nombre;
        document.getElementById('inputUsuarioEmail').value = u.email;
        document.getElementById('inputUsuarioCargo').value = u.cargo || 'Ingeniero de Red';

        const optOwner = document.getElementById('opcionRolOwner');
        if (optOwner) {
            optOwner.disabled = !(actual && actual.rol === 'Owner');
        }

        document.getElementById('inputUsuarioRol').value = u.rol;
        sincronizarChecksSegunRol(u.rol);

        const listaP = u.lista_permisos || [];
        document.querySelectorAll('.perm-check').forEach(chk => {
            chk.checked = listaP.includes(chk.value);
        });

        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFormularioUsuario')).show();
    }

    async function eliminarUsuario(uid) {
        const lista = (datosRespuesta && datosRespuesta.usuarios) ? datosRespuesta.usuarios : [];
        const u = lista.find(item => String(item.id) === String(uid));
        const nombreMostrar = u ? `${u.nombre} (${u.rol})` : `ID #${uid}`;

        if (window.confirmarEliminacion) {
            const confirmado = await window.confirmarEliminacion({
                titulo: 'Advertencia: Borrar Usuario',
                mensaje: `¿Estás seguro de que deseas borrar al usuario "${nombreMostrar}"? Esta acción no se puede deshacer.`
            });
            if (!confirmado) return;
        }

        const cabeceras = {};
        if (window.obtenerUsuarioActivoId && window.obtenerUsuarioActivoId()) {
            cabeceras['X-User-Id'] = String(window.obtenerUsuarioActivoId());
        }

        fetch(`/api/usuarios/${uid}`, {
            method: 'DELETE',
            headers: cabeceras
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al eliminar usuario');
            return data;
        })
        .then(() => {
            if (window.cargarSesionUsuariosGlobal) window.cargarSesionUsuariosGlobal();
            cargarDirectorioUsuarios();
            if (window.mostrarNotificacion) {
                window.mostrarNotificacion(
                    `El usuario "${nombreMostrar}" fue eliminado del directorio.`,
                    'danger',
                    'Usuario Eliminado'
                );
            }
        })
        .catch(err => {
            if (window.mostrarNotificacion) {
                window.mostrarNotificacion(err.message || 'No se pudo eliminar el usuario.', 'danger', 'Error');
            } else {
                alert(err.message);
            }
        });
    }

    const btnNuevo = document.getElementById('btnNuevoUsuario');
    if (btnNuevo) {
        btnNuevo.addEventListener('click', abrirModalNuevo);
    }

    const selectRolModal = document.getElementById('inputUsuarioRol');
    if (selectRolModal) {
        selectRolModal.addEventListener('change', function() {
            sincronizarChecksSegunRol(this.value);
        });
    }

    const selCambioRapido = document.getElementById('selectorCambioRapidoUsuario');
    if (selCambioRapido) {
        selCambioRapido.addEventListener('change', function() {
            if (window.establecerUsuarioActivoId) {
                window.establecerUsuarioActivoId(this.value);
            }
        });
    }

    const formUsuario = document.getElementById('formUsuarioRBAC');
    if (formUsuario) {
        formUsuario.addEventListener('submit', function(e) {
            e.preventDefault();
            const idEditar = document.getElementById('usuarioIdEditar').value;
            const rolElegido = document.getElementById('inputUsuarioRol').value;

            const permisosSeleccionados = [];
            document.querySelectorAll('.perm-check:checked').forEach(chk => {
                permisosSeleccionados.push(chk.value);
            });
            if (rolElegido === 'Usuario' && !permisosSeleccionados.includes('comentar')) {
                permisosSeleccionados.push('crear_propias', 'comentar');
            } else if (rolElegido !== 'Usuario' && !permisosSeleccionados.includes('crear_editar')) {
                permisosSeleccionados.push('crear_editar');
            }

            const payload = {
                nombre: document.getElementById('inputUsuarioNombre').value.trim(),
                email: document.getElementById('inputUsuarioEmail').value.trim(),
                cargo: document.getElementById('inputUsuarioCargo').value.trim(),
                rol: rolElegido,
                permisos: permisosSeleccionados.join(',')
            };

            const url = idEditar ? `/api/usuarios/${idEditar}` : '/api/usuarios';
            const metodo = idEditar ? 'PUT' : 'POST';
            const cabeceras = { 'Content-Type': 'application/json' };
            if (window.obtenerUsuarioActivoId && window.obtenerUsuarioActivoId()) {
                cabeceras['X-User-Id'] = String(window.obtenerUsuarioActivoId());
            }

            fetch(url, {
                method: metodo,
                headers: cabeceras,
                body: JSON.stringify(payload)
            })
            .then(async res => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.detail || 'Error al guardar usuario');
                return body;
            })
            .then(() => {
                const modalEl = document.getElementById('modalFormularioUsuario');
                const modalInst = bootstrap.Modal.getInstance(modalEl);
                if (modalInst) modalInst.hide();
                if (window.cargarSesionUsuariosGlobal) window.cargarSesionUsuariosGlobal();
                cargarDirectorioUsuarios();
                if (window.mostrarNotificacion) {
                    if (idEditar) {
                        window.mostrarNotificacion(
                            `Se actualizaron los datos y permisos de "${payload.nombre}" (${payload.rol}).`,
                            'info',
                            'Usuario Actualizado'
                        );
                    } else {
                        window.mostrarNotificacion(
                            `Se registró al usuario "${payload.nombre}" con el rol ${payload.rol}.`,
                            'success',
                            'Usuario Creado'
                        );
                    }
                }
            })
            .catch(err => {
                const alerta = document.getElementById('alertaErrorUsuario');
                if (alerta) {
                    alerta.textContent = err.message;
                    alerta.classList.remove('d-none');
                }
                if (window.mostrarNotificacion) {
                    window.mostrarNotificacion(err.message || 'Error al guardar el usuario.', 'danger', 'Error');
                }
            });
        });
    }

    window.addEventListener('usuarioSesionCambiado', cargarDirectorioUsuarios);
    window.addEventListener('incidenciasActualizadas', cargarDirectorioUsuarios);

    cargarDirectorioUsuarios();
});
