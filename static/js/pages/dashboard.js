/* static/js/pages/dashboard.js */
document.addEventListener('DOMContentLoaded', function() {
    var ctx = document.getElementById('chartCarga');
    if (!ctx) return;

    var mockData = [
        { usuario_nombre: "Abel Martinez", tareas_pendientes: 1, tareas_en_progreso: 1, tareas_completadas: 1 }
    ];

    function actualizarGraficaYTarjetas(data) {
        var totalPendientes = data.reduce((a, b) => a + (Number(b.tareas_pendientes) || 0), 0);
        var totalProgreso = data.reduce((a, b) => a + (Number(b.tareas_en_progreso) || 0), 0);
        var totalCompletadas = data.reduce((a, b) => a + (Number(b.tareas_completadas) || 0), 0);
        var total = totalPendientes + totalProgreso + totalCompletadas;

        document.getElementById('metricaTotal').innerText = total;
        document.getElementById('metricaProgreso').innerText = totalProgreso;
        document.getElementById('metricaCompletadas').innerText = totalCompletadas;
        
        var avance = total > 0 ? Math.round((totalCompletadas / total) * 100) : 0;
        document.getElementById('metricaEficiencia').innerText = avance + "%";

        // Dibujar Barra de Desglose Multicolor Continua
        var contBarra = document.getElementById('contenedorBarraProgreso');
        contBarra.innerHTML = "";
        document.getElementById('barraLeyendaTexto').innerText = `${totalCompletadas} de ${total} incidencias completadas`;

        if (total > 0) {
            var pctHacer = (totalPendientes / total) * 100;
            var pctCurso = (totalProgreso / total) * 100;
            var pctListo = (totalCompletadas / total) * 100;

            if(pctHacer > 0) contBarra.innerHTML += `<div class="progress-bar bg-secondary" style="width: ${pctHacer}%"></div>`;
            if(pctCurso > 0) contBarra.innerHTML += `<div class="progress-bar bg-primary" style="width: ${pctCurso}%"></div>`;
            if(pctListo > 0) contBarra.innerHTML += `<div class="progress-bar bg-success" style="width: ${pctListo}%"></div>`;
        } else {
            contBarra.innerHTML = `<div class="progress-bar bg-secondary" style="width: 100%"></div>`;
        }

        // Gráfico de Dona Estilizado
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Por Hacer', 'En Curso', 'Resuelto'],
                datasets: [{
                    data: [totalPendientes, totalProgreso, totalCompletadas],
                    backgroundColor: ['#7a869a', '#0052cc', '#36b37e']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
            }
        });
    }

    fetch('/api/reportes/carga')
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                actualizarGraficaYTarjetas(data);
            } else {
                actualizarGraficaYTarjetas(mockData);
            }
        }).catch(() => actualizarGraficaYTarjetas(mockData));

    // Muro de Actividad Reciente
    var muro = document.getElementById('contenedorMuroActividad');
    fetch('/api/tareas')
        .then(res => res.json())
        .then(tareas => {
            muro.innerHTML = "";
            if(tareas.length === 0) {
                muro.innerHTML = '<div class="text-muted text-center py-4">Sin actividad reciente</div>';
                return;
            }
            tareas.slice(0, 4).forEach(t => {
                muro.innerHTML += `
                    <div class="list-group-item d-flex justify-content-between align-items-center px-0 py-2 border-bottom">
                        <div>
                            <span class="fw-bold text-primary me-2" style="font-size:0.85rem;">${t.clave_incidencia}</span>
                            <span class="text-dark" style="font-size:0.85rem;">${t.titulo}</span>
                        </div>
                        <span class="badge bg-light text-dark border font-monospace" style="font-size:0.7rem; border-color:#dfe1e6!important;">${t.estado.toUpperCase()}</span>
                    </div>`;
            });
        });
});
