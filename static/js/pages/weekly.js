/* static/js/pages/weekly.js */
function toggleWeeklySection(headerElement) {
    var container = headerElement.closest('.weekly-day-container');
    var body = container.querySelector('.weekly-content-body');
    var arrow = headerElement.querySelector('.weekly-arrow-toggle');

    if (container.classList.contains('collapsed')) {
        container.classList.remove('collapsed');
        body.classList.remove('d-none');
        arrow.classList.remove('fa-chevron-right');
        arrow.classList.add('fa-chevron-down');
    } else {
        container.classList.add('collapsed');
        body.classList.add('d-none');
        arrow.classList.remove('fa-chevron-down');
        arrow.classList.add('fa-chevron-right');
    }
}
console.log("Controlador de bitácora semanal cargado con éxito.");
