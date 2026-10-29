/* static/js/pages/kanban.js */
function allowDrop(ev) { ev.preventDefault(); }
function dragCard(ev, id) { ev.dataTransfer.setData("text/plain", id); }

function dropCard(ev, nuevoEstado) {
    ev.preventDefault();
    var id = ev.dataTransfer.getData("text/plain");
    var formData = new FormData();
    formData.append("id", id);
    formData.append("estado", nuevoEstado);

    fetch('/api/tareas/actualizar-estado', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(() => cargarTableroKanban());
}

function cargarTableroKanban() {
    fetch('/api/tareas')
        .then(res => res.json())
        .then(tareas => {
            var colHacer = document.querySelector('#col-Por-Hacer .kanban-cards-container');
            var colCurso = document.querySelector('#col-En-Curso .kanban-cards-container');
            var colRev = document.querySelector('#col-Revision .kanban-cards-container');
            var colFin = document.querySelector('#col-Finalizado .kanban-cards-container');

            colHacer.innerHTML = ""; colCurso.innerHTML = ""; colRev.innerHTML = ""; colFin.innerHTML = "";
            var c1=0, c2=0, c3=0, c4=0;

            tareas.forEach(t => {
                var cardHtml = `
                    <div class="kanban-item-card" draggable="true" ondragstart="dragCard(event, '${t.id}')">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <a href="#" class="card-key-link">${t.clave_incidencia}</a>
                            <span class="badge-priority priority-${t.prioridad}">${t.prioridad}</span>
                        </div>
                        <div class="text-dark mb-3" style="font-size:0.85rem; font-weight:500; line-height:1.3;">${t.titulo}</div>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="card-tag-box"><i class="fas fa-tag fa-xs me-1"></i>${t.componente}</span>
                            <div class="avatar-kanban">${t.asignado_nombre ? t.asignado_nombre.split(' ').map(n=>n[0]).join('') : 'AM'}</div>
                        </div>
                    </div>`;

                if (t.estado === 'Por-Hacer') { colHacer.innerHTML += cardHtml; c1++; }
                else if (t.estado === 'En-Curso') { colCurso.innerHTML += cardHtml; c2++; }
                else if (t.estado === 'Revision') { colRev.innerHTML += cardHtml; c3++; }
                else if (t.estado === 'Finalizado') { colFin.innerHTML += cardHtml; c4++; }
            });

            document.getElementById('count-Por-Hacer').innerText = c1;
            document.getElementById('count-En-Curso').innerText = c2;
            document.getElementById('count-Revision').innerText = c3;
            document.getElementById('count-Finalizado').innerText = c4;
        });
}
document.addEventListener('DOMContentLoaded', cargarTableroKanban);
