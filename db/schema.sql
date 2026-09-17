CREATE TABLE IF NOT EXISTS redes (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS grupos (
  id INTEGER PRIMARY KEY,
  red_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  dia_habitual TEXT,
  hora_habitual TEXT,
  duracion_habitual TEXT,
  direccion TEXT,
  barrio TEXT,
  ciudad TEXT,
  referencia TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (red_id) REFERENCES redes(id)
);

CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  cedula TEXT,
  fecha_nacimiento TEXT,
  sexo TEXT,
  celular TEXT,
  direccion TEXT,
  barrio TEXT,
  ciudad TEXT,
  estado_civil TEXT,
  fecha_llegada_grupo TEXT,
  bautizado INTEGER NOT NULL DEFAULT 0,
  fecha_bautismo TEXT,
  es_nuevo INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  observaciones TEXT
);

CREATE TABLE IF NOT EXISTS persona_red (
  id INTEGER PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  red_id INTEGER NOT NULL,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (persona_id) REFERENCES personas(id),
  FOREIGN KEY (red_id) REFERENCES redes(id)
);

CREATE TABLE IF NOT EXISTS persona_grupo (
  id INTEGER PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  grupo_id INTEGER NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('Líder', 'Apoyo', 'Anfitrión', 'Integrante')),
  fecha_inicio TEXT,
  fecha_fin TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (persona_id) REFERENCES personas(id),
  FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  cedula TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo', 'Miembro')),
  persona_id INTEGER UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
);

CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS reuniones (
  id INTEGER PRIMARY KEY,
  grupo_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Grupo habitual' CHECK (tipo IN ('Grupo habitual', 'Servicio de red', 'Actividad especial', 'Reunión cancelada')),
  realizada INTEGER NOT NULL DEFAULT 1,
  duracion TEXT,
  observacion TEXT,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

CREATE TABLE IF NOT EXISTS asistencia_reunion (
  id INTEGER PRIMARY KEY,
  reunion_id INTEGER NOT NULL,
  persona_id INTEGER NOT NULL,
  asistio INTEGER NOT NULL DEFAULT 1,
  UNIQUE (reunion_id, persona_id),
  FOREIGN KEY (reunion_id) REFERENCES reuniones(id),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
);

CREATE TABLE IF NOT EXISTS visitantes (
  id INTEGER PRIMARY KEY,
  reunion_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  observacion TEXT,
  FOREIGN KEY (reunion_id) REFERENCES reuniones(id)
);

CREATE TABLE IF NOT EXISTS proceso_formacion (
  id INTEGER PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  etapa TEXT NOT NULL CHECK (etapa IN ('Discípulo S1', 'Discípulo S2', 'Discípulo S3', 'Discípulo S4', 'Bendición N1', 'Bendición N2', 'Bendición N3', 'Ministerio de la Misericordia')),
  promedio REAL,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (persona_id, etapa),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS unico_activo_formacion
  ON proceso_formacion (persona_id)
  WHERE activo = 1;