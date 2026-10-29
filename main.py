from fastapi import FastAPI, Depends, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import text
import models
from database import engine, get_db

app = FastAPI(title="Jira Software Suite")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.on_event("startup")
def inicializar_datos():
    models.Base.metadata.create_all(bind=engine)
    db = next(get_db())
    
    if db.query(models.Usuario).count() == 0:
        admin = models.Usuario(nombre="Abel Martinez", email="abel@jira.com")
        dev1 = models.Usuario(nombre="Tomas Lopez", email="tomas@jira.com")
        db.add_all([admin, dev1])
        db.commit()
        
        proy = models.Proyecto(nombre="IT Network & Systems (DANA)", clave="NET")
        db.add(proy)
        db.commit()
        
        t1 = models.Tarea(proyecto_id=proy.id, clave_incidencia="NET-101", titulo="Auditoría de switches y enlaces planta Escobedo", estado="En-Curso", prioridad="Alta", componente="Switching", horas_registradas=3.5, fecha_limite=models.datetime.datetime(2026, 10, 7))
        t2 = models.Tarea(proyecto_id=proy.id, clave_incidencia="NET-102", titulo="Configuración de gateway de respaldo VPN", estado="Por-Hacer", prioridad="Alta", componente="VPN/Firewall", horas_registradas=0.0, fecha_limite=models.datetime.datetime(2026, 10, 19))
        t3 = models.Tarea(proyecto_id=proy.id, clave_incidencia="NET-104", titulo="Inventario de direcciones IP estáticas", estado="Finalizado", prioridad="Baja", componente="Inventario", horas_registradas=3.0, fecha_limite=models.datetime.datetime(2026, 10, 20))
        db.add_all([t1, t2, t3])
        db.commit()
    db.close()

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("pages/dashboard.html", {"request": request})

@app.get("/kanban", response_class=HTMLResponse)
def view_kanban(request: Request):
    return templates.TemplateResponse("pages/kanban.html", {"request": request})

@app.get("/incidencias", response_class=HTMLResponse)
def view_incidencias(request: Request):
    return templates.TemplateResponse("pages/incidencias.html", {"request": request})

@app.get("/calendario", response_class=HTMLResponse)
def view_calendario(request: Request):
    return templates.TemplateResponse("pages/calendario.html", {"request": request})

@app.get("/weekly", response_class=HTMLResponse)
def view_weekly(request: Request):
    return templates.TemplateResponse("pages/weekly.html", {"request": request})

@app.get("/canvas", response_class=HTMLResponse)
def view_canvas(request: Request):
    return templates.TemplateResponse("pages/canvas.html", {"request": request})

# Endpoints de la API JSON
@app.get("/api/reportes/carga")
def api_reporte_carga(db: Session = Depends(get_db)):
    return db.execute(text("SELECT * FROM vista_reporte_carga_trabajo")).mappings().all()

@app.get("/api/tareas")
@app.get("/api/tareas/json")
def api_listar_tareas(db: Session = Depends(get_db)):
    return db.execute(text("SELECT * FROM vista_proyectos_tareas")).mappings().all()

@app.get("/api/tareas/calendario")
def api_calendario_tareas(db: Session = Depends(get_db)):
    return db.execute(text("SELECT * FROM vista_calendario_tareas")).mappings().all()

@app.post("/api/proyectos")
def crear_proyecto(nombre: str = Form(...), clave: str = Form(...), db: Session = Depends(get_db)):
    nuevo = models.Proyecto(nombre=nombre, clave=clave.upper())
    db.add(nuevo)
    db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/api/tareas/actualizar-estado")
def actualizar_estado_tarea(id: int = Form(...), estado: str = Form(...), db: Session = Depends(get_db)):
    tarea = db.query(models.Tarea).filter(models.Tarea.id == id).first()
    if tarea:
        tarea.estado = estado
        db.commit()
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Tarea no encontrada")
