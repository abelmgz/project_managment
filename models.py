from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
    text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utc_now():
    return datetime.now(timezone.utc)


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    rol = Column(String, nullable=False, default="Usuario")  # Owner, Administrador, Usuario
    permisos = Column(String, nullable=False, default="ver_propias,crear_propias,comentar")
    cargo = Column(String, nullable=True, default="Ingeniero de Red")
    fecha_registro = Column(DateTime, default=utc_now)

    tareas = relationship("Tarea", back_populates="asignado")


class Proyecto(Base):
    __tablename__ = "proyectos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String, nullable=False)
    clave_proyecto = Column(String, unique=True, nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime, default=utc_now)

    tareas = relationship("Tarea", back_populates="proyecto", cascade="all, delete-orphan")


class Tarea(Base):
    __tablename__ = "tareas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clave_incidencia = Column(String, unique=True, nullable=False)
    titulo = Column(String, nullable=False)
    descripcion = Column(Text, nullable=True)
    estado = Column(String, default="Por-Hacer")  # Por-Hacer, En-Curso, Revision, Finalizado
    prioridad = Column(String, default="Media")   # Alta, Media, Baja
    componente = Column(String, nullable=True)     # VPN/Firewall, Switching, Wi-Fi, Inventario
    horas_registradas = Column(Float, default=0.0)
    fecha_creacion = Column(DateTime, default=utc_now)
    fecha_limite = Column(DateTime, nullable=True)

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False)
    asignado_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    proyecto = relationship("Proyecto", back_populates="tareas")
    asignado = relationship("Usuario", back_populates="tareas")
    comentarios = relationship("Comentario", back_populates="tarea", cascade="all, delete-orphan")
    historial = relationship("HistorialTarea", back_populates="tarea", cascade="all, delete-orphan")


class Comentario(Base):
    __tablename__ = "comentarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tarea_id = Column(Integer, ForeignKey("tareas.id", ondelete="CASCADE"), nullable=False)
    autor = Column(String, nullable=False, default="Abel Martinez")
    contenido = Column(Text, nullable=False)
    fecha_creacion = Column(DateTime, default=utc_now)

    tarea = relationship("Tarea", back_populates="comentarios")


class HistorialTarea(Base):
    __tablename__ = "historial_tareas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tarea_id = Column(Integer, ForeignKey("tareas.id", ondelete="CASCADE"), nullable=False)
    campo_modificado = Column(String, nullable=False)
    valor_anterior = Column(Text, nullable=True)
    valor_nuevo = Column(Text, nullable=True)
    fecha_cambio = Column(DateTime, default=utc_now)

    tarea = relationship("Tarea", back_populates="historial")


class DocumentoCanvas(Base):
    __tablename__ = "documentos_canvas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    titulo = Column(String, nullable=False)
    categoria = Column(String, nullable=False, default="Arquitectura & Red")
    icono = Column(String, nullable=False, default="fa-file-alt")
    contenido = Column(Text, nullable=False, default="")
    tipo_automatizacion = Column(String, nullable=False, default="manual")  # manual, reporte_ejecutivo, bitacora_cambios, runbook_componentes, matriz_carga_equipo
    auto_sincronizar = Column(Integer, nullable=False, default=1)  # 1 = activo, 0 = manual
    version = Column(Integer, nullable=False, default=1)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=True)
    autor_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    actualizado_por = Column(String, nullable=False, default="Abel Martinez")
    fecha_creacion = Column(DateTime, default=utc_now)
    fecha_actualizacion = Column(DateTime, default=utc_now)

    versiones = relationship(
        "VersionDocumentoCanvas",
        back_populates="documento",
        cascade="all, delete-orphan",
    )


class VersionDocumentoCanvas(Base):
    __tablename__ = "versiones_documento_canvas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    documento_id = Column(Integer, ForeignKey("documentos_canvas.id", ondelete="CASCADE"), nullable=False)
    numero_version = Column(Integer, nullable=False, default=1)
    autor = Column(String, nullable=False, default="Abel Martinez")
    resumen_cambio = Column(String, nullable=False, default="Versión inicial")
    contenido_snapshot = Column(Text, nullable=False, default="")
    fecha_version = Column(DateTime, default=utc_now)

    documento = relationship("DocumentoCanvas", back_populates="versiones")



