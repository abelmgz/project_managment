/* static/js/pages/incidencias.js */
document.addEventListener('DOMContentLoaded', function() {
    var cuerpo = document.getElementById('tablaIncidenciasCuerpo');
    if (!cuerpo) return;

    fetch('/api/tareas')
        .then(res => res.json())
        .then(data => {
            cuerpo.innerHTML = "";
            if(!Array.isArray(data) || data.length === 0) {
                cuerpo.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No hay incidencias registradas</td></tr>';
                return;
            }
            data.forEach(t => {
                cuerpo.innerHTML += `
                    <tr>
                        <td style="padding-left:16px;"><a href="#" class="fw-bold text-decoration-none text-primary">${t.clave_incidencia}</a></td>
                        <td class="fw-medium text-dark">${t.titulo}</td>
                        <td><span class="text-secondary"><i class="fas fa-tag fa-xs me-1"></i>${t.componente}</span></td>
                        <td><span class="badge-priority priority-${t.prioridad}">${t.prioridad}</span></td>
                        <td><span class="badge-status status-${t.estado}">${t.estado.toUpperCase()}</span></td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="avatar-kanban me-2" style="width:20px; height:20px; font-size:0.6rem;">${t.asignado_nombre ? t.asignado_nombre.split(' ').map(n=>n[0]).join('') : 'AM'}</div>
                                <span class="text-dark fw-medium" style="font-size:0.82rem;">${t.asignado_nombre || 'Abel Martinez'}</span>
                            </div>
                        </td>
                        <td style="text-align:center; padding-right:16px;"><button class="btn btn-sm btn-light border" style="font-size:0.75rem;"><i class="fas fa-ellipsis-h"></i></button></td>
                    </tr>`;
            });
        });
});
