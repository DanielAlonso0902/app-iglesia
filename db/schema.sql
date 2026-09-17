CREATE TABLE IF NOT EXISTS redes (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL
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
  FOREIGN KEY (red_id) REFERENCES redes(id)
);

CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
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
  rol TEXT NOT NULL CHECK (rol IN ('Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo')),
  persona_id INTEGER,
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