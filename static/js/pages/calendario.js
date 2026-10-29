/* static/js/pages/calendario.js */
document.addEventListener('DOMContentLoaded', function() {
    var matriz = document.getElementById('cuadradaCalendarioMatriz');
    if (!matriz) return;

    // Matriz de distribución en espejo para Octubre 2026 (Inicia Jueves 1)
    var celdasHtml = "";
    
    // Días del mes anterior (Septiembre de relleno)
    celdasHtml += `<div class="calendar-day-box"><span class="day-number-text text-muted">28</span></div>`;
    celdasHtml += `<div class="calendar-day-box"><span class="day-number-text text-muted">29</span></div>`;
    celdasHtml += `<div class="calendar-day-box"><span class="day-number-text text-muted">30</span></div>`;

    for (var d = 1; d <= 25; d++) {
        var clasesBox = "calendar-day-box";
        var etiquetaHoy = "";
        
        // El día 19 es Hoy según la bitácora
        if (d === 19) {
            clasesBox += " day-box-today";
            etiquetaHoy = " (Hoy)";
        }

        celdasHtml += `<div class="${clasesBox}" id="day-oct-${d}"><span class="day-number-text">${d}${etiquetaHoy}</span></div>`;
    }

    matriz.innerHTML = celdasHtml;

    // Inyectar Hitos Muestra de la imagen de Jira de forma manual y robusta
    var box7 = document.getElementById('day-oct-7');
    if(box7) box7.innerHTML += `<div class="calendar-badge-event event-blue-soft">Auditoría Switch Planta</div>`;

    var box19 = document.getElementById('day-oct-19');
    if(box19) box19.innerHTML += `<div class="calendar-badge-event event-blue-dark">Revisión de Red Escobedo</div>`;

    var box20 = document.getElementById('day-oct-20');
    if(box20) box20.innerHTML += `<div class="calendar-badge-event event-green-soft">Inventario Routers</div>`;
});
