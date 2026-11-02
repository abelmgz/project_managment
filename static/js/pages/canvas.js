// static/js/pages/canvas.js

document.addEventListener("DOMContentLoaded", function () {
    let documentosCache = [];
    let documentoActivo = null;
    let contextoVivo = null;
    let usuarioActual = null;
    let temporizadorAutoGuardado = null;

    const arbolEl = document.getElementById("arbolPaginasCanvas");
    const contadorEl = document.getElementById("contadorPaginasCanvas");
    const buscadorEl = document.getElementById("buscadorPaginasCanvas");
    const editorEl = document.getElementById("confluenceEditorCanvas");
    const tituloInput = document.getElementById("canvasTituloInput");
    const categoriaSelect = document.getElementById("canvasCategoriaSelect");
    const versionBadge = document.getElementById("canvasVersionBadge");
    const estadoGuardadoEl = document.getElementById("canvasEstadoGuardado");
    const autorActualizacionEl = document.getElementById("canvasAutorActualizacion");
    const fechaActualizacionEl = document.getElementById("canvasFechaActualizacion");
    const switchAutoSync = document.getElementById("switchAutoSyncCanvas");
    const selectInsertarIncidencia = document.getElementById("selectInsertarIncidencia");
    const btnEliminarDoc = document.getElementById("btnEliminarDocumentoCanvas");
    const subtituloProyectoEl = document.getElementById("canvasSubtituloProyecto");

    function obtenerProyectoSeleccionado() {
        const sel = document.getElementById("selectorProyectoGlobal");
        return (sel && sel.value) ? sel.value : (localStorage.getItem("jira_proyecto_seleccionado") || "");
    }

    function escaparHtml(str) {
        return String(str == null ? "" : str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function badgeEstadoClase(estado) {
        if (estado === "Finalizado") return "bg-success-subtle text-success border border-success-subtle";
        if (estado === "En-Curso") return "bg-primary-subtle text-primary border border-primary-subtle";
        if (estado === "Revision") return "bg-info-subtle text-info border border-info-subtle";
        return "bg-secondary-subtle text-secondary border border-secondary-subtle";
    }

    function actualizarIndicadorEstado(texto, icono = "fa-check-circle text-success") {
        if (!estadoGuardadoEl) return;
        estadoGuardadoEl.innerHTML = `<i class="fas ${icono} me-1"></i> ${texto}`;
    }

    // Convierte el DOM hidratado del editor en HTML limpio con marcadores de macro para guardar en SQLite
    function obtenerContenidoSerializadoParaGuardar() {
        if (!editorEl) return "";
        const clon = editorEl.cloneNode(true);
        clon.querySelectorAll(".canvas-live-macro[data-canvas-macro]").forEach(function (nodo) {
            const tipo = nodo.getAttribute("data-canvas-macro");
            nodo.innerHTML = "";
            nodo.setAttribute("data-canvas-macro", tipo);
        });
        clon.querySelectorAll(".jira-smart-link[data-issue-key]").forEach(function (nodo) {
            const key = nodo.getAttribute("data-issue-key");
            nodo.innerHTML = escaparHtml(key);
        });
        return clon.innerHTML.trim();
    }

    // Renderiza las macros en vivo y los enlaces inteligentes de incidencias dentro del editor
    function hidratarMacrosYEnlacesEnVivo() {
        if (!editorEl || !contextoVivo) return;
        if (switchAutoSync && !switchAutoSync.checked) return;

        const tareas = contextoVivo.tareas || [];
        const kpis = contextoVivo.kpis || {};
        const bitacora = contextoVivo.bitacora || [];
        const equipo = contextoVivo.equipo || [];

        const mapaPorClave = {};
        tareas.forEach(function (t) {
            mapaPorClave[t.clave_incidencia] = t;
        });

        // 1. Hidratar enlaces inteligentes .jira-smart-link
        editorEl.querySelectorAll(".jira-smart-link[data-issue-key]").forEach(function (span) {
            const clave = span.getAttribute("data-issue-key");
            const t = mapaPorClave[clave];
            span.setAttribute("contenteditable", "false");
            if (t) {
                span.setAttribute("data-issue-id", t.id);
                span.innerHTML = `
                    <i class="fas fa-bookmark text-primary" style="font-size: 0.7rem;"></i>
                    <span>${escaparHtml(t.clave_incidencia)}</span>
                    <span class="text-dark fw-normal text-truncate" style="max-width: 180px;">${escaparHtml(t.titulo)}</span>
                    <span class="smart-link-status ${badgeEstadoClase(t.estado)}">${escaparHtml(t.estado)}</span>
                `;
            } else {
                span.innerHTML = `<i class="fas fa-link me-1"></i><span>${escaparHtml(clave)}</span>`;
            }
        });

        // 2. Hidratar bloques .canvas-live-macro
        editorEl.querySelectorAll(".canvas-live-macro[data-canvas-macro]").forEach(function (macroEl) {
            const tipo = macroEl.getAttribute("data-canvas-macro");
            macroEl.setAttribute("contenteditable", "false");

            if (tipo === "kpis") {
                macroEl.innerHTML = `
                    <div class="canvas-macro-header">
                        <span><i class="fas fa-chart-pie text-primary me-1"></i> Macro en Vivo: KPIs del Proyecto (${escaparHtml(contextoVivo.proyecto ? contextoVivo.proyecto.nombre : "Global")})</span>
                        <span>Actualizado: ${escaparHtml(kpis.fecha_sincronizacion || "Ahora")}</span>
                    </div>
                    <div class="row g-2 text-center mb-2">
                        <div class="col-6 col-md-2">
                            <div class="p-2 bg-white rounded border">
                                <div class="text-muted" style="font-size: 0.68rem;">TOTAL</div>
                                <div class="fw-bold fs-5 text-dark">${kpis.total || 0}</div>
                            </div>
                        </div>
                        <div class="col-6 col-md-2">
                            <div class="p-2 bg-white rounded border">
                                <div class="text-muted" style="font-size: 0.68rem;">POR HACER</div>
                                <div class="fw-bold fs-5 text-secondary">${kpis.por_hacer || 0}</div>
                            </div>
                        </div>
                        <div class="col-6 col-md-2">
                            <div class="p-2 bg-white rounded border">
                                <div class="text-muted" style="font-size: 0.68rem;">EN CURSO</div>
                                <div class="fw-bold fs-5 text-primary">${kpis.en_curso || 0}</div>
                            </div>
                        </div>
                        <div class="col-6 col-md-2">
                            <div class="p-2 bg-white rounded border">
                                <div class="text-muted" style="font-size: 0.68rem;">REVISIÓN</div>
                                <div class="fw-bold fs-5 text-info">${kpis.en_revision || 0}</div>
                            </div>
                        </div>
                        <div class="col-6 col-md-2">
                            <div class="p-2 bg-white rounded border">
                                <div class="text-muted" style="font-size: 0.68rem;">FINALIZADAS</div>
                                <div class="fw-bold fs-5 text-success">${kpis.finalizadas || 0}</div>
                            </div>
                        </div>
                        <div class="col-6 col-md-2">
                            <div class="p-2 bg-white rounded border">
                                <div class="text-muted" style="font-size: 0.68rem;">HORAS LOG</div>
                                <div class="fw-bold fs-5 text-dark">${kpis.horas_totales || 0}h</div>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <div class="progress flex-grow-1" style="height: 8px;">
                            <div class="progress-bar bg-success" role="progressbar" style="width: ${kpis.progreso_pct || 0}%"></div>
                        </div>
                        <span class="small fw-bold text-success">${kpis.progreso_pct || 0}% Completado</span>
                    </div>
                `;
            } else if (tipo === "incidencias") {
                const filas = tareas.map(function (t) {
                    return `
                        <tr class="canvas-macro-row" data-issue-id="${t.id}" style="cursor: pointer;">
                            <td class="fw-bold text-primary">${escaparHtml(t.clave_incidencia)}</td>
                            <td class="fw-medium text-dark">${escaparHtml(t.titulo)}</td>
                            <td><span class="badge ${badgeEstadoClase(t.estado)}">${escaparHtml(t.estado)}</span></td>
                            <td><span class="badge bg-light text-dark border">${escaparHtml(t.prioridad)}</span></td>
                            <td class="text-secondary small">${escaparHtml(t.componente || "General")}</td>
                            <td class="text-secondary small">${escaparHtml(t.asignado_nombre || "Sin asignar")}</td>
                            <td class="text-end fw-semibold small">${t.horas_registradas || 0}h</td>
                        </tr>
                    `;
                }).join("");

                macroEl.innerHTML = `
                    <div class="canvas-macro-header">
                        <span><i class="fas fa-table text-primary me-1"></i> Macro en Vivo: Tabla de Incidencias Sincronizadas (${tareas.length})</span>
                        <span class="text-primary">Haz clic en una fila para abrir el detalle</span>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover align-middle mb-0 bg-white border rounded" style="font-size: 0.8rem;">
                            <thead class="table-light">
                                <tr>
                                    <th>Clave</th>
                                    <th>Resumen Técnico</th>
                                    <th>Estado</th>
                                    <th>Prioridad</th>
                                    <th>Componente</th>
                                    <th>Asignado</th>
                                    <th class="text-end">Horas</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filas || '<tr><td colspan="7" class="text-center text-muted py-3">Sin incidencias para el filtro actual</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            } else if (tipo === "bitacora") {
                const items = bitacora.slice(0, 8).map(function (b) {
                    const icono = b.tipo === "comentario" ? "fa-comment-dots text-primary" : "fa-exchange-alt text-warning";
                    return `
                        <div class="d-flex justify-content-between align-items-start py-1 border-bottom canvas-macro-row" data-issue-id="${b.tarea_id}" style="cursor: pointer; font-size: 0.8rem;">
                            <div>
                                <i class="fas ${icono} me-1"></i>
                                <strong class="text-primary">${escaparHtml(b.clave_incidencia)}</strong>
                                <span class="text-dark ms-1">${escaparHtml(b.detalle)}</span>
                            </div>
                            <div class="text-muted small text-nowrap ms-2">${escaparHtml(b.autor)} · ${escaparHtml(b.fecha)}</div>
                        </div>
                    `;
                }).join("");

                macroEl.innerHTML = `
                    <div class="canvas-macro-header">
                        <span><i class="fas fa-stream text-warning me-1"></i> Macro en Vivo: Bitácora de Auditoría y Comentarios</span>
                        <span>Tiempo Real SQLite</span>
                    </div>
                    <div class="bg-white p-2 rounded border">
                        ${items || '<div class="text-muted small text-center py-2">No hay eventos recientes</div>'}
                    </div>
                `;
            } else if (tipo === "equipo") {
                const filasEq = equipo.map(function (u) {
                    return `
                        <tr>
                            <td class="fw-bold text-dark">${escaparHtml(u.nombre)}</td>
                            <td><span class="badge bg-light text-secondary border">${escaparHtml(u.rol)}</span></td>
                            <td class="text-secondary small">${escaparHtml(u.cargo)}</td>
                            <td class="text-center fw-bold">${u.total}</td>
                            <td class="text-center text-primary">${u.en_curso}</td>
                            <td class="text-center text-success">${u.finalizadas}</td>
                            <td class="text-end fw-semibold">${u.horas}h</td>
                        </tr>
                    `;
                }).join("");

                macroEl.innerHTML = `
                    <div class="canvas-macro-header">
                        <span><i class="fas fa-users text-success me-1"></i> Macro en Vivo: Capacidad y Carga por Especialista</span>
                        <span>Sincronizado con Usuarios & Roles</span>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm align-middle mb-0 bg-white border rounded" style="font-size: 0.8rem;">
                            <thead class="table-light">
                                <tr>
                                    <th>Integrante</th>
                                    <th>Rol</th>
                                    <th>Cargo</th>
                                    <th class="text-center">Total</th>
                                    <th class="text-center">En Curso</th>
                                    <th class="text-center">Finalizadas</th>
                                    <th class="text-end">Horas</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasEq}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        });
    }

    function poblarSelectorIncidenciasToolbar() {
        if (!selectInsertarIncidencia || !contextoVivo) return;
        const tareas = contextoVivo.tareas || [];
        let html = '<option value="">+ Vincular Incidencia Jira...</option>';
        tareas.forEach(function (t) {
            html += `<option value="${escaparHtml(t.clave_incidencia)}">${escaparHtml(t.clave_incidencia)} — ${escaparHtml(t.titulo)}</option>`;
        });
        selectInsertarIncidencia.innerHTML = html;
    }

    function renderizarArbolPaginas() {
        if (!arbolEl) return;
        const filtroTexto = (buscadorEl && buscadorEl.value ? buscadorEl.value : "").trim().toLowerCase();
        const filtrados = documentosCache.filter(function (d) {
            if (!filtroTexto) return true;
            return (
                d.titulo.toLowerCase().includes(filtroTexto) ||
                (d.categoria || "").toLowerCase().includes(filtroTexto)
            );
        });

        if (contadorEl) contadorEl.textContent = filtrados.length;

        const porCategoria = {};
        filtrados.forEach(function (d) {
            const cat = d.categoria || "General";
            if (!porCategoria[cat]) porCategoria[cat] = [];
            porCategoria[cat].push(d);
        });

        const categorias = Object.keys(porCategoria);
        if (categorias.length === 0) {
            arbolEl.innerHTML = '<div class="text-muted small py-3 text-center">No se encontraron páginas.</div>';
            return;
        }

        let html = "";
        categorias.forEach(function (cat) {
            html += `<div class="text-uppercase text-muted fw-bold mt-2 mb-1 px-1" style="font-size: 0.65rem; letter-spacing: 0.4px;">${escaparHtml(cat)}</div>`;
            porCategoria[cat].forEach(function (doc) {
                const esActivo = documentoActivo && documentoActivo.id === doc.id;
                const esAuto = doc.tipo_automatizacion && doc.tipo_automatizacion !== "manual";
                html += `
                    <div class="canvas-doc-item ${esActivo ? "active" : ""}" data-doc-id="${doc.id}">
                        <div class="text-truncate me-2">
                            <i class="fas ${escaparHtml(doc.icono || "fa-file-alt")} me-2 ${esActivo ? "text-primary" : "text-secondary"}"></i>
                            <span>${escaparHtml(doc.titulo)}</span>
                        </div>
                        ${esAuto ? '<span class="canvas-doc-badge-auto" title="Página automatizada"><i class="fas fa-bolt"></i> Auto</span>' : ""}
                    </div>
                `;
            });
        });

        arbolEl.innerHTML = html;
    }

    function mostrarDocumentoEnEditor(doc) {
        documentoActivo = doc;
        if (tituloInput) tituloInput.value = doc.titulo || "";
        if (categoriaSelect) categoriaSelect.value = doc.categoria || "Arquitectura & Red";
        if (versionBadge) versionBadge.textContent = `v${doc.version || 1}`;
        if (autorActualizacionEl) autorActualizacionEl.textContent = doc.actualizado_por || "Abel Martinez";
        if (fechaActualizacionEl) fechaActualizacionEl.textContent = doc.fecha_actualizacion || "-";
        if (switchAutoSync) switchAutoSync.checked = doc.auto_sincronizar !== false;

        if (btnEliminarDoc) {
            if (usuarioActual && usuarioActual.puede_eliminar) {
                btnEliminarDoc.classList.remove("d-none");
            } else {
                btnEliminarDoc.classList.add("d-none");
            }
        }

        if (editorEl) {
            editorEl.innerHTML = doc.contenido || "";
            hidratarMacrosYEnlacesEnVivo();
        }
        renderizarArbolPaginas();
        actualizarIndicadorEstado("Sincronizado con SQLite", "fa-check-circle text-success");
    }

    async function cargarListaYContextoCanvas(idSeleccionar = null) {
        const proyId = obtenerProyectoSeleccionado();
        const params = new URLSearchParams();
        if (proyId) params.set("proyecto_id", proyId);

        const res = await fetch(`/api/canvas?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();

        documentosCache = data.documentos || [];
        contextoVivo = data.contexto_vivo || null;
        usuarioActual = data.usuario_actual || null;

        if (subtituloProyectoEl && contextoVivo && contextoVivo.proyecto) {
            subtituloProyectoEl.innerHTML = `Espacio sincronizado con <strong>${escaparHtml(contextoVivo.proyecto.nombre)}</strong> (${contextoVivo.kpis.total} incidencias · ${contextoVivo.kpis.progreso_pct}% completado).`;
        }

        poblarSelectorIncidenciasToolbar();

        const targetId = idSeleccionar || (documentoActivo ? documentoActivo.id : (documentosCache[0] ? documentosCache[0].id : null));
        if (targetId) {
            await seleccionarDocumento(targetId);
        } else {
            renderizarArbolPaginas();
        }
    }

    async function seleccionarDocumento(docId) {
        const proyId = obtenerProyectoSeleccionado();
        const params = new URLSearchParams();
        if (proyId) params.set("proyecto_id", proyId);

        const res = await fetch(`/api/canvas/${docId}?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        contextoVivo = data.contexto_vivo || contextoVivo;
        usuarioActual = data.usuario_actual || usuarioActual;
        mostrarDocumentoEnEditor(data.documento);
    }

    async function guardarDocumentoActual(crearVersion = true, resumen = "Actualización desde Confluence Canvas") {
        if (!documentoActivo) return;
        actualizarIndicadorEstado("Guardando...", "fa-spinner fa-spin text-primary");

        const payload = {
            titulo: tituloInput ? tituloInput.value.trim() : documentoActivo.titulo,
            categoria: categoriaSelect ? categoriaSelect.value : documentoActivo.categoria,
            contenido: obtenerContenidoSerializadoParaGuardar(),
            auto_sincronizar: switchAutoSync ? switchAutoSync.checked : true,
            crear_version: crearVersion,
            resumen_cambio: resumen,
        };

        const res = await fetch(`/api/canvas/${documentoActivo.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            const data = await res.json();
            documentoActivo = data.documento;
            const idx = documentosCache.findIndex((d) => d.id === documentoActivo.id);
            if (idx !== -1) documentosCache[idx] = documentoActivo;
            if (versionBadge) versionBadge.textContent = `v${documentoActivo.version || 1}`;
            if (autorActualizacionEl) autorActualizacionEl.textContent = documentoActivo.actualizado_por;
            if (fechaActualizacionEl) fechaActualizacionEl.textContent = documentoActivo.fecha_actualizacion;
            renderizarArbolPaginas();
            actualizarIndicadorEstado(crearVersion ? "Versión guardada" : "Auto-guardado", "fa-check-circle text-success");
        } else {
            actualizarIndicadorEstado("Error al guardar", "fa-exclamation-triangle text-danger");
        }
    }

    async function autogenerarDocumentoDesdePlantilla(tipo) {
        actualizarIndicadorEstado("Generando documento automático...", "fa-cog fa-spin text-primary");
        const proyId = obtenerProyectoSeleccionado();

        const res = await fetch("/api/canvas/autogenerar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: tipo, proyecto_id: proyId || null }),
        });

        if (res.ok) {
            const data = await res.json();
            contextoVivo = data.contexto_vivo || contextoVivo;
            const nuevoDoc = data.documento;
            documentosCache.push(nuevoDoc);
            mostrarDocumentoEnEditor(nuevoDoc);

            const modalEl = document.getElementById("modalGeneradorAutoCanvas");
            if (modalEl && window.bootstrap) {
                const inst = bootstrap.Modal.getInstance(modalEl);
                if (inst) inst.hide();
            }
        }
    }

    // Eventos del árbol de páginas
    if (arbolEl) {
        arbolEl.addEventListener("click", function (e) {
            const item = e.target.closest(".canvas-doc-item[data-doc-id]");
            if (!item) return;
            const id = parseInt(item.getAttribute("data-doc-id"), 10);
            if (id) seleccionarDocumento(id);
        });
    }

    if (buscadorEl) {
        buscadorEl.addEventListener("input", renderizarArbolPaginas);
    }

    // Eventos dentro del editor: clic en Smart Links o filas de la Macro de Incidencias abre el modal de detalle
    if (editorEl) {
        editorEl.addEventListener("click", function (e) {
            const linkIncidencia = e.target.closest("[data-issue-id]");
            if (linkIncidencia) {
                const issueId = linkIncidencia.getAttribute("data-issue-id");
                if (issueId && typeof window.abrirDetalleIncidencia === "function") {
                    e.preventDefault();
                    window.abrirDetalleIncidencia(issueId);
                }
            }
        });

        // Auto-guardado con debounce al escribir
        editorEl.addEventListener("input", function () {
            actualizarIndicadorEstado("Editando...", "fa-pen text-warning");
            if (temporizadorAutoGuardado) clearTimeout(temporizadorAutoGuardado);
            temporizadorAutoGuardado = setTimeout(function () {
                guardarDocumentoActual(false, "Auto-guardado en vivo");
            }, 1800);
        });
    }

    // Botones de la barra de herramientas de formato y macros
    document.querySelectorAll(".confluence-toolbar [data-cmd]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const cmd = btn.getAttribute("data-cmd");
            if (!editorEl) return;
            editorEl.focus();

            if (cmd === "bold") {
                document.execCommand("bold", false, null);
            } else if (cmd === "ul") {
                document.execCommand("insertUnorderedList", false, null);
            } else if (cmd === "h5") {
                editorEl.insertAdjacentHTML("beforeend", '<h5 class="fw-bold mt-4 mb-2">Nuevo Subtítulo de Sección</h5>');
            } else if (cmd === "checklist") {
                editorEl.insertAdjacentHTML(
                    "beforeend",
                    '<ul class="canvas-checklist list-unstyled ps-1 mt-2"><li><input type="checkbox"> Punto de verificación técnica</li></ul>'
                );
            } else if (cmd === "callout") {
                editorEl.insertAdjacentHTML(
                    "beforeend",
                    '<div class="canvas-callout canvas-callout-info my-3"><div class="fw-bold mb-1"><i class="fas fa-info-circle me-1 text-primary"></i> Nota de Operación</div><div class="small text-secondary">Documenta aquí las consideraciones clave del procedimiento.</div></div>'
                );
            }
        });
    });

    document.querySelectorAll(".confluence-toolbar [data-macro]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const tipoMacro = btn.getAttribute("data-macro");
            if (!editorEl) return;
            editorEl.insertAdjacentHTML(
                "beforeend",
                `<div class="canvas-live-macro my-3" data-canvas-macro="${escaparHtml(tipoMacro)}"></div>`
            );
            hidratarMacrosYEnlacesEnVivo();
            guardarDocumentoActual(false, `Macro ${tipoMacro} insertada`);
        });
    });

    if (selectInsertarIncidencia) {
        selectInsertarIncidencia.addEventListener("change", function () {
            const clave = selectInsertarIncidencia.value;
            if (!clave || !editorEl) return;
            editorEl.insertAdjacentHTML(
                "beforeend",
                `<p class="my-2">Referencia técnica vinculada: <span class="jira-smart-link" data-issue-key="${escaparHtml(clave)}">${escaparHtml(clave)}</span></p>`
            );
            selectInsertarIncidencia.value = "";
            hidratarMacrosYEnlacesEnVivo();
            guardarDocumentoActual(false, `Vinculada incidencia ${clave}`);
        });
    }

    // Botón Guardar Cambios
    const btnGuardar = document.getElementById("btnGuardarDocumentoCanvas");
    if (btnGuardar) {
        btnGuardar.addEventListener("click", function () {
            guardarDocumentoActual(true, "Guardado manual de versión");
        });
    }

    // Botón Sincronizar con Jira en Vivo
    const btnSincronizar = document.getElementById("btnSincronizarDocumento");
    if (btnSincronizar) {
        btnSincronizar.addEventListener("click", async function () {
            if (!documentoActivo) return;
            actualizarIndicadorEstado("Sincronizando con Jira...", "fa-sync fa-spin text-primary");
            const proyId = obtenerProyectoSeleccionado();
            const url = `/api/canvas/${documentoActivo.id}/sincronizar${proyId ? `?proyecto_id=${proyId}` : ""}`;
            const res = await fetch(url, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                contextoVivo = data.contexto_vivo || contextoVivo;
                mostrarDocumentoEnEditor(data.documento);
            }
        });
    }

    // Botón Nueva Página en Blanco
    const btnNuevaPagina = document.getElementById("btnNuevaPaginaCanvas");
    if (btnNuevaPagina) {
        btnNuevaPagina.addEventListener("click", async function () {
            const proyId = obtenerProyectoSeleccionado();
            const res = await fetch("/api/canvas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    titulo: "Nueva Página Operativa",
                    categoria: "Arquitectura & Red",
                    icono: "fa-file-alt",
                    proyecto_id: proyId || null,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                documentosCache.push(data.documento);
                mostrarDocumentoEnEditor(data.documento);
                if (tituloInput) {
                    tituloInput.focus();
                    tituloInput.select();
                }
            }
        });
    }

    // Botón Abrir Modal Generador Automático
    const btnAbrirGenerador = document.getElementById("btnAbrirGeneradorAuto");
    if (btnAbrirGenerador) {
        btnAbrirGenerador.addEventListener("click", function () {
            const modalEl = document.getElementById("modalGeneradorAutoCanvas");
            if (modalEl && window.bootstrap) {
                bootstrap.Modal.getOrCreateInstance(modalEl).show();
            }
        });
    }

    // Clic en tarjetas del modal de automatización o botones rápidos 1-Click
    document.querySelectorAll("[data-blueprint], .btn-quick-autogen[data-tipo]").forEach(function (el) {
        el.addEventListener("click", function () {
            const tipo = el.getAttribute("data-blueprint") || el.getAttribute("data-tipo");
            if (tipo) autogenerarDocumentoDesdePlantilla(tipo);
        });
    });

    // Historial de Versiones y Restauración
    const btnVersiones = document.getElementById("btnVerVersionesCanvas");
    if (btnVersiones) {
        btnVersiones.addEventListener("click", async function () {
            if (!documentoActivo) return;
            await seleccionarDocumento(documentoActivo.id);
            const listaEl = document.getElementById("listaVersionesCanvas");
            if (listaEl) {
                const versiones = documentoActivo.versiones || [];
                listaEl.innerHTML = versiones.map(function (v) {
                    return `
                        <li class="list-group-item d-flex justify-content-between align-items-center py-2">
                            <div>
                                <span class="badge bg-primary-subtle text-primary me-2">v${v.numero_version}</span>
                                <strong class="small text-dark">${escaparHtml(v.resumen_cambio)}</strong>
                                <div class="text-muted" style="font-size: 0.72rem;">Por ${escaparHtml(v.autor)} · ${escaparHtml(v.fecha_version)}</div>
                            </div>
                            <button type="button" class="btn btn-outline-primary btn-sm py-0 px-2 btn-restaurar-version" data-version-id="${v.id}">
                                Restaurar
                            </button>
                        </li>
                    `;
                }).join("");
            }
            const modalEl = document.getElementById("modalVersionesCanvas");
            if (modalEl && window.bootstrap) {
                bootstrap.Modal.getOrCreateInstance(modalEl).show();
            }
        });
    }

    const listaVersionesEl = document.getElementById("listaVersionesCanvas");
    if (listaVersionesEl) {
        listaVersionesEl.addEventListener("click", async function (e) {
            const btn = e.target.closest(".btn-restaurar-version[data-version-id]");
            if (!btn || !documentoActivo) return;
            const verId = btn.getAttribute("data-version-id");
            const res = await fetch(`/api/canvas/${documentoActivo.id}/restaurar/${verId}`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                mostrarDocumentoEnEditor(data.documento);
                const modalEl = document.getElementById("modalVersionesCanvas");
                if (modalEl && window.bootstrap) {
                    const inst = bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                }
            }
        });
    }

    // Exportar documento
    const btnExportar = document.getElementById("btnExportarMarkdown");
    if (btnExportar) {
        btnExportar.addEventListener("click", function () {
            if (!documentoActivo || !editorEl) return;
            const textoPlano = `# ${documentoActivo.titulo}\nCategoría: ${documentoActivo.categoria}\nÚltima actualización: ${documentoActivo.actualizado_por} (${documentoActivo.fecha_actualizacion})\n\n${editorEl.innerText}`;
            const blob = new Blob([textoPlano], { type: "text/markdown;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${(documentoActivo.titulo || "confluence").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Eliminar documento (Solo Owner)
    if (btnEliminarDoc) {
        btnEliminarDoc.addEventListener("click", async function () {
            if (!documentoActivo) return;
            if (!confirm(`¿Eliminar permanentemente la página "${documentoActivo.titulo}"?`)) return;
            const res = await fetch(`/api/canvas/${documentoActivo.id}`, { method: "DELETE" });
            if (res.ok) {
                documentoActivo = null;
                await cargarListaYContextoCanvas();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.detail || "No tienes permisos para eliminar páginas.");
            }
        });
    }

    if (switchAutoSync) {
        switchAutoSync.addEventListener("change", function () {
            if (switchAutoSync.checked) {
                hidratarMacrosYEnlacesEnVivo();
            }
            guardarDocumentoActual(false, "Cambio de configuración Auto-Sync");
        });
    }

    // Escuchar cambio global de proyecto o de usuario en sesión
    window.addEventListener("proyectoGlobalCambiado", function () {
        cargarListaYContextoCanvas(documentoActivo ? documentoActivo.id : null);
    });

    window.addEventListener("usuarioSesionCambiado", function () {
        cargarListaYContextoCanvas(documentoActivo ? documentoActivo.id : null);
    });

    // Carga inicial
    cargarListaYContextoCanvas();
});
