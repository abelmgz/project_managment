/* static/js/pages/weekly.js */
function toggleWeeklyDay(headerElement) {
    const card = headerElement.closest('.weekly-day-card');
    const body = card.querySelector('.weekly-day-body');
    const icon = card.querySelector('.toggle-icon');

    if (card.classList.contains('expanded')) {
        body.style.display = 'none';
        card.classList.remove('expanded');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
    } else {
        body.style.display = 'block';
        card.classList.add('expanded');
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
    }
}

function aFechaLocalISO(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function obtenerRangoSemana(desplazamientoSemanas) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    // Convertir Domingo=0..Sábado=6 a Lunes=0..Domingo=6
    const diaSemanaLunes0 = (hoy.getDay() + 6) % 7;

    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diaSemanaLunes0 + (desplazamientoSemanas * 7));

    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);

    const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const textoLunes = `${String(lunes.getDate()).padStart(2, '0')} ${mesesCortos[lunes.getMonth()]} ${lunes.getFullYear()}`;
    const textoDomingo = `${String(domingo.getDate()).padStart(2, '0')} ${mesesCortos[domingo.getMonth()]} ${domingo.getFullYear()}`;

    return {
        lunesObj: lunes,
        domingoObj: domingo,
        lunesISO: aFechaLocalISO(lunes),
        domingoISO: aFechaLocalISO(domingo),
        hoyISO: aFechaLocalISO(hoy),
        textoRango: `Lunes ${textoLunes} — Domingo ${textoDomingo}`
    };
}

function formatearFechaHumanaEspanol(fechaIso) {
    if (!fechaIso) return 'Sin Due Date';
    const partes = String(fechaIso).slice(0, 10).split('-');
    if (partes.length !== 3) return fechaIso;

    const anio = Number(partes[0]);
    const mes = Number(partes[1]) - 1;
    const dia = Number(partes[2]);
    const fechaObj = new Date(anio, mes, dia);
    if (isNaN(fechaObj.getTime())) return fechaIso;

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const nombreDia = diasSemana[fechaObj.getDay()];
    const nombreMes = meses[fechaObj.getMonth()];
    return `${nombreDia}, ${dia} de ${nombreMes} ${anio}`;
}

