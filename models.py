# models.py
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, event, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    fecha_registro = Column(DateTime, server_default=func.now())

class Proyecto(Base):
    __tablename__ = "proyectos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String, nullable=False)
    clave_proyecto = Column(String, unique=True, nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime, server_default=func.now())

class Tarea(Base):
    __tablename__ = "tareas"
    id = Column(Integer, primary_key=True, autoincrement=True)
    clave_incidencia = Column(String, unique=True, nullable=False)
    titulo = Column(String, nullable=False)
    descripcion = Column(Text, nullable=True)
    estado = Column(String, default="Por-Hacer")  # Por-Hacer, En-Curso, Revision, Finalizado
    prioridad = Column(String, default="Media")    # Alta, Media, Baja
    componente = Column(String, nullable=True)     # Red, Seguridad, etc.
    horas_registradas = Column(Integer, default=0)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False)
    asignado_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    proyecto = relationship("Proyecto")
    asignado = relationship("Usuario")

class HistorialTarea(Base):
    __tablename__ = "historial_tareas"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tarea_id = Column(Integer, ForeignKey("tareas.id", ondelete="CASCADE"), nullable=False)
    campo_modificado = Column(String, nullable=False)
    valor_anterior = Column(String, nullable=True)
    valor_nuevo = Column(String, nullable=True)
    fecha_cambio = Column(DateTime, server_default=func.now())

# --- Automatización de Vistas e Historial mediante Triggers nativos de SQLite ---
@event.listens_for(Base.metadata, "after_create")
def crear_vistas_y_triggers(target, connection, **kw):
    # Definición de estructuras SQL en texto crudo
    vista_proyectos_tareas = """
    CREATE VIEW IF NOT EXISTS vista_proyectos_tareas AS
    SELECT t.id, t.clave_incidencia, t.titulo, t.estado, t.prioridad, t.componente, t.horas_registradas, p.nombre AS proyecto_nombre
    FROM tareas t JOIN proyectos p ON t.proyecto_id = p.id;
    """
    
    vista_calendario_tareas = """
    CREATE VIEW IF NOT EXISTS vista_calendario_tareas AS
    SELECT id, clave_incidencia AS id_str, titulo, estado, prioridad
    FROM tareas;
    """
    
    vista_reporte_carga_trabajo = """
    CREATE VIEW IF NOT EXISTS vista_reporte_carga_trabajo AS
    SELECT u.nombre AS usuario_nombre,
           SUM(CASE WHEN t.estado = 'Por-Hacer' THEN 1 ELSE 0 END) AS tareas_pendientes,
           SUM(CASE WHEN t.estado = 'En-Curso' THEN 1 ELSE 0 END) AS tareas_en_progreso,
           SUM(CASE WHEN t.estado = 'Finalizado' THEN 1 ELSE 0 END) AS tareas_completadas
    FROM usuarios u
    LEFT JOIN tareas t ON u.id = t.asignado_id
    GROUP BY u.id;
    """
    
    trigger_auditoria_estado = """
    CREATE TRIGGER IF NOT EXISTS t_auditoria_estado_tarea
    AFTER UPDATE OF estado ON tareas
    BEGIN
        INSERT INTO historial_tareas(tarea_id, campo_modificado, valor_anterior, valor_nuevo)
        VALUES(OLD.id, 'estado', OLD.estado, NEW.estado);
    END;
    """
    
    # Envoltura explícita usando text() requerida por SQLAlchemy 2.0
    connection.execute(text(vista_proyectos_tareas))
    connection.execute(text(vista_calendario_tareas))
    connection.execute(text(vista_reporte_carga_trabajo))
    connection.execute(text(trigger_auditoria_estado))
