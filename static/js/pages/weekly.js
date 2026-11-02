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

document.addEventListener('DOMContentLoaded', function() {
    const contenedor = document.querySelector('.weekly-accordion-container');
    if (!contenedor) return;

    function cargarWeeklyLogs() {
        const activoId = window.obtenerProyectoActivoId ? window.obtenerProyectoActivoId() : '';
        const url = activoId ? `/api/tareas?proyecto_id=${encodeURIComponent(activoId)}` : '/api/tareas';

        fetch(url)
            .then(res => res.json())
            .then(tareas => {
                const lista = Array.isArray(tareas) ? tareas : [];
                if (window.registrarTareasEnCache) {
                    window.registrarTareasEnCache(lista);
                }

                if (lista.length === 0) {
                    contenedor.innerHTML = `<div class="card border p-4 text-center text-muted">No hay registros de esfuerzo para el proyecto seleccionado.</div>`;
                    return;
                }

                const mitad = Math.ceil(lista.length / 2);
                const grupo1 = lista.slice(0, mitad);
                const grupo2 = lista.slice(mitad);

                const horas1 = grupo1.reduce((acc, t) => acc + Number(t.horas_registradas || 0), 0);
                const horas2 = grupo2.reduce((acc, t) => acc + Number(t.horas_registradas || 0), 0);

                function renderFilas(grupo) {
                    return grupo.map((t, idx) => `
                        <div class="weekly-task-row d-flex align-items-center justify-content-between py-2 ${idx < grupo.length - 1 ? 'border-bottom' : ''}" style="cursor:pointer;" onclick="window.abrirDetalleIncidencia(${t.id})">
                            <div>
                                <span class="task-key fw-bold text-primary me-2">${t.clave_incidencia}</span>
                                <span class="task-desc text-secondary">${t.titulo}</span>
                            </div>
                            <div class="task-hours fw-medium text-dark">${Number(t.horas_registradas || 0).toFixed(1)}h</div>
                        </div>
                    `).join('');
                }

                let html = `
                    <div class="weekly-day-card mb-3 expanded">
                        <div class="weekly-day-header d-flex align-items-center justify-content-between p-3" onclick="toggleWeeklyDay(this)">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-chevron-down toggle-icon text-secondary me-3"></i>
                                <span class="day-title fw-bold text-dark me-3">Lunes, 19 de Octubre 2026</span>
                                <span class="badge badge-hours-blue px-2 py-1">${horas1.toFixed(1)} Horas registradas</span>
                            </div>
                            <div class="weekly-meta-status text-success fw-medium" style="font-size: 0.85rem;">
                                100% de meta diaria
                            </div>
                        </div>
                        <div class="weekly-day-body px-4 py-2 bg-white">
                            ${renderFilas(grupo1)}
                        </div>
                    </div>
                `;

                if (grupo2.length > 0) {
                    html += `
                        <div class="weekly-day-card mb-3">
                            <div class="weekly-day-header d-flex align-items-center justify-content-between p-3" onclick="toggleWeeklyDay(this)">
                                <div class="d-flex align-items-center">
                                    <i class="fas fa-chevron-right toggle-icon text-secondary me-3"></i>
                                    <span class="day-title fw-bold text-dark me-3">Viernes, 16 de Octubre 2026</span>
                                    <span class="badge badge-hours-gray px-2 py-1">${horas2.toFixed(1)} Horas registradas</span>
                                </div>
                                <div class="weekly-meta-status text-muted fw-medium" style="font-size: 0.85rem;">
                                    Completado
                                </div>
                            </div>
                            <div class="weekly-day-body px-4 py-2 bg-white" style="display: none;">
                                ${renderFilas(grupo2)}
                            </div>
                        </div>
                    `;
                }

                contenedor.innerHTML = html;
            })
            .catch(err => console.error('Error al cargar weekly logs:', err));
    }

    window.addEventListener('proyectoCambiado', cargarWeeklyLogs);
    window.addEventListener('incidenciasActualizadas', cargarWeeklyLogs);

    cargarWeeklyLogs();
});