document.addEventListener('DOMContentLoaded', function() {
    const contenedor = document.querySelector('.weekly-accordion-container');
    const resumenGlobalEl = document.getElementById('weeklyResumenGlobal');
    const rangoSemanaTextoEl = document.getElementById('weeklyRangoSemanaTexto');
    const etiquetaTipoSemanaEl = document.getElementById('weeklyEtiquetaTipoSemana');
    const btnSemanaAnterior = document.getElementById('btnWeeklySemanaAnterior');
    const btnSemanaActual = document.getElementById('btnWeeklySemanaActual');
    const btnSemanaSiguiente = document.getElementById('btnWeeklySemanaSiguiente');
    if (!contenedor) return;

    let todasLasTareas = [];
    let filtroTexto = '';
    // 0 = Semana actual (por defecto muestra únicamente la semana actual)
    let desplazamientoSemanas = 0;

    function actualizarCabeceraSemana(rango) {
        if (rangoSemanaTextoEl) {
            rangoSemanaTextoEl.textContent = rango.textoRango;
        }
        if (etiquetaTipoSemanaEl) {
            if (desplazamientoSemanas === 0) {
                etiquetaTipoSemanaEl.textContent = 'SEMANA ACTUAL';
                etiquetaTipoSemanaEl.className = 'badge bg-primary text-white px-2 py-1';
            } else if (desplazamientoSemanas < 0) {
                const n = Math.abs(desplazamientoSemanas);
                etiquetaTipoSemanaEl.textContent = n === 1 ? 'SEMANA ANTERIOR' : `HACE ${n} SEMANAS`;
                etiquetaTipoSemanaEl.className = 'badge bg-secondary text-white px-2 py-1';
            } else {
                const n = desplazamientoSemanas;
                etiquetaTipoSemanaEl.textContent = n === 1 ? 'PRÓXIMA SEMANA' : `EN +${n} SEMANAS`;
                etiquetaTipoSemanaEl.className = 'badge bg-info text-dark px-2 py-1';
            }
        }
    }

    function renderizarWeeklyPorDueDate() {
        const rango = obtenerRangoSemana(desplazamientoSemanas);
        actualizarCabeceraSemana(rango);

        // Filtrar únicamente las incidencias cuyo Due Date pertenece a la semana seleccionada
        const listaSemana = todasLasTareas.filter(t => {
            const dueDate = (t.due_date || t.fecha_limite || t.fecha_calendario || t.fecha_creacion || '').slice(0, 10);
            if (!dueDate || dueDate < rango.lunesISO || dueDate > rango.domingoISO) {
                return false;
            }
            if (filtroTexto) {
                const blob = `${t.clave_incidencia || ''} ${t.titulo || ''} ${t.componente || ''} ${t.asignado_nombre || ''} ${dueDate}`.toLowerCase();
                if (!blob.includes(filtroTexto)) return false;
            }
            return true;
        });

        let totalHorasSemana = 0;
        const gruposPorDueDate = {};

        listaSemana.forEach(t => {
            const dueDate = (t.due_date || t.fecha_limite || t.fecha_calendario || t.fecha_creacion).slice(0, 10);
            if (!gruposPorDueDate[dueDate]) {
                gruposPorDueDate[dueDate] = [];
            }
            gruposPorDueDate[dueDate].push(t);
            totalHorasSemana += Number(t.horas_registradas || 0);
        });

        const fechasOrdenadas = Object.keys(gruposPorDueDate).sort((a, b) => b.localeCompare(a));

        if (resumenGlobalEl) {
            resumenGlobalEl.innerHTML = `
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2">
                    <i class="fas fa-tasks me-1"></i> ${listaSemana.length} ${listaSemana.length === 1 ? 'actividad' : 'actividades'} en la semana
                </span>
                <span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                    <i class="far fa-clock me-1"></i> ${totalHorasSemana.toFixed(1)}h contabilizadas
                </span>
            `;
        }

        if (listaSemana.length === 0) {
            contenedor.innerHTML = `
                <div class="card border p-4 text-center text-muted bg-white shadow-sm">
                    <div class="mb-2"><i class="far fa-calendar-times fa-2x text-secondary"></i></div>
                    <div class="fw-bold text-dark">Sin actividades contabilizadas en esta semana (${rango.lunesISO} a ${rango.domingoISO})</div>
                    <div class="small mt-1">Usa los botones <strong>Semana Anterior</strong> o <strong>Semana Siguiente</strong> para explorar otras fechas, o asigna el <strong>Due Date</strong> de una incidencia dentro de esta semana.</div>
                </div>
            `;
            return;
        }

        function renderFilas(grupo, dueDateKey) {
            return grupo.map((t, idx) => {
                const fechaInicio = (t.fecha_inicio || t.fecha_creacion || dueDateKey).slice(0, 10);
                const fechaDue = (t.due_date || t.fecha_limite || dueDateKey).slice(0, 10);
                const horas = Number(t.horas_registradas || 0).toFixed(1);
                const asignado = t.asignado_nombre || 'Abel Martinez';

                return `
                    <div class="weekly-task-row d-flex flex-wrap align-items-center justify-content-between py-2 ${idx < grupo.length - 1 ? 'border-bottom' : ''}" style="cursor:pointer;" onclick="window.abrirDetalleIncidencia(${t.id})">
                        <div class="d-flex align-items-center flex-wrap gap-2">
                            <span class="task-key fw-bold text-primary">${t.clave_incidencia}</span>
                            <span class="task-desc text-dark fw-medium">${t.titulo}</span>
                            <span class="badge-status status-${t.estado}" style="font-size: 0.68rem;">${t.estado.toUpperCase()}</span>
                        </div>
                        <div class="d-flex align-items-center gap-3 mt-1 mt-md-0">
                            <span class="text-muted" style="font-size: 0.78rem;" title="Fecha de Inicio → Due Date">
                                <i class="far fa-calendar-check text-primary me-1"></i>Inicio: <strong>${fechaInicio}</strong>
                                <i class="fas fa-arrow-right mx-1 text-secondary" style="font-size: 0.65rem;"></i>
                                <i class="far fa-calendar-alt text-danger me-1"></i>Due: <strong>${fechaDue}</strong>
                            </span>
                            <span class="badge bg-light text-secondary border" style="font-size: 0.74rem;">
                                <i class="far fa-user me-1"></i>${asignado}
                            </span>
                            <div class="task-hours fw-bold text-dark" style="min-width: 48px; text-align: right;">${horas}h</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const html = fechasOrdenadas.map((dueDateKey, index) => {
            const grupo = gruposPorDueDate[dueDateKey];
            const horasDia = grupo.reduce((acc, t) => acc + Number(t.horas_registradas || 0), 0);
            const completadasDia = grupo.filter(t => t.estado === 'Finalizado').length;
            const expandido = index === 0 || dueDateKey === rango.hoyISO;
            const tituloFecha = formatearFechaHumanaEspanol(dueDateKey);
            const esHoy = dueDateKey === rango.hoyISO;
            const badgeClase = expandido ? 'badge-hours-blue' : 'badge-hours-gray';

            return `
                <div class="weekly-day-card mb-3 ${expandido ? 'expanded' : ''}">
                    <div class="weekly-day-header d-flex flex-wrap align-items-center justify-content-between p-3" onclick="toggleWeeklyDay(this)">
                        <div class="d-flex align-items-center flex-wrap gap-2">
                            <i class="fas ${expandido ? 'fa-chevron-down' : 'fa-chevron-right'} toggle-icon text-secondary me-2"></i>
                            <span class="day-title fw-bold text-dark">${tituloFecha}</span>
                            ${esHoy ? '<span class="badge bg-primary text-white">HOY</span>' : ''}
                            <span class="badge bg-light text-danger border fw-semibold" style="font-size: 0.74rem;">
                                <i class="far fa-calendar-alt me-1"></i>Due Date: ${dueDateKey}
                            </span>
                            <span class="badge ${badgeClase} px-2 py-1">${horasDia.toFixed(1)} Horas registradas</span>
                            <span class="badge bg-secondary-subtle text-secondary px-2 py-1">${grupo.length} ${grupo.length === 1 ? 'actividad' : 'actividades'}</span>
                        </div>
                        <div class="weekly-meta-status ${completadasDia === grupo.length ? 'text-success' : 'text-primary'} fw-medium" style="font-size: 0.84rem;">
                            ${completadasDia}/${grupo.length} finalizadas
                        </div>
                    </div>
                    <div class="weekly-day-body px-4 py-2 bg-white" style="${expandido ? 'display: block;' : 'display: none;'}">
                        ${renderFilas(grupo, dueDateKey)}
                    </div>
                </div>
            `;
        }).join('');

        contenedor.innerHTML = html;
    }

    function cargarWeeklyLogs() {
        const activoId = window.obtenerProyectoActivoId ? window.obtenerProyectoActivoId() : '';
        const url = activoId ? `/api/tareas?proyecto_id=${encodeURIComponent(activoId)}` : '/api/tareas';

        fetch(url)
            .then(res => res.json())
            .then(tareas => {
                todasLasTareas = Array.isArray(tareas) ? tareas : [];
                if (window.registrarTareasEnCache) {
                    window.registrarTareasEnCache(todasLasTareas);
                }
                renderizarWeeklyPorDueDate();
            })
            .catch(err => console.error('Error al cargar weekly logs:', err));
    }

    if (btnSemanaAnterior) {
        btnSemanaAnterior.addEventListener('click', function() {
            desplazamientoSemanas--;
            renderizarWeeklyPorDueDate();
        });
    }

    if (btnSemanaActual) {
        btnSemanaActual.addEventListener('click', function() {
            desplazamientoSemanas = 0;
            renderizarWeeklyPorDueDate();
        });
    }

    if (btnSemanaSiguiente) {
        btnSemanaSiguiente.addEventListener('click', function() {
            desplazamientoSemanas++;
            renderizarWeeklyPorDueDate();
        });
    }

    window.addEventListener('proyectoCambiado', cargarWeeklyLogs);
    window.addEventListener('incidenciasActualizadas', cargarWeeklyLogs);
    window.addEventListener('usuarioSesionCambiado', cargarWeeklyLogs);
    window.addEventListener('tareaSeleccionadaBuscador', function(e) {
        const tarea = e.detail && e.detail.tarea;
        if (!tarea) return;
        const fechaTarget = parsearFechaISO((tarea.due_date || tarea.fecha_limite || '').slice(0, 10));
        if (!fechaTarget) return;
        const rangoActual = obtenerRangoSemana(0);
        const diffMs = fechaTarget.getTime() - rangoActual.lunes.getTime();
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        desplazamientoSemanas = Math.floor(diffDias / 7);
        renderizarWeeklyPorDueDate();
    });
    window.addEventListener('busquedaGlobalJira', function(e) {
        filtroTexto = (e.detail && e.detail.texto) || '';
        renderizarWeeklyPorDueDate();
    });

    cargarWeeklyLogs();
});
