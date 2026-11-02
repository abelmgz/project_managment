from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Optional
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, text
from sqlalchemy.orm import Session

import database
import models

PERMISOS_POR_ROL = {
    "Owner": "ver_todo,ver_usuarios,gestionar_usuarios,crear_editar,eliminar_todo",
    "Administrador": "ver_todo,ver_usuarios,gestionar_usuarios,crear_editar",
    "Usuario": "ver_propias,crear_propias,comentar",
}


def _formatear_fecha_hora(dt) -> str:
    if not dt:
        return ""
    if isinstance(dt, str):
        return dt[:16].replace("T", " ")
    return dt.strftime("%Y-%m-%d %H:%M")


def _permisos_por_defecto(rol: str) -> str:
    return PERMISOS_POR_ROL.get(rol, PERMISOS_POR_ROL["Usuario"])


def inicializar_datos():
    """Inicializa de forma segura la estructura física, usuarios con roles, tareas, comentarios e historial."""
    models.Base.metadata.create_all(bind=database.engine)

    with database.SessionLocal() as db:
        # Asegurar los usuarios semilla con los 3 roles: Owner, Administrador y Usuario
        usuarios_semilla = [
            {
                "nombre": "Abel Martinez",
                "email": "abel@correo.com",
                "rol": "Owner",
                "cargo": "Project Owner & Director IT",
                "permisos": PERMISOS_POR_ROL["Owner"],
            },
            {
                "nombre": "Carlos Administrador",
                "email": "carlos@correo.com",
                "rol": "Administrador",
                "cargo": "Administrador de Infraestructura",
                "permisos": PERMISOS_POR_ROL["Administrador"],
            },
            {
                "nombre": "Tomas Lopez",
                "email": "tomas@correo.com",
                "rol": "Usuario",
                "cargo": "Ingeniero de Switching & Wi-Fi",
                "permisos": PERMISOS_POR_ROL["Usuario"],
            },
            {
                "nombre": "Elena Torres",
                "email": "elena@correo.com",
                "rol": "Usuario",
                "cargo": "Especialista VPN & Firewall",
                "permisos": PERMISOS_POR_ROL["Usuario"],
            },
        ]

        mapa_usuarios = {}
        for u_data in usuarios_semilla:
            existente = db.query(models.Usuario).filter(models.Usuario.email == u_data["email"]).first()
            if not existente:
                existente = models.Usuario(**u_data)
                db.add(existente)
                db.commit()
                db.refresh(existente)
            else:
                # Actualizar rol/permisos si el usuario ya existía sin rol asignado
                modificado = False
                if existente.email == "carlos@correo.com" and existente.rol == "Usuario":
                    existente.rol = "Administrador"
                    existente.permisos = PERMISOS_POR_ROL["Administrador"]
                    existente.cargo = u_data["cargo"]
                    modificado = True
                if not existente.permisos:
                    existente.permisos = _permisos_por_defecto(existente.rol)
                    modificado = True
                if modificado:
                    db.commit()
                    db.refresh(existente)
            mapa_usuarios[u_data["email"]] = existente

        usuario_owner = mapa_usuarios["abel@correo.com"]
        usuario_admin = mapa_usuarios["carlos@correo.com"]
        usuario_tomas = mapa_usuarios["tomas@correo.com"]
        usuario_elena = mapa_usuarios["elena@correo.com"]

        proyecto_principal = db.query(models.Proyecto).first()
        if not proyecto_principal:
            proyecto_principal = models.Proyecto(
                nombre="IT Network & Systems (DANA Escobedo)",
                clave_proyecto="NET",
                descripcion="Proyecto de Software Ágil para administración de infraestructura de red."
            )
            db.add(proyecto_principal)
            db.commit()
            db.refresh(proyecto_principal)

        if db.query(models.Tarea).count() == 0:
            semillas = [
                models.Tarea(
                    clave_incidencia="NET-101",
                    titulo="Auditoría de switches y enlaces planta Escobedo",
                    descripcion="Revisión de la topología lógica y física de switches centrales.",
                    estado="En-Curso",
                    prioridad="Alta",
                    componente="Switching",
                    horas_registradas=3.5,
                    fecha_limite=datetime(2026, 10, 7),
                    proyecto_id=proyecto_principal.id,
                    asignado_id=usuario_owner.id,
                ),
                models.Tarea(
                    clave_incidencia="NET-102",
                    titulo="Configuración de gateway de respaldo VPN",
                    descripcion="Montaje de túnel IPSec secundario para redundancia de operaciones.",
                    estado="Por-Hacer",
                    prioridad="Alta",
                    componente="VPN/Firewall",
                    horas_registradas=0.0,
                    fecha_limite=datetime(2026, 10, 19),
                    proyecto_id=proyecto_principal.id,
                    asignado_id=usuario_elena.id,
                ),
                models.Tarea(
                    clave_incidencia="NET-103",
                    titulo="Actualización de firmware en Access Points",
                    descripcion="Despliegue global de parches de seguridad inalámbricos para APs corporativos.",
                    estado="Revision",
                    prioridad="Media",
                    componente="Wi-Fi",
                    horas_registradas=2.0,
                    fecha_limite=datetime(2026, 10, 26),
                    proyecto_id=proyecto_principal.id,
                    asignado_id=usuario_tomas.id,
                ),
                models.Tarea(
                    clave_incidencia="NET-104",
                    titulo="Inventario de direcciones IP estáticas",
                    descripcion="Mapeo y depuración de subredes de servidores y terminales críticas.",
                    estado="Finalizado",
                    prioridad="Baja",
                    componente="Inventario",
                    horas_registradas=3.0,
                    fecha_limite=datetime(2026, 10, 20),
                    proyecto_id=proyecto_principal.id,
                    asignado_id=usuario_admin.id,
                ),
            ]
            db.add_all(semillas)
            db.commit()
        else:
            # Distribuir las 4 tareas semilla entre los usuarios si todas estaban en el mismo id=1
            fechas_y_asignados = {
                "NET-101": (datetime(2026, 10, 7), usuario_owner.id),
                "NET-102": (datetime(2026, 10, 19), usuario_elena.id),
                "NET-103": (datetime(2026, 10, 26), usuario_tomas.id),
                "NET-104": (datetime(2026, 10, 20), usuario_admin.id),
            }
            tareas_semilla = (
                db.query(models.Tarea)
                .filter(models.Tarea.clave_incidencia.in_(list(fechas_y_asignados.keys())))
                .all()
            )
            asignados_actuales = {t.asignado_id for t in tareas_semilla}
            actualizado = False
            for t in tareas_semilla:
                fecha_def, asig_def = fechas_y_asignados[t.clave_incidencia]
                if t.fecha_limite is None:
                    t.fecha_limite = fecha_def
                    actualizado = True
                if len(asignados_actuales) <= 1:
                    t.asignado_id = asig_def
                    actualizado = True
            if actualizado:
                db.commit()

        # Sembrar comentarios iniciales e historial para cada incidencia que aún no tenga comentarios
        comentarios_por_clave = {
            "NET-101": [
                ("Abel Martinez", "Se inició el escaneo de puertos troncales en los switches Cisco Catalyst de planta Escobedo."),
                ("Carlos Administrador", "Validado enlace de fibra óptica del MDF principal; pendiente documentar puertos de respaldo."),
            ],
            "NET-102": [
                ("Elena Torres", "Se definieron los parámetros de cifrado IKEv2 / AES-256 para el túnel secundario IPSec."),
                ("Carlos Administrador", "Programada ventana de pruebas de conmutación por error (failover) con el ISP secundario."),
            ],
            "NET-103": [
                ("Tomas Lopez", "Firmware descargado y verificado mediante hash SHA-256 en el controlador inalámbrico."),
                ("Abel Martinez", "Actualizados los APs del sector administrativo; en revisión de estabilidad de señal."),
            ],
            "NET-104": [
                ("Carlos Administrador", "Completado el barrido de subredes VLAN 10, 20 y 30 sin conflictos de IP detectados."),
                ("Abel Martinez", "Listado de direcciones IP estáticas exportado y respaldado en Confluence."),
            ],
        }

        todas_las_tareas = db.query(models.Tarea).all()
        hubo_inserciones = False
        for tarea in todas_las_tareas:
            num_comentarios = db.query(models.Comentario).filter(models.Comentario.tarea_id == tarea.id).count()
            if num_comentarios == 0:
                textos = comentarios_por_clave.get(
                    tarea.clave_incidencia,
                    [("Abel Martinez", f"Incidencia {tarea.clave_incidencia} registrada y asignada para seguimiento técnico.")],
                )
                for autor, texto in textos:
                    db.add(models.Comentario(tarea_id=tarea.id, autor=autor, contenido=texto))
                hubo_inserciones = True

            num_historial = db.query(models.HistorialTarea).filter(models.HistorialTarea.tarea_id == tarea.id).count()
            if num_historial == 0:
                db.add(
                    models.HistorialTarea(
                        tarea_id=tarea.id,
                        campo_modificado="Creación",
                        valor_anterior="-",
                        valor_nuevo=f"Estado inicial: {tarea.estado}",
                    )
                )
                hubo_inserciones = True

        if hubo_inserciones:
            db.commit()

        # Sembrar documentos iniciales de Confluence Canvas si no existen
        if db.query(models.DocumentoCanvas).count() == 0:
            proy_principal = db.query(models.Proyecto).first()
            proy_id_def = proy_principal.id if proy_principal else None
            autor_def = usuario_owner.id if usuario_owner else 1

            docs_semilla = [
                models.DocumentoCanvas(
                    titulo="Topología de Red & Procedimientos de Operación",
                    categoria="Arquitectura & Red",
                    icono="fa-network-wired",
                    tipo_automatizacion="manual",
                    auto_sincronizar=1,
                    version=1,
                    proyecto_id=proy_id_def,
                    autor_id=autor_def,
                    actualizado_por="Abel Martinez",
                    contenido="""
<div class="canvas-callout canvas-callout-info mb-3">
    <div class="fw-bold mb-1"><i class="fas fa-satellite-dish me-1 text-primary"></i> Documento Operativo Vinculado en Vivo</div>
    <div class="small text-secondary">Este lienzo sincroniza automáticamente el estado de las incidencias de infraestructura y las métricas de red del proyecto activo.</div>
</div>
<h5 class="fw-bold mb-2">1. Normativa de Mantenimiento Preventivo</h5>
<p class="text-secondary">Toda modificación a los gateways o switches centrales en planta Escobedo requiere ventana de mantenimiento autorizada después de las <strong>18:00 hrs</strong> o durante fines de semana, vinculando la clave de incidencia correspondiente (ej. <span class="jira-smart-link" data-issue-key="NET-101">NET-101</span> o <span class="jira-smart-link" data-issue-key="NET-102">NET-102</span>).</p>
<h5 class="fw-bold mt-4 mb-2">2. Direccionamiento y Subredes Principales</h5>
<ul>
    <li><strong>VLAN 10 (Gestión &amp; Servidores):</strong> <code>192.168.10.0/24</code> — Monitoreo SNMP y Controladores</li>
    <li><strong>VLAN 20 (Dispositivos Producción):</strong> <code>192.168.20.0/23</code> — Red Industrial Planta</li>
    <li><strong>VLAN 30 (Oficinas Administrativas):</strong> <code>192.168.30.0/24</code> — Cobertura Wi-Fi 6 Corporativa (<span class="jira-smart-link" data-issue-key="NET-103">NET-103</span>)</li>
</ul>
<h5 class="fw-bold mt-4 mb-2">3. Estado en Tiempo Real de Incidencias del Proyecto</h5>
<div class="canvas-live-macro" data-canvas-macro="kpis"></div>
<div class="canvas-live-macro mt-3" data-canvas-macro="incidencias"></div>
""".strip(),
                ),
                models.DocumentoCanvas(
                    titulo="Normativa de Mantenimiento & Ventanas de Cambio",
                    categoria="Procedimientos / Runbooks",
                    icono="fa-clipboard-check",
                    tipo_automatizacion="runbook_componentes",
                    auto_sincronizar=1,
                    version=1,
                    proyecto_id=proy_id_def,
                    autor_id=usuario_admin.id if usuario_admin else 1,
                    actualizado_por="Carlos Administrador",
                    contenido="""
<h5 class="fw-bold mb-2">Protocolo Estándar de Ejecución (SOP)</h5>
<p class="text-secondary">Antes de promover cualquier cambio en conmutadores troncales o túneles IPSec a estado <strong>Finalizado</strong>, el ingeniero asignado debe completar la lista de verificación técnica y registrar evidencia en los comentarios de la incidencia.</p>
<ul class="canvas-checklist list-unstyled ps-1">
    <li><input type="checkbox" checked> Respaldo previo de configuración running-config en TFTP/Git.</li>
    <li><input type="checkbox" checked> Validación de enlaces redundantes y pruebas de failover (<span class="jira-smart-link" data-issue-key="NET-102">NET-102</span>).</li>
    <li><input type="checkbox"> Verificación de tabla ARP e inventario de IPs estáticas (<span class="jira-smart-link" data-issue-key="NET-104">NET-104</span>).</li>
</ul>
<h5 class="fw-bold mt-4 mb-2">Bitácora Automatizada de Actividad y Cambios Recientes</h5>
<div class="canvas-live-macro" data-canvas-macro="bitacora"></div>
""".strip(),
                ),
                models.DocumentoCanvas(
                    titulo="Política de Respaldos Cisco & Matriz de Equipo",
                    categoria="Reportes Automáticos",
                    icono="fa-shield-alt",
                    tipo_automatizacion="matriz_carga_equipo",
                    auto_sincronizar=1,
                    version=1,
                    proyecto_id=proy_id_def,
                    autor_id=autor_def,
                    actualizado_por="Abel Martinez",
                    contenido="""
<h5 class="fw-bold mb-2">Frecuencia y Retención de Respaldos</h5>
<p class="text-secondary">Los respaldos de configuración de routers de borde, firewalls y controladores inalámbricos se ejecutan de forma programada cada 24 horas y tras cada cierre de incidencia en el tablero Kanban.</p>
<h5 class="fw-bold mt-4 mb-2">Distribución Operativa y Carga del Equipo en Vivo</h5>
<div class="canvas-live-macro" data-canvas-macro="equipo"></div>
""".strip(),
                ),
            ]
            for doc in docs_semilla:
                db.add(doc)
                db.flush()
                db.add(
                    models.VersionDocumentoCanvas(
                        documento_id=doc.id,
                        numero_version=1,
                        autor=doc.actualizado_por,
                        resumen_cambio="Creación y vinculación automática inicial",
                        contenido_snapshot=doc.contenido,
                    )
                )
            db.commit()


