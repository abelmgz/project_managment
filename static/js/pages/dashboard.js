/* static/js/pages/dashboard.js */
document.addEventListener('DOMContentLoaded', function() {
    var ctx = document.getElementById('chartCarga');
    if (!ctx) return;

    var chartInstance = null;

    function actualizarGraficaYTarjetas(tareas) {
        var totalPendientes = tareas.filter(t => t.estado === 'Por-Hacer').length;
        var totalProgreso = tareas.filter(t => t.estado === 'En-Curso').length;
        var totalRevision = tareas.filter(t => t.estado === 'Revision').length;
        var totalCompletadas = tareas.filter(t => t.estado === 'Finalizado').length;
        var total = tareas.length;

        document.getElementById('metricaTotal').innerText = total;
        document.getElementById('metricaProgreso').innerText = totalProgreso + totalRevision;
        document.getElementById('metricaCompletadas').innerText = totalCompletadas;

        var avance = total > 0 ? Math.round((totalCompletadas / total) * 100) : 0;
        document.getElementById('metricaEficiencia').innerText = avance + "%";

        var contBarra = document.getElementById('contenedorBarraProgreso');
        contBarra.innerHTML = "";
        document.getElementById('barraLeyendaTexto').innerText = `${totalCompletadas} de ${total} incidencias completadas`;

        if (total > 0) {
            var pctHacer = (totalPendientes / total) * 100;
            var pctCurso = (totalProgreso / total) * 100;
            var pctRev = (totalRevision / total) * 100;
            var pctListo = (totalCompletadas / total) * 100;

            if (pctHacer > 0) contBarra.innerHTML += `<div class="progress-bar bg-secondary" style="width: ${pctHacer}%"></div>`;
            if (pctCurso > 0) contBarra.innerHTML += `<div class="progress-bar bg-primary" style="width: ${pctCurso}%"></div>`;
            if (pctRev > 0) contBarra.innerHTML += `<div class="progress-bar bg-warning" style="width: ${pctRev}%"></div>`;
            if (pctListo > 0) contBarra.innerHTML += `<div class="progress-bar bg-success" style="width: ${pctListo}%"></div>`;
        } else {
            contBarra.innerHTML = `<div class="progress-bar bg-secondary" style="width: 100%"></div>`;
        }

        if (chartInstance) {
            chartInstance.destroy();
        }
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Por Hacer', 'En Curso', 'En Revisión', 'Resuelto'],
                datasets: [{
                    data: [totalPendientes, totalProgreso, totalRevision, totalCompletadas],
                    backgroundColor: ['#7a869a', '#0052cc', '#ffab00', '#36b37e']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
            }
        });
    }

    function renderizarMuroActividad(tareas) {
        var muro = document.getElementById('contenedorMuroActividad');
        if (!muro) return;

        muro.innerHTML = "";
        if (!Array.isArray(tareas) || tareas.length === 0) {
            muro.innerHTML = '<div class="text-muted text-center py-4">Sin actividad reciente para este proyecto</div>';
            return;
        }

        tareas.slice(0, 6).forEach(t => {
            var item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center px-0 py-2 border-bottom';
            item.style.cursor = 'pointer';
            item.setAttribute('onclick', `window.abrirDetalleIncidencia(${t.id})`);
            item.innerHTML = `
                <div>
                    <span class="fw-bold text-primary me-2" style="font-size:0.85rem;">${t.clave_incidencia}</span>
                    <span class="text-dark" style="font-size:0.85rem;">${t.titulo}</span>
                </div>
                <span class="badge bg-light text-dark border font-monospace" style="font-size:0.7rem; border-color:#dfe1e6!important;">${t.estado.toUpperCase()}</span>
            `;
            muro.appendChild(item);
        });
    }

    function cargarDashboard() {
        var activoId = window.obtenerProyectoActivoId ? window.obtenerProyectoActivoId() : '';
        var url = activoId ? `/api/tareas?proyecto_id=${encodeURIComponent(activoId)}` : '/api/tareas';

        fetch(url)
            .then(res => res.json())
            .then(tareas => {
                var lista = Array.isArray(tareas) ? tareas : [];
                if (window.registrarTareasEnCache) {
                    window.registrarTareasEnCache(lista);
                }
                actualizarGraficaYTarjetas(lista);
                renderizarMuroActividad(lista);
            })
            .catch(err => console.error('Error al cargar dashboard:', err));
    }

    window.addEventListener('proyectoCambiado', cargarDashboard);
    window.addEventListener('incidenciasActualizadas', cargarDashboard);

    cargarDashboard();
});