# --- Automatización de Infraestructura Relacional con SQLAlchemy 2.0 (text) ---
@event.listens_for(Base.metadata, "after_create")
def crear_vistas_y_triggers(target, connection, **kw):
    # Migración segura de columnas en tabla 'usuarios' para bases SQLite existentes
    columnas_usuarios = [
        fila[1] for fila in connection.execute(text("PRAGMA table_info(usuarios);")).fetchall()
    ]
    if "rol" not in columnas_usuarios:
        connection.execute(text("ALTER TABLE usuarios ADD COLUMN rol VARCHAR NOT NULL DEFAULT 'Usuario';"))
    if "permisos" not in columnas_usuarios:
        connection.execute(
            text("ALTER TABLE usuarios ADD COLUMN permisos VARCHAR NOT NULL DEFAULT 'ver_propias,crear_propias,comentar';")
        )
    if "cargo" not in columnas_usuarios:
        connection.execute(text("ALTER TABLE usuarios ADD COLUMN cargo VARCHAR DEFAULT 'Ingeniero de Red';"))

    # 1. Vista unificada de incidencias, proyectos y usuario asignado
    connection.execute(text("DROP VIEW IF EXISTS vista_proyectos_tareas;"))
    connection.execute(text("""
    CREATE VIEW vista_proyectos_tareas AS
    SELECT t.id,
           t.clave_incidencia,
           t.titulo,
           t.descripcion,
           t.estado,
           t.prioridad,
           t.componente,
           t.horas_registradas,
           strftime('%Y-%m-%d', t.fecha_creacion) AS fecha_creacion,
           strftime('%Y-%m-%d', COALESCE(t.fecha_limite, t.fecha_creacion)) AS fecha_calendario,
           strftime('%Y-%m-%d', t.fecha_limite) AS fecha_limite,
           t.proyecto_id,
           p.nombre AS proyecto_nombre,
           p.clave_proyecto AS proyecto_clave,
           t.asignado_id,
           u.nombre AS asignado_nombre,
           u.rol AS asignado_rol
    FROM tareas t
    JOIN proyectos p ON t.proyecto_id = p.id
    LEFT JOIN usuarios u ON t.asignado_id = u.id
    ORDER BY t.id DESC;
    """))

    # 2. Vista analítica para reportes de carga de trabajo (incluyendo estado 'Revision')
    connection.execute(text("DROP VIEW IF EXISTS vista_reporte_carga_trabajo;"))
    connection.execute(text("""
    CREATE VIEW vista_reporte_carga_trabajo AS
    SELECT u.id AS usuario_id,
           u.nombre AS usuario_nombre,
           u.rol AS usuario_rol,
           COALESCE(SUM(CASE WHEN t.estado = 'Por-Hacer' THEN 1 ELSE 0 END), 0) AS tareas_pendientes,
           COALESCE(SUM(CASE WHEN t.estado = 'En-Curso' THEN 1 ELSE 0 END), 0) AS tareas_en_progreso,
           COALESCE(SUM(CASE WHEN t.estado = 'Revision' THEN 1 ELSE 0 END), 0) AS tareas_en_revision,
           COALESCE(SUM(CASE WHEN t.estado = 'Finalizado' THEN 1 ELSE 0 END), 0) AS tareas_completadas
    FROM usuarios u
    LEFT JOIN tareas t ON u.id = t.asignado_id
    GROUP BY u.id;
    """))

    # 3. Vista formateada para el calendario de hitos
    connection.execute(text("DROP VIEW IF EXISTS vista_calendario_tareas;"))
    connection.execute(text("""
    CREATE VIEW vista_calendario_tareas AS
    SELECT t.id,
           t.clave_incidencia,
           t.titulo,
           t.descripcion,
           t.clave_incidencia || ' ' || t.titulo AS title,
           strftime('%Y-%m-%d', COALESCE(t.fecha_limite, t.fecha_creacion)) AS start,
           t.estado,
           t.prioridad,
           t.componente,
           t.horas_registradas,
           t.proyecto_id,
           p.nombre AS proyecto_nombre,
           t.asignado_id,
           u.nombre AS asignado_nombre
    FROM tareas t
    JOIN proyectos p ON t.proyecto_id = p.id
    LEFT JOIN usuarios u ON t.asignado_id = u.id;
    """))

    # 4. Trigger automatizado para cambios de estado Kanban
    connection.execute(text("""
    CREATE TRIGGER IF NOT EXISTS trigger_auditoria_estado
    AFTER UPDATE OF estado ON tareas
    WHEN OLD.estado IS NOT NEW.estado
    BEGIN
        INSERT INTO historial_tareas(tarea_id, campo_modificado, valor_anterior, valor_nuevo, fecha_cambio)
        VALUES(OLD.id, 'Estado', OLD.estado, NEW.estado, CURRENT_TIMESTAMP);
    END;
    """))

    # 5. Trigger automatizado para cambios de prioridad
    connection.execute(text("""
    CREATE TRIGGER IF NOT EXISTS trigger_auditoria_prioridad
    AFTER UPDATE OF prioridad ON tareas
    WHEN OLD.prioridad IS NOT NEW.prioridad
    BEGIN
        INSERT INTO historial_tareas(tarea_id, campo_modificado, valor_anterior, valor_nuevo, fecha_cambio)
        VALUES(OLD.id, 'Prioridad', OLD.prioridad, NEW.prioridad, CURRENT_TIMESTAMP);
    END;
    """))