# Asegurar inicialización incluso si uvicorn recarga el módulo en caliente
inicializar_datos()


@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_datos()
    yield


app = FastAPI(title="Jira Software Local Suite", lifespan=lifespan)


@app.middleware("http")
async def disable_cache_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# Montar archivos estáticos locales
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configurar motor de plantillas Jinja2
templates = Jinja2Templates(directory="templates")

# Definición limpia de la Inyección de Dependencia de Base de Datos con Annotated
DbSession = Annotated[Session, Depends(database.get_db)]


def _obtener_url_retorno(request: Request, fallback: str = "/") -> str:
    referer = request.headers.get("referer")
    if referer:
        parsed = urlparse(referer)
        if parsed.path:
            return parsed.path
    return fallback


def _parsear_fecha(fecha_str: Optional[str]) -> Optional[datetime]:
    if not fecha_str or not fecha_str.strip():
        return None
    try:
        return datetime.strptime(fecha_str.strip()[:10], "%Y-%m-%d")
    except ValueError:
        return None


def _obtener_usuario_actual(
    request: Request,
    db: Session,
    usuario_id_explicito: Optional[int] = None,
) -> models.Usuario:
    raw_id = (
        usuario_id_explicito
        or request.query_params.get("usuario_id")
        or request.headers.get("X-User-Id")
        or request.cookies.get("jira_user_id")
    )
    usuario = None
    if raw_id and str(raw_id).strip().isdigit():
        usuario = db.query(models.Usuario).filter(models.Usuario.id == int(raw_id)).first()

    if not usuario:
        # Por defecto usar el usuario Owner (Abel Martinez) o el primero registrado
        usuario = db.query(models.Usuario).filter(models.Usuario.rol == "Owner").first()
    if not usuario:
        usuario = db.query(models.Usuario).first()
    return usuario


