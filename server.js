const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

app.get('/api/estado', (req, res) => {
  res.json({
    mensaje: 'El servidor está funcionando',
    hora: new Date().toISOString()
  });
});

function requiereSesion(req, res, next) {
  const token = req.cookies.sesion;

  if (!token) {
    res.status(401).json({ error: 'No has iniciado sesión.' });
    return;
  }

  const sesion = db.prepare(`
    SELECT sesiones.token, usuarios.id, usuarios.cedula, usuarios.rol, usuarios.persona_id, usuarios.activo AS usuario_activo
    FROM sesiones
    JOIN usuarios ON usuarios.id = sesiones.usuario_id
    WHERE sesiones.token = ?
  `).get(token);

  if (!sesion || sesion.usuario_activo !== 1) {
    res.status(401).json({ error: 'Sesión no válida.' });
    return;
  }

  req.usuario = sesion;
  next();
}

function requiereRol(rolesPermitidos) {
  return function (req, res, next) {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      return;
    }
    next();
  };
}

function puedeVerGrupo(grupoId, usuario) {
  if (usuario.rol === 'Administrador' || usuario.rol === 'Pastor') {
    return true;
  }

  if (usuario.rol === 'Líder de Grupo') {
    if (!usuario.persona_id) return false;

    const pertenencia = db.prepare(`
      SELECT id FROM persona_grupo
      WHERE persona_id = ? AND grupo_id = ? AND rol = 'Líder' AND activo = 1
    `).get(usuario.persona_id, grupoId);

    return !!pertenencia;
  }

  return true;
}

app.post('/api/login', (req, res) => {
  const cedula = req.body.cedula;
  const contrasena = req.body.contrasena;

  if (!cedula || !contrasena) {
    res.status(400).json({ error: 'La cédula y la contraseña son obligatorias.' });
    return;
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE cedula = ?').get(cedula);

  if (!usuario || usuario.activo !== 1 || !bcrypt.compareSync(contrasena, usuario.password_hash)) {
    res.status(401).json({ error: 'Cédula o contraseña incorrecta.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)').run(token, usuario.id);

  res.cookie('sesion', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ id: usuario.id, cedula: usuario.cedula, rol: usuario.rol });
});

app.get('/api/me', requiereSesion, (req, res) => {
  res.json({ id: req.usuario.id, cedula: req.usuario.cedula, rol: req.usuario.rol });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.sesion;
  if (token) {
    db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
  }
  res.clearCookie('sesion');
  res.json({ mensaje: 'Sesión cerrada.' });
});

app.get('/api/redes', requiereSesion, (req, res) => {
  const redes = db.prepare('SELECT * FROM redes ORDER BY nombre').all();
  res.json(redes);
});

app.get('/api/grupos', requiereSesion, (req, res) => {
  const grupos = db.prepare(`
    SELECT grupos.*, redes.nombre AS red
    FROM grupos
    JOIN redes ON redes.id = grupos.red_id
    ORDER BY grupos.nombre
  `).all();
  res.json(grupos);
});

app.get('/api/redes/:id/grupos', requiereSesion, (req, res) => {
  const redId = Number(req.params.id);

  const grupos = db.prepare(`
    SELECT grupos.*, redes.nombre AS red
    FROM grupos
    JOIN redes ON redes.id = grupos.red_id
    WHERE grupos.red_id = ?
    ORDER BY grupos.nombre
  `).all(redId);

  res.json(grupos);
});

app.get('/api/grupos/:id/integrantes', requiereSesion, (req, res) => {
  const grupoId = Number(req.params.id);

  if (!puedeVerGrupo(grupoId, req.usuario)) {
    res.status(403).json({ error: 'No puedes consultar este grupo.' });
    return;
  }

  const integrantes = db.prepare(`
    SELECT personas.id, personas.nombre_completo, personas.celular, persona_grupo.rol
    FROM persona_grupo
    JOIN personas ON personas.id = persona_grupo.persona_id
    WHERE persona_grupo.grupo_id = ?
      AND persona_grupo.activo = 1
    ORDER BY
      CASE persona_grupo.rol
        WHEN 'Líder' THEN 1
        WHEN 'Apoyo' THEN 2
        WHEN 'Anfitrión' THEN 3
        WHEN 'Integrante' THEN 4
      END,
      personas.nombre_completo
  `).all(grupoId);

  res.json(integrantes);
});

app.get('/api/personas', (req, res) => {
  const personas = db.prepare('SELECT * FROM personas ORDER BY nombre_completo').all();
  res.json(personas);
});

const rolesValidos = ['Líder', 'Apoyo', 'Anfitrión', 'Integrante'];

app.post('/api/grupos/:id/integrantes', requiereSesion, requiereRol(['Administrador', 'Líder de Grupo']), (req, res) => {
  const grupoId = Number(req.params.id);

  if (req.usuario.rol !== 'Administrador') {
    if (!puedeVerGrupo(grupoId, req.usuario)) {
      res.status(403).json({ error: 'Solo puedes registrar integrantes en tus propios grupos.' });
      return;
    }
  }

  const nombre = req.body.nombre;
  const celular = req.body.celular || null;
  const rol = req.body.rol;

  if (!nombre || !rol) {
    res.status(400).json({ error: 'El nombre y el rol son obligatorios.' });
    return;
  }

  if (!rolesValidos.includes(rol)) {
    res.status(400).json({ error: 'El rol no es válido.' });
    return;
  }

  const insertarPersona = db.prepare(
    'INSERT INTO personas (nombre_completo, celular) VALUES (?, ?)'
  );
  const insertarPertenencia = db.prepare(
    'INSERT INTO persona_grupo (persona_id, grupo_id, rol, fecha_inicio, activo) VALUES (?, ?, ?, ?, 1)'
  );

  const crearIntegrante = db.transaction(() => {
    const resultado = insertarPersona.run(nombre, celular);
    const personaId = Number(resultado.lastInsertRowid);
    const hoy = new Date().toISOString().slice(0, 10);
    insertarPertenencia.run(personaId, grupoId, rol, hoy);
    return personaId;
  });

  const personaId = crearIntegrante();

  res.status(201).json({ id: personaId, nombre, celular, rol });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});