def _serializar_usuario(u: models.Usuario, total_tareas: int = 0) -> dict:
    permisos_str = u.permisos or _permisos_por_defecto(u.rol)
    lista_permisos = [p.strip() for p in permisos_str.split(",") if p.strip()]
    return {
        "id": u.id,
        "nombre": u.nombre,
        "email": u.email,
        "rol": u.rol,
        "cargo": u.cargo or "Ingeniero de Red",
        "permisos": permisos_str,
        "lista_permisos": lista_permisos,
        "puede_eliminar": u.rol == "Owner" or "eliminar_todo" in lista_permisos,
        "puede_ver_todos": u.rol in ("Owner", "Administrador") or "ver_todo" in lista_permisos,
        "puede_gestionar_usuarios": u.rol in ("Owner", "Administrador") or "gestionar_usuarios" in lista_permisos,
        "total_tareas": total_tareas,
        "fecha_registro": _formatear_fecha_hora(u.fecha_registro),
    }


def _serializar_comentarios_e_historial(db: Session, tarea_id: int) -> dict:
    comentarios_db = (
        db.query(models.Comentario)
        .filter(models.Comentario.tarea_id == tarea_id)
        .order_by(models.Comentario.id.asc())
        .all()
    )
    historial_db = (
        db.query(models.HistorialTarea)
        .filter(models.HistorialTarea.tarea_id == tarea_id)
        .order_by(models.HistorialTarea.id.desc())
        .all()
    )
    return {
        "comentarios": [
            {
                "id": c.id,
                "tarea_id": c.tarea_id,
                "autor": c.autor,
                "contenido": c.contenido,
                "fecha_creacion": _formatear_fecha_hora(c.fecha_creacion),
            }
            for c in comentarios_db
        ],
        "historial": [
            {
                "id": h.id,
                "tarea_id": h.tarea_id,
                "campo_modificado": h.campo_modificado,
                "valor_anterior": h.valor_anterior or "-",
                "valor_nuevo": h.valor_nuevo or "-",
                "fecha_cambio": _formatear_fecha_hora(h.fecha_cambio),
            }
            for h in historial_db
        ],
    }


# --- RUTAS DE NAVEGACIÓN FRONTEND (RENDER DE PLANTILLAS JINJA2) ---

@app.get("/", response_class=HTMLResponse)
def pag_inicio(request: Request):
    return templates.TemplateResponse("pages/dashboard.html", {"request": request, "pagina_activa": "dashboard"})


@app.get("/kanban", response_class=HTMLResponse)
def pag_kanban(request: Request):
    return templates.TemplateResponse("pages/kanban.html", {"request": request, "pagina_activa": "kanban"})


@app.get("/incidencias", response_class=HTMLResponse)
def pag_incidencias(request: Request):
    return templates.TemplateResponse("pages/incidencias.html", {"request": request, "pagina_activa": "incidencias"})


@app.get("/calendario", response_class=HTMLResponse)
def pag_calendario(request: Request):
    return templates.TemplateResponse("pages/calendario.html", {"request": request, "pagina_activa": "calendario"})


@app.get("/weekly", response_class=HTMLResponse)
def pag_weekly(request: Request):
    return templates.TemplateResponse("pages/weekly.html", {"request": request, "pagina_activa": "weekly"})


@app.get("/canvas", response_class=HTMLResponse)
def pag_canvas(request: Request):
    return templates.TemplateResponse("pages/canvas.html", {"request": request, "pagina_activa": "canvas"})


@app.get("/usuarios", response_class=HTMLResponse)
def pag_usuarios(request: Request):
    return templates.TemplateResponse("pages/usuarios.html", {"request": request, "pagina_activa": "usuarios"})


# --- ENDPOINTS DE ADMINISTRACIÓN DE USUARIOS, ROLES Y SESIÓN ---

@app.get("/api/usuarios")
def api_listar_usuarios(
    request: Request,
    db: DbSession,
    usuario_id: Optional[int] = None,
):
    usuario_actual = _obtener_usuario_actual(request, db, usuario_id)
    todos = db.query(models.Usuario).order_by(models.Usuario.id.asc()).all()
    conteos = dict(
        db.query(models.Tarea.asignado_id, func.count(models.Tarea.id))
        .group_by(models.Tarea.asignado_id)
        .all()
    )

    todos_serializados = [_serializar_usuario(u, conteos.get(u.id, 0)) for u in todos]
    actual_serializado = _serializar_usuario(usuario_actual, conteos.get(usuario_actual.id, 0))

    # Si el rol es Administrador u Owner puede ver todos los usuarios; si es Usuario solo ve su propio registro
    if actual_serializado["puede_ver_todos"]:
        usuarios_visibles = todos_serializados
    else:
        usuarios_visibles = [u for u in todos_serializados if u["id"] == usuario_actual.id]

    return {
        "usuario_actual": actual_serializado,
        "usuarios": usuarios_visibles,
        "perfiles_disponibles": todos_serializados,
    }


@app.post("/api/usuarios")
async def api_crear_usuario(request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    if usuario_actual.rol not in ("Owner", "Administrador"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: Solo Administrador u Owner pueden registrar nuevos usuarios.",
        )

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    nombre = str(payload.get("nombre") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    rol = str(payload.get("rol") or "Usuario").strip()
    cargo = str(payload.get("cargo") or "Ingeniero de Red").strip()
    permisos = str(payload.get("permisos") or "").strip()

    if not nombre or not email:
        raise HTTPException(status_code=400, detail="Nombre y correo electrónico son obligatorios")

    if rol not in ("Owner", "Administrador", "Usuario"):
        rol = "Usuario"

    # Un Administrador no puede crear un usuario con rol Owner
    if usuario_actual.rol != "Owner" and rol == "Owner":
        raise HTTPException(status_code=403, detail="Solo un Owner puede asignar el rol de Owner.")

    existente = db.query(models.Usuario).filter(func.lower(models.Usuario.email) == email).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo electrónico")

    if not permisos:
        permisos = _permisos_por_defecto(rol)

    nuevo_u = models.Usuario(
        nombre=nombre,
        email=email,
        rol=rol,
        cargo=cargo or "Ingeniero de Red",
        permisos=permisos,
    )
    db.add(nuevo_u)
    db.commit()
    db.refresh(nuevo_u)

    return {"status": "success", "usuario": _serializar_usuario(nuevo_u, 0)}


@app.put("/api/usuarios/{id_usuario_editar}")
async def api_editar_usuario(id_usuario_editar: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    if usuario_actual.rol not in ("Owner", "Administrador"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: Solo Administrador u Owner pueden modificar usuarios.",
        )

    u_editar = db.query(models.Usuario).filter(models.Usuario.id == id_usuario_editar).first()
    if not u_editar:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if u_editar.rol == "Owner" and usuario_actual.rol != "Owner":
        raise HTTPException(status_code=403, detail="Un Administrador no puede modificar a un usuario Owner.")

    payload = await request.json()

    if "nombre" in payload and str(payload["nombre"]).strip():
        u_editar.nombre = str(payload["nombre"]).strip()
    if "email" in payload and str(payload["email"]).strip():
        nuevo_email = str(payload["email"]).strip().lower()
        duplicado = (
            db.query(models.Usuario)
            .filter(func.lower(models.Usuario.email) == nuevo_email, models.Usuario.id != u_editar.id)
            .first()
        )
        if duplicado:
            raise HTTPException(status_code=400, detail="Ese correo ya pertenece a otro usuario")
        u_editar.email = nuevo_email
    if "cargo" in payload:
        u_editar.cargo = str(payload["cargo"] or "Ingeniero de Red").strip()
    if "rol" in payload and payload["rol"] in ("Owner", "Administrador", "Usuario"):
        nuevo_rol = payload["rol"]
        if nuevo_rol == "Owner" and usuario_actual.rol != "Owner":
            raise HTTPException(status_code=403, detail="Solo un Owner puede otorgar el rol de Owner.")
        u_editar.rol = nuevo_rol
        if "permisos" not in payload or not payload["permisos"]:
            u_editar.permisos = _permisos_por_defecto(nuevo_rol)
    if "permisos" in payload and str(payload["permisos"]).strip():
        u_editar.permisos = str(payload["permisos"]).strip()

    db.commit()
    db.refresh(u_editar)
    total_t = db.query(models.Tarea).filter(models.Tarea.asignado_id == u_editar.id).count()
    return {"status": "success", "usuario": _serializar_usuario(u_editar, total_t)}


@app.delete("/api/usuarios/{id_usuario_eliminar}")
def api_eliminar_usuario(id_usuario_eliminar: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    if usuario_actual.rol != "Owner":
        raise HTTPException(
            status_code=403,
            detail="Privilegio insuficiente: Únicamente el rol Owner tiene permisos para eliminar usuarios.",
        )

    u_eliminar = db.query(models.Usuario).filter(models.Usuario.id == id_usuario_eliminar).first()
    if not u_eliminar:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if u_eliminar.id == usuario_actual.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario activo en sesión.")

    db.delete(u_eliminar)
    db.commit()
    return {"status": "success", "mensaje": "Usuario eliminado correctamente por el Owner"}


# --- ENDPOINTS DE PROYECTOS ---

@app.get("/api/proyectos")
def api_listar_proyectos(db: DbSession):
    proyectos = db.query(models.Proyecto).order_by(models.Proyecto.id.asc()).all()
    conteos = dict(
        db.query(models.Tarea.proyecto_id, func.count(models.Tarea.id))
        .group_by(models.Tarea.proyecto_id)
        .all()
    )
    return [
        {
            "id": p.id,
            "nombre": p.nombre,
            "clave_proyecto": p.clave_proyecto,
            "descripcion": p.descripcion or "",
            "total_tareas": conteos.get(p.id, 0),
        }
        for p in proyectos
    ]


@app.post("/api/proyectos")
async def crear_proyecto_form(
    request: Request,
    db: DbSession,
    nombre: str = Form(...),
    clave: str = Form(...),
    descripcion: str = Form(None),
):
    clave_limpia = clave.strip().upper()
    nombre_limpio = nombre.strip()
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.clave_proyecto == clave_limpia).first()
    if not proyecto:
        proyecto = models.Proyecto(
            nombre=nombre_limpio,
            clave_proyecto=clave_limpia,
            descripcion=(descripcion or "").strip(),
        )
        db.add(proyecto)
        db.commit()
        db.refresh(proyecto)

    if "application/json" in request.headers.get("accept", ""):
        return JSONResponse(
            {
                "status": "success",
                "proyecto": {
                    "id": proyecto.id,
                    "nombre": proyecto.nombre,
                    "clave_proyecto": proyecto.clave_proyecto,
                    "descripcion": proyecto.descripcion or "",
                },
            }
        )

    return RedirectResponse(url=_obtener_url_retorno(request, "/"), status_code=303)


@app.delete("/api/proyectos/{proyecto_id}")
def api_eliminar_proyecto(proyecto_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    if usuario_actual.rol != "Owner":
        raise HTTPException(
            status_code=403,
            detail="Privilegio insuficiente: Solo el rol Owner puede eliminar proyectos.",
        )
    proy = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proy:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    db.delete(proy)
    db.commit()
    return {"status": "success", "mensaje": "Proyecto eliminado"}


# --- ENDPOINTS DE TAREAS / INCIDENCIAS ---

@app.post("/api/tareas")
async def crear_tarea_form(
    request: Request,
    db: DbSession,
    titulo: str = Form(...),
    descripcion: str = Form(None),
    prioridad: str = Form("Media"),
    componente: str = Form("General"),
    estado: str = Form("Por-Hacer"),
    proyecto_id: Optional[str] = Form(None),
    asignado_id: Optional[str] = Form(None),
    fecha_limite: Optional[str] = Form(None),
    horas_registradas: Optional[float] = Form(0.0),
):
    usuario_actual = _obtener_usuario_actual(request, db)

    proyecto = None
    if proyecto_id and str(proyecto_id).strip().isdigit():
        proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == int(proyecto_id)).first()
    if not proyecto:
        proyecto = db.query(models.Proyecto).first()

    # Si el rol es Usuario solo puede asignarse tareas a sí mismo; Admin/Owner pueden elegir asignado
    id_asignado_final = usuario_actual.id if usuario_actual else 1
    if usuario_actual and usuario_actual.rol in ("Owner", "Administrador"):
        if asignado_id and str(asignado_id).strip().isdigit():
            u_dest = db.query(models.Usuario).filter(models.Usuario.id == int(asignado_id)).first()
            if u_dest:
                id_asignado_final = u_dest.id

    prefijo = proyecto.clave_proyecto if proyecto else "NET"

    max_id = db.query(func.max(models.Tarea.id)).scalar() or 0
    consecutivo = max_id + 101
    nueva_clave = f"{prefijo}-{consecutivo}"
    while db.query(models.Tarea).filter(models.Tarea.clave_incidencia == nueva_clave).first():
        consecutivo += 1
        nueva_clave = f"{prefijo}-{consecutivo}"

    fecha_obj = _parsear_fecha(fecha_limite) or datetime(2026, 10, 19)

    nueva_t = models.Tarea(
        clave_incidencia=nueva_clave,
        titulo=titulo.strip(),
        descripcion=(descripcion or "").strip(),
        estado=estado if estado in ("Por-Hacer", "En-Curso", "Revision", "Finalizado") else "Por-Hacer",
        prioridad=prioridad if prioridad in ("Alta", "Media", "Baja") else "Media",
        componente=componente.strip() if componente and componente.strip() else "General",
        horas_registradas=float(horas_registradas or 0.0),
        fecha_limite=fecha_obj,
        proyecto_id=proyecto.id if proyecto else 1,
        asignado_id=id_asignado_final,
    )
    db.add(nueva_t)
    db.commit()
    db.refresh(nueva_t)

    autor_nombre = usuario_actual.nombre if usuario_actual else "Abel Martinez"
    db.add(
        models.Comentario(
            tarea_id=nueva_t.id,
            autor=autor_nombre,
            contenido=f"Incidencia {nueva_t.clave_incidencia} creada en el proyecto {proyecto.nombre if proyecto else 'General'}.",
        )
    )
    db.add(
        models.HistorialTarea(
            tarea_id=nueva_t.id,
            campo_modificado="Creación",
            valor_anterior="-",
            valor_nuevo=f"Estado inicial: {nueva_t.estado}",
        )
    )
    db.commit()

    if "application/json" in request.headers.get("accept", ""):
        return JSONResponse({"status": "success", "id": nueva_t.id, "clave_incidencia": nueva_t.clave_incidencia})

    return RedirectResponse(url=_obtener_url_retorno(request, "/kanban"), status_code=303)


@app.get("/api/reportes/carga")
def api_reporte_carga(
    request: Request,
    db: DbSession,
    proyecto_id: Optional[int] = None,
    usuario_id: Optional[int] = None,
):
    usuario_actual = _obtener_usuario_actual(request, db, usuario_id)
    solo_propias = usuario_actual and usuario_actual.rol == "Usuario"

    condiciones_tarea = []
    params = {}
    if proyecto_id:
        condiciones_tarea.append("t.proyecto_id = :proyecto_id")
        params["proyecto_id"] = proyecto_id

    join_extra = (" AND " + " AND ".join(condiciones_tarea)) if condiciones_tarea else ""
    where_usuario = ""
    if solo_propias:
        where_usuario = "WHERE u.id = :uid"
        params["uid"] = usuario_actual.id

    query_sql = text(f"""
        SELECT u.id AS usuario_id,
               u.nombre AS usuario_nombre,
               u.rol AS usuario_rol,
               COALESCE(SUM(CASE WHEN t.estado = 'Por-Hacer' THEN 1 ELSE 0 END), 0) AS tareas_pendientes,
               COALESCE(SUM(CASE WHEN t.estado = 'En-Curso' THEN 1 ELSE 0 END), 0) AS tareas_en_progreso,
               COALESCE(SUM(CASE WHEN t.estado = 'Revision' THEN 1 ELSE 0 END), 0) AS tareas_en_revision,
               COALESCE(SUM(CASE WHEN t.estado = 'Finalizado' THEN 1 ELSE 0 END), 0) AS tareas_completadas
        FROM usuarios u
        LEFT JOIN tareas t ON u.id = t.asignado_id {join_extra}
        {where_usuario}
        GROUP BY u.id
    """)
    return db.execute(query_sql, params).mappings().all()


@app.get("/api/tareas")
@app.get("/api/tareas/json")
def api_listado_tareas(
    request: Request,
    db: DbSession,
    proyecto_id: Optional[int] = None,
    usuario_id: Optional[int] = None,
):
    usuario_actual = _obtener_usuario_actual(request, db, usuario_id)
    filtros = []
    params = {}

    if proyecto_id:
        filtros.append("proyecto_id = :proyecto_id")
        params["proyecto_id"] = proyecto_id

    # Si el usuario activo tiene rol 'Usuario', solo puede ver sus propias actividades
    if usuario_actual and usuario_actual.rol == "Usuario":
        filtros.append("asignado_id = :asignado_id")
        params["asignado_id"] = usuario_actual.id

    where_sql = ("WHERE " + " AND ".join(filtros)) if filtros else ""
    query_sql = text(f"SELECT * FROM vista_proyectos_tareas {where_sql}")
    return db.execute(query_sql, params).mappings().all()


@app.get("/api/tareas/calendario")
def api_calendario_tareas(
    request: Request,
    db: DbSession,
    proyecto_id: Optional[int] = None,
    usuario_id: Optional[int] = None,
):
    usuario_actual = _obtener_usuario_actual(request, db, usuario_id)
    filtros = []
    params = {}

    if proyecto_id:
        filtros.append("proyecto_id = :proyecto_id")
        params["proyecto_id"] = proyecto_id

    if usuario_actual and usuario_actual.rol == "Usuario":
        filtros.append("asignado_id = :asignado_id")
        params["asignado_id"] = usuario_actual.id

    where_sql = ("WHERE " + " AND ".join(filtros)) if filtros else ""
    query_sql = text(f"SELECT * FROM vista_calendario_tareas {where_sql}")
    return db.execute(query_sql, params).mappings().all()


@app.get("/api/tareas/{tarea_id}")
def api_obtener_tarea(tarea_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    query_sql = text("SELECT * FROM vista_proyectos_tareas WHERE id = :tarea_id")
    fila = db.execute(query_sql, {"tarea_id": tarea_id}).mappings().first()
    if not fila:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    if usuario_actual and usuario_actual.rol == "Usuario" and fila["asignado_id"] != usuario_actual.id:
        raise HTTPException(status_code=403, detail="Solo puedes consultar tus propias actividades asignadas.")

    resultado = dict(fila)
    resultado.update(_serializar_comentarios_e_historial(db, tarea_id))
    return resultado


@app.get("/api/tareas/{tarea_id}/comentarios")
def api_listar_comentarios_tarea(tarea_id: int, db: DbSession):
    tarea = db.query(models.Tarea).filter(models.Tarea.id == tarea_id).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return _serializar_comentarios_e_historial(db, tarea_id)


@app.post("/api/tareas/{tarea_id}/comentarios")
async def api_agregar_comentario_tarea(tarea_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    tarea = db.query(models.Tarea).filter(models.Tarea.id == tarea_id).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    contenido = str(payload.get("contenido") or payload.get("comentario") or "").strip()
    autor = (
        str(payload.get("autor") or "").strip()
        or (usuario_actual.nombre if usuario_actual else "Abel Martinez")
    )

    if not contenido:
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")

    nuevo_comentario = models.Comentario(
        tarea_id=tarea.id,
        autor=autor,
        contenido=contenido,
    )
    db.add(nuevo_comentario)
    db.add(
        models.HistorialTarea(
            tarea_id=tarea.id,
            campo_modificado="Comentario",
            valor_anterior=autor,
            valor_nuevo=contenido if len(contenido) <= 90 else contenido[:87] + "...",
        )
    )
    db.commit()

    datos = _serializar_comentarios_e_historial(db, tarea_id)
    return {"status": "success", **datos}


@app.put("/api/tareas/{tarea_id}")
@app.post("/api/tareas/{tarea_id}/editar")
async def api_editar_tarea(tarea_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    tarea = db.query(models.Tarea).filter(models.Tarea.id == tarea_id).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    if usuario_actual and usuario_actual.rol == "Usuario" and tarea.asignado_id != usuario_actual.id:
        raise HTTPException(status_code=403, detail="Solo puedes editar tus propias actividades.")

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    if "titulo" in payload and str(payload["titulo"]).strip():
        nuevo_titulo = str(payload["titulo"]).strip()
        if nuevo_titulo != tarea.titulo:
            db.add(models.HistorialTarea(tarea_id=tarea.id, campo_modificado="Título", valor_anterior=tarea.titulo, valor_nuevo=nuevo_titulo))
            tarea.titulo = nuevo_titulo

    if "descripcion" in payload:
        nueva_desc = str(payload["descripcion"] or "").strip()
        if nueva_desc != (tarea.descripcion or ""):
            db.add(models.HistorialTarea(tarea_id=tarea.id, campo_modificado="Descripción", valor_anterior="Actualizada", valor_nuevo=nueva_desc[:80] or "Vacía"))
            tarea.descripcion = nueva_desc

    if "estado" in payload and payload["estado"] in ("Por-Hacer", "En-Curso", "Revision", "Finalizado"):
        tarea.estado = payload["estado"]

    if "prioridad" in payload and payload["prioridad"] in ("Alta", "Media", "Baja"):
        tarea.prioridad = payload["prioridad"]

    if "componente" in payload:
        nuevo_comp = str(payload["componente"] or "General").strip() or "General"
        if nuevo_comp != (tarea.componente or ""):
            db.add(models.HistorialTarea(tarea_id=tarea.id, campo_modificado="Componente", valor_anterior=tarea.componente or "General", valor_nuevo=nuevo_comp))
            tarea.componente = nuevo_comp

    if "horas_registradas" in payload and payload["horas_registradas"] not in (None, ""):
        try:
            nuevas_horas = float(payload["horas_registradas"])
            if nuevas_horas != float(tarea.horas_registradas or 0.0):
                db.add(models.HistorialTarea(tarea_id=tarea.id, campo_modificado="Horas", valor_anterior=f"{tarea.horas_registradas}h", valor_nuevo=f"{nuevas_horas}h"))
                tarea.horas_registradas = nuevas_horas
        except (TypeError, ValueError):
            pass

    if "fecha_limite" in payload:
        fecha_parseada = _parsear_fecha(str(payload["fecha_limite"] or ""))
        if fecha_parseada:
            ant_str = tarea.fecha_limite.strftime("%Y-%m-%d") if tarea.fecha_limite else "-"
            nue_str = fecha_parseada.strftime("%Y-%m-%d")
            if ant_str != nue_str:
                db.add(models.HistorialTarea(tarea_id=tarea.id, campo_modificado="Fecha Límite", valor_anterior=ant_str, valor_nuevo=nue_str))
            tarea.fecha_limite = fecha_parseada

    if "asignado_id" in payload and payload["asignado_id"] and usuario_actual and usuario_actual.rol in ("Owner", "Administrador"):
        try:
            nuevo_asig_id = int(payload["asignado_id"])
            u_nuevo = db.query(models.Usuario).filter(models.Usuario.id == nuevo_asig_id).first()
            if u_nuevo and tarea.asignado_id != u_nuevo.id:
                u_ant = db.query(models.Usuario).filter(models.Usuario.id == tarea.asignado_id).first()
                db.add(
                    models.HistorialTarea(
                        tarea_id=tarea.id,
                        campo_modificado="Asignado",
                        valor_anterior=u_ant.nombre if u_ant else "Sin asignar",
                        valor_nuevo=u_nuevo.nombre,
                    )
                )
                tarea.asignado_id = u_nuevo.id
        except (TypeError, ValueError):
            pass

    db.commit()
    datos = _serializar_comentarios_e_historial(db, tarea_id)
    return {"status": "success", "mensaje": "Incidencia actualizada correctamente", **datos}


@app.delete("/api/tareas/{tarea_id}")
def api_eliminar_tarea(tarea_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    if usuario_actual.rol != "Owner":
        raise HTTPException(
            status_code=403,
            detail="Privilegio insuficiente: Solo el rol Owner tiene permisos para eliminar incidencias.",
        )

    tarea = db.query(models.Tarea).filter(models.Tarea.id == tarea_id).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    db.delete(tarea)
    db.commit()
    return {"status": "success", "mensaje": "Incidencia eliminada por el Owner"}


@app.post("/api/tareas/actualizar-estado")
async def api_actualizar_estado_kanban(request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    raw_id = payload.get("id") or payload.get("tarea_id")
    nuevo_estado = payload.get("estado") or payload.get("nuevo_estado")

    if raw_id is None or not nuevo_estado:
        raise HTTPException(status_code=400, detail="Faltan parámetros 'id' o 'estado'")

    try:
        tarea_id = int(raw_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="ID de incidencia inválido")

    tarea = db.query(models.Tarea).filter(models.Tarea.id == tarea_id).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    if usuario_actual and usuario_actual.rol == "Usuario" and tarea.asignado_id != usuario_actual.id:
        raise HTTPException(status_code=403, detail="Solo puedes actualizar el estado de tus propias actividades.")

    tarea.estado = nuevo_estado
    db.commit()
    return {"status": "success", "mensaje": "Estado de incidencia actualizado en SQLite"}


# --- ENDPOINTS Y MOTOR DE AUTOMATIZACIÓN DE CONFLUENCE CANVAS ---

def _obtener_contexto_vivo_canvas(
    db: Session,
    usuario_actual: models.Usuario,
    proyecto_id: Optional[int] = None,
) -> dict:
    """Construye los datos en tiempo real de proyectos, incidencias, bitácora y equipo para alimentar las macros y generadores automáticos de Confluence Canvas."""
    filtros = []
    params = {}

    if proyecto_id:
        filtros.append("proyecto_id = :proyecto_id")
        params["proyecto_id"] = proyecto_id

    if usuario_actual and usuario_actual.rol == "Usuario":
        filtros.append("asignado_id = :asignado_id")
        params["asignado_id"] = usuario_actual.id

    where_sql = ("WHERE " + " AND ".join(filtros)) if filtros else ""
    tareas = [
        dict(r)
        for r in db.execute(text(f"SELECT * FROM vista_proyectos_tareas {where_sql}"), params).mappings().all()
    ]

    total = len(tareas)
    por_hacer = sum(1 for t in tareas if t["estado"] == "Por-Hacer")
    en_curso = sum(1 for t in tareas if t["estado"] == "En-Curso")
    en_revision = sum(1 for t in tareas if t["estado"] == "Revision")
    finalizadas = sum(1 for t in tareas if t["estado"] == "Finalizado")
    horas_totales = round(sum(float(t.get("horas_registradas") or 0.0) for t in tareas), 1)
    progreso_pct = round((finalizadas / total) * 100) if total > 0 else 0

    ids_tareas_visibles = [t["id"] for t in tareas]
    bitacora = []
    if ids_tareas_visibles:
        mapa_claves = {t["id"]: t["clave_incidencia"] for t in tareas}
        mapa_titulos = {t["id"]: t["titulo"] for t in tareas}

        historial_reciente = (
            db.query(models.HistorialTarea)
            .filter(models.HistorialTarea.tarea_id.in_(ids_tareas_visibles))
            .order_by(models.HistorialTarea.id.desc())
            .limit(12)
            .all()
        )
        for h in historial_reciente:
            bitacora.append(
                {
                    "tipo": "historial",
                    "tarea_id": h.tarea_id,
                    "clave_incidencia": mapa_claves.get(h.tarea_id, f"ID-{h.tarea_id}"),
                    "titulo_tarea": mapa_titulos.get(h.tarea_id, ""),
                    "detalle": f"{h.campo_modificado}: {h.valor_anterior or '-'} → {h.valor_nuevo or '-'}",
                    "autor": "Trigger / Sistema",
                    "fecha": _formatear_fecha_hora(h.fecha_cambio),
                }
            )

        comentarios_recientes = (
            db.query(models.Comentario)
            .filter(models.Comentario.tarea_id.in_(ids_tareas_visibles))
            .order_by(models.Comentario.id.desc())
            .limit(10)
            .all()
        )
        for c in comentarios_recientes:
            bitacora.append(
                {
                    "tipo": "comentario",
                    "tarea_id": c.tarea_id,
                    "clave_incidencia": mapa_claves.get(c.tarea_id, f"ID-{c.tarea_id}"),
                    "titulo_tarea": mapa_titulos.get(c.tarea_id, ""),
                    "detalle": c.contenido,
                    "autor": c.autor,
                    "fecha": _formatear_fecha_hora(c.fecha_creacion),
                }
            )

    # Carga por integrante
    usuarios_q = db.query(models.Usuario)
    if usuario_actual and usuario_actual.rol == "Usuario":
        usuarios_q = usuarios_q.filter(models.Usuario.id == usuario_actual.id)
    usuarios_lista = usuarios_q.order_by(models.Usuario.id.asc()).all()

    equipo = []
    for u in usuarios_lista:
        tareas_u = [t for t in tareas if t.get("asignado_id") == u.id]
        equipo.append(
            {
                "id": u.id,
                "nombre": u.nombre,
                "rol": u.rol,
                "cargo": u.cargo or "Ingeniero de Red",
                "total": len(tareas_u),
                "pendientes": sum(1 for t in tareas_u if t["estado"] == "Por-Hacer"),
                "en_curso": sum(1 for t in tareas_u if t["estado"] in ("En-Curso", "Revision")),
                "finalizadas": sum(1 for t in tareas_u if t["estado"] == "Finalizado"),
                "horas": round(sum(float(t.get("horas_registradas") or 0.0) for t in tareas_u), 1),
            }
        )

    proyecto_obj = None
    if proyecto_id:
        proyecto_obj = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto_obj:
        proyecto_obj = db.query(models.Proyecto).first()

    return {
        "proyecto": {
            "id": proyecto_obj.id if proyecto_obj else None,
            "nombre": proyecto_obj.nombre if proyecto_obj else "Todos los Proyectos",
            "clave": proyecto_obj.clave_proyecto if proyecto_obj else "GLOBAL",
        },
        "kpis": {
            "total": total,
            "por_hacer": por_hacer,
            "en_curso": en_curso,
            "en_revision": en_revision,
            "finalizadas": finalizadas,
            "horas_totales": horas_totales,
            "progreso_pct": progreso_pct,
            "fecha_sincronizacion": _formatear_fecha_hora(datetime.now()),
        },
        "tareas": tareas,
        "bitacora": bitacora[:15],
        "equipo": equipo,
    }


def _generar_plantilla_automatizada(tipo: str, contexto: dict, autor_nombre: str) -> tuple[str, str, str, str]:
    """Genera título, categoría, ícono y contenido HTML con macros en vivo según el tipo de automatización."""
    proy_nombre = contexto["proyecto"]["nombre"]
    proy_clave = contexto["proyecto"]["clave"]
    kpis = contexto["kpis"]
    tareas = contexto["tareas"]
    fecha_sync = kpis["fecha_sincronizacion"]

    if tipo == "reporte_ejecutivo":
        titulo = f"Reporte Ejecutivo Automatizado — {proy_nombre} ({proy_clave})"
        categoria = "Reportes Automáticos"
        icono = "fa-chart-line"
        chips_claves = " ".join(
            f'<span class="jira-smart-link" data-issue-key="{t["clave_incidencia"]}">{t["clave_incidencia"]}</span>'
            for t in tareas[:6]
        ) or "Sin incidencias registradas"
        contenido = f"""
<div class="canvas-callout canvas-callout-info mb-3">
    <div class="fw-bold mb-1"><i class="fas fa-robot me-1 text-primary"></i> Reporte Ejecutivo Generado Automáticamente</div>
    <div class="small text-secondary">Sincronizado por <strong>{autor_nombre}</strong> el {fecha_sync}. Los bloques dinámicos se actualizan en tiempo real con la base de datos SQLite.</div>
</div>
<h5 class="fw-bold mb-2">1. Resumen de Estado e Indicadores Clave (KPIs)</h5>
<p class="text-secondary">El proyecto <strong>{proy_nombre}</strong> registra un avance global del <strong>{kpis["progreso_pct"]}%</strong> con un total de <strong>{kpis["horas_totales"]} horas</strong> técnicas documentadas sobre {kpis["total"]} incidencias activas ({chips_claves}).</p>
<div class="canvas-live-macro" data-canvas-macro="kpis"></div>
<h5 class="fw-bold mt-4 mb-2">2. Matriz en Vivo de Incidencias y Entregables</h5>
<div class="canvas-live-macro" data-canvas-macro="incidencias"></div>
<h5 class="fw-bold mt-4 mb-2">3. Acuerdos y Próximos Pasos</h5>
<ul class="canvas-checklist list-unstyled ps-1">
    <li><input type="checkbox" checked> Auditar incidencias en estado <em>En-Curso</em> y <em>Revisión</em> antes del cierre semanal.</li>
    <li><input type="checkbox"> Validar cumplimiento de SLA en tareas de prioridad <strong>Alta</strong>.</li>
    <li><input type="checkbox"> Actualizar bitácora de configuración tras cada ventana de cambio.</li>
</ul>
""".strip()
        return titulo, categoria, icono, contenido

    if tipo == "bitacora_cambios":
        titulo = f"Bitácora de Auditoría, Comentarios y Cambios — {proy_clave}"
        categoria = "Actas & Post-Mortems"
        icono = "fa-history"
        contenido = f"""
<div class="canvas-callout canvas-callout-warning mb-3">
    <div class="fw-bold mb-1"><i class="fas fa-bolt me-1 text-warning"></i> Trazabilidad Técnica Automatizada</div>
    <div class="small text-secondary">Este documento recopila automáticamente las transiciones del tablero Kanban, cambios de prioridad y últimos comentarios técnicos registrados en las incidencias.</div>
</div>
<h5 class="fw-bold mb-2">1. Flujo Reciente de Cambios y Comentarios</h5>
<div class="canvas-live-macro" data-canvas-macro="bitacora"></div>
<h5 class="fw-bold mt-4 mb-2">2. Estado Actual de Incidencias Auditadas</h5>
<div class="canvas-live-macro" data-canvas-macro="incidencias"></div>
""".strip()
        return titulo, categoria, icono, contenido

    if tipo == "runbook_componentes":
        titulo = f"Runbook Técnico por Componentes — {proy_nombre}"
        categoria = "Procedimientos / Runbooks"
        icono = "fa-book-medical"
        # Agrupar tareas por componente
        por_componente: dict[str, list] = {}
        for t in tareas:
            comp = t.get("componente") or "General"
            por_componente.setdefault(comp, []).append(t)

        bloques_comp = []
        for comp, lista_t in por_componente.items():
            items_html = "".join(
                f'<li><span class="jira-smart-link" data-issue-key="{t["clave_incidencia"]}">{t["clave_incidencia"]}</span> — <strong>{t["titulo"]}</strong> <em>({t["estado"]} · {t.get("asignado_nombre") or "Sin asignar"})</em></li>'
                for t in lista_t
            )
            bloques_comp.append(
                f'<div class="mb-3"><h6 class="fw-bold text-primary mb-1"><i class="fas fa-microchip me-1"></i> Componente: {comp} ({len(lista_t)})</h6><ul>{items_html}</ul></div>'
            )
        html_componentes = "\n".join(bloques_comp) or "<p class='text-muted'>No hay componentes registrados.</p>"

        contenido = f"""
<div class="canvas-callout canvas-callout-info mb-3">
    <div class="fw-bold mb-1"><i class="fas fa-cogs me-1 text-primary"></i> Catálogo Operativo por Componente</div>
    <div class="small text-secondary">Agrupación automática de actividades e intervenciones técnicas según el componente de infraestructura afectado.</div>
</div>
<h5 class="fw-bold mb-3">1. Desglose Operativo por Componente</h5>
{html_componentes}
<h5 class="fw-bold mt-4 mb-2">2. Indicadores de Ejecución en Vivo</h5>
<div class="canvas-live-macro" data-canvas-macro="kpis"></div>
""".strip()
        return titulo, categoria, icono, contenido

    # Default / matriz_carga_equipo
    titulo = f"Matriz de Carga Operativa y Responsables — {proy_clave}"
    categoria = "Reportes Automáticos"
    icono = "fa-users-cog"
    contenido = f"""
<div class="canvas-callout canvas-callout-info mb-3">
    <div class="fw-bold mb-1"><i class="fas fa-user-check me-1 text-primary"></i> Sincronización Automática de Capacidad y Roles</div>
    <div class="small text-secondary">Monitoreo en vivo de carga de trabajo, distribución por estado y horas registradas por integrante del equipo.</div>
</div>
<h5 class="fw-bold mb-2">1. Distribución de Carga por Especialista</h5>
<div class="canvas-live-macro" data-canvas-macro="equipo"></div>
<h5 class="fw-bold mt-4 mb-2">2. Detalle de Actividades Asignadas</h5>
<div class="canvas-live-macro" data-canvas-macro="incidencias"></div>
""".strip()
    return titulo, categoria, icono, contenido


def _serializar_documento_canvas(doc: models.DocumentoCanvas, incluir_versiones: bool = False) -> dict:
    data = {
        "id": doc.id,
        "titulo": doc.titulo,
        "categoria": doc.categoria,
        "icono": doc.icono or "fa-file-alt",
        "contenido": doc.contenido,
        "tipo_automatizacion": doc.tipo_automatizacion or "manual",
        "auto_sincronizar": bool(doc.auto_sincronizar),
        "version": doc.version or 1,
        "proyecto_id": doc.proyecto_id,
        "autor_id": doc.autor_id,
        "actualizado_por": doc.actualizado_por or "Abel Martinez",
        "fecha_creacion": _formatear_fecha_hora(doc.fecha_creacion),
        "fecha_actualizacion": _formatear_fecha_hora(doc.fecha_actualizacion),
    }
    if incluir_versiones:
        versiones_ordenadas = sorted(doc.versiones, key=lambda v: v.numero_version, reverse=True)
        data["versiones"] = [
            {
                "id": v.id,
                "numero_version": v.numero_version,
                "autor": v.autor,
                "resumen_cambio": v.resumen_cambio,
                "fecha_version": _formatear_fecha_hora(v.fecha_version),
            }
            for v in versiones_ordenadas
        ]
    return data


@app.get("/api/canvas")
def api_listar_canvas(
    request: Request,
    db: DbSession,
    proyecto_id: Optional[int] = None,
    usuario_id: Optional[int] = None,
):
    usuario_actual = _obtener_usuario_actual(request, db, usuario_id)
    query = db.query(models.DocumentoCanvas)
    if proyecto_id:
        query = query.filter(
            (models.DocumentoCanvas.proyecto_id == proyecto_id)
            | (models.DocumentoCanvas.proyecto_id.is_(None))
        )
    docs = query.order_by(models.DocumentoCanvas.id.asc()).all()
    contexto_vivo = _obtener_contexto_vivo_canvas(db, usuario_actual, proyecto_id)

    return {
        "documentos": [_serializar_documento_canvas(d, incluir_versiones=False) for d in docs],
        "contexto_vivo": contexto_vivo,
        "usuario_actual": _serializar_usuario(usuario_actual),
    }


@app.get("/api/canvas/{doc_id}")
def api_obtener_documento_canvas(
    doc_id: int,
    request: Request,
    db: DbSession,
    proyecto_id: Optional[int] = None,
    usuario_id: Optional[int] = None,
):
    usuario_actual = _obtener_usuario_actual(request, db, usuario_id)
    doc = db.query(models.DocumentoCanvas).filter(models.DocumentoCanvas.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento de Confluence no encontrado")

    proy_ctx = proyecto_id or doc.proyecto_id
    contexto_vivo = _obtener_contexto_vivo_canvas(db, usuario_actual, proy_ctx)
    return {
        "documento": _serializar_documento_canvas(doc, incluir_versiones=True),
        "contexto_vivo": contexto_vivo,
        "usuario_actual": _serializar_usuario(usuario_actual),
    }


@app.post("/api/canvas")
async def api_crear_documento_canvas(request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    titulo = str(payload.get("titulo") or "Nueva Página de Confluence").strip()
    categoria = str(payload.get("categoria") or "Arquitectura & Red").strip()
    icono = str(payload.get("icono") or "fa-file-alt").strip()
    contenido = str(payload.get("contenido") or "").strip()
    tipo_auto = str(payload.get("tipo_automatizacion") or "manual").strip()
    auto_sync = 1 if payload.get("auto_sincronizar", True) else 0

    raw_proy = payload.get("proyecto_id")
    proy_id = int(raw_proy) if raw_proy and str(raw_proy).strip().isdigit() else None
    if not proy_id:
        primer_proy = db.query(models.Proyecto).first()
        proy_id = primer_proy.id if primer_proy else None

    if not contenido:
        contenido = """
<h5 class="fw-bold mb-2">Resumen del Documento</h5>
<p class="text-secondary">Escribe aquí la documentación técnica o inserta macros automáticas desde la barra superior para mostrar métricas e incidencias en vivo.</p>
<div class="canvas-live-macro" data-canvas-macro="kpis"></div>
""".strip()

    autor_nombre = usuario_actual.nombre if usuario_actual else "Abel Martinez"
    nuevo_doc = models.DocumentoCanvas(
        titulo=titulo,
        categoria=categoria,
        icono=icono,
        contenido=contenido,
        tipo_automatizacion=tipo_auto,
        auto_sincronizar=auto_sync,
        version=1,
        proyecto_id=proy_id,
        autor_id=usuario_actual.id if usuario_actual else 1,
        actualizado_por=autor_nombre,
    )
    db.add(nuevo_doc)
    db.flush()
    db.add(
        models.VersionDocumentoCanvas(
            documento_id=nuevo_doc.id,
            numero_version=1,
            autor=autor_nombre,
            resumen_cambio="Creación de página",
            contenido_snapshot=nuevo_doc.contenido,
        )
    )
    db.commit()
    db.refresh(nuevo_doc)
    return {"status": "success", "documento": _serializar_documento_canvas(nuevo_doc, incluir_versiones=True)}


@app.post("/api/canvas/autogenerar")
async def api_autogenerar_documento_canvas(request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    tipo = str(payload.get("tipo") or "reporte_ejecutivo").strip()
    raw_proy = payload.get("proyecto_id")
    proy_id = int(raw_proy) if raw_proy and str(raw_proy).strip().isdigit() else None
    if not proy_id:
        primer_proy = db.query(models.Proyecto).first()
        proy_id = primer_proy.id if primer_proy else None

    autor_nombre = usuario_actual.nombre if usuario_actual else "Abel Martinez"
    contexto = _obtener_contexto_vivo_canvas(db, usuario_actual, proy_id)
    titulo, categoria, icono, contenido = _generar_plantilla_automatizada(tipo, contexto, autor_nombre)

    nuevo_doc = models.DocumentoCanvas(
        titulo=titulo,
        categoria=categoria,
        icono=icono,
        contenido=contenido,
        tipo_automatizacion=tipo,
        auto_sincronizar=1,
        version=1,
        proyecto_id=proy_id,
        autor_id=usuario_actual.id if usuario_actual else 1,
        actualizado_por=autor_nombre,
    )
    db.add(nuevo_doc)
    db.flush()
    db.add(
        models.VersionDocumentoCanvas(
            documento_id=nuevo_doc.id,
            numero_version=1,
            autor=autor_nombre,
            resumen_cambio=f"Generación automatizada ({tipo})",
            contenido_snapshot=nuevo_doc.contenido,
        )
    )
    db.commit()
    db.refresh(nuevo_doc)
    return {
        "status": "success",
        "documento": _serializar_documento_canvas(nuevo_doc, incluir_versiones=True),
        "contexto_vivo": contexto,
    }


@app.put("/api/canvas/{doc_id}")
async def api_actualizar_documento_canvas(doc_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    doc = db.query(models.DocumentoCanvas).filter(models.DocumentoCanvas.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    if "titulo" in payload and str(payload["titulo"]).strip():
        doc.titulo = str(payload["titulo"]).strip()
    if "categoria" in payload and str(payload["categoria"]).strip():
        doc.categoria = str(payload["categoria"]).strip()
    if "icono" in payload and str(payload["icono"]).strip():
        doc.icono = str(payload["icono"]).strip()
    if "contenido" in payload:
        doc.contenido = str(payload["contenido"])
    if "auto_sincronizar" in payload:
        doc.auto_sincronizar = 1 if payload["auto_sincronizar"] else 0

    autor_nombre = usuario_actual.nombre if usuario_actual else "Abel Martinez"
    doc.actualizado_por = autor_nombre
    doc.fecha_actualizacion = datetime.now(timezone.utc)

    crear_version = bool(payload.get("crear_version", True))
    if crear_version:
        doc.version = (doc.version or 1) + 1
        resumen = str(payload.get("resumen_cambio") or "Actualización de contenido").strip()
        db.add(
            models.VersionDocumentoCanvas(
                documento_id=doc.id,
                numero_version=doc.version,
                autor=autor_nombre,
                resumen_cambio=resumen,
                contenido_snapshot=doc.contenido,
            )
        )

    db.commit()
    db.refresh(doc)
    return {"status": "success", "documento": _serializar_documento_canvas(doc, incluir_versiones=True)}


@app.post("/api/canvas/{doc_id}/sincronizar")
async def api_sincronizar_documento_canvas(doc_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    doc = db.query(models.DocumentoCanvas).filter(models.DocumentoCanvas.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    proy_id_param = request.query_params.get("proyecto_id")
    proy_id = int(proy_id_param) if proy_id_param and proy_id_param.isdigit() else doc.proyecto_id
    contexto = _obtener_contexto_vivo_canvas(db, usuario_actual, proy_id)
    autor_nombre = usuario_actual.nombre if usuario_actual else "Abel Martinez"

    if doc.tipo_automatizacion and doc.tipo_automatizacion != "manual":
        _, _, _, nuevo_html = _generar_plantilla_automatizada(doc.tipo_automatizacion, contexto, autor_nombre)
        doc.contenido = nuevo_html

    doc.actualizado_por = autor_nombre
    doc.fecha_actualizacion = datetime.now(timezone.utc)
    doc.version = (doc.version or 1) + 1
    db.add(
        models.VersionDocumentoCanvas(
            documento_id=doc.id,
            numero_version=doc.version,
            autor=autor_nombre,
            resumen_cambio="Sincronización automática con datos en vivo de Jira",
            contenido_snapshot=doc.contenido,
        )
    )
    db.commit()
    db.refresh(doc)
    return {
        "status": "success",
        "documento": _serializar_documento_canvas(doc, incluir_versiones=True),
        "contexto_vivo": contexto,
    }


@app.post("/api/canvas/{doc_id}/restaurar/{version_id}")
def api_restaurar_version_canvas(doc_id: int, version_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    doc = db.query(models.DocumentoCanvas).filter(models.DocumentoCanvas.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    ver = (
        db.query(models.VersionDocumentoCanvas)
        .filter(
            models.VersionDocumentoCanvas.id == version_id,
            models.VersionDocumentoCanvas.documento_id == doc_id,
        )
        .first()
    )
    if not ver:
        raise HTTPException(status_code=404, detail="Versión no encontrada")

    autor_nombre = usuario_actual.nombre if usuario_actual else "Abel Martinez"
    doc.contenido = ver.contenido_snapshot
    doc.actualizado_por = autor_nombre
    doc.fecha_actualizacion = datetime.now(timezone.utc)
    doc.version = (doc.version or 1) + 1
    db.add(
        models.VersionDocumentoCanvas(
            documento_id=doc.id,
            numero_version=doc.version,
            autor=autor_nombre,
            resumen_cambio=f"Restaurado desde versión v{ver.numero_version}",
            contenido_snapshot=doc.contenido,
        )
    )
    db.commit()
    db.refresh(doc)
    return {"status": "success", "documento": _serializar_documento_canvas(doc, incluir_versiones=True)}


@app.delete("/api/canvas/{doc_id}")
def api_eliminar_documento_canvas(doc_id: int, request: Request, db: DbSession):
    usuario_actual = _obtener_usuario_actual(request, db)
    if usuario_actual.rol != "Owner":
        raise HTTPException(
            status_code=403,
            detail="Privilegio insuficiente: Solo el rol Owner puede eliminar páginas de Confluence Canvas.",
        )

    doc = db.query(models.DocumentoCanvas).filter(models.DocumentoCanvas.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    db.delete(doc)
    db.commit()
    return {"status": "success", "mensaje": "Página eliminada por el Owner"}

