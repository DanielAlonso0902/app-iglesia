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

app.get('/api/personas', requiereSesion, (req, res) => {
  const q = (req.query.q || '').trim();
  const busqueda = '%' + q + '%';

  let personas;
  if (q) {
    personas = db.prepare(`
      SELECT p.id, p.nombre_completo, p.celular, p.activo AS persona_activo, u.cedula
      FROM personas p
      LEFT JOIN usuarios u ON u.persona_id = p.id
      WHERE p.nombre_completo LIKE ? OR p.celular LIKE ? OR u.cedula LIKE ?
      ORDER BY p.nombre_completo
      LIMIT 50
    `).all(busqueda, busqueda, busqueda);
  } else {
    personas = db.prepare(`
      SELECT p.id, p.nombre_completo, p.celular, p.activo AS persona_activo, u.cedula
      FROM personas p
      LEFT JOIN usuarios u ON u.persona_id = p.id
      ORDER BY p.nombre_completo
      LIMIT 50
    `).all();
  }

  for (const persona of personas) {
    persona.grupos = db.prepare(`
      SELECT g.nombre, pg.rol
      FROM persona_grupo pg
      JOIN grupos g ON g.id = pg.grupo_id
      WHERE pg.persona_id = ? AND pg.activo = 1
      ORDER BY g.nombre
    `).all(persona.id);
  }

  res.json(personas);
});

app.get('/api/grupos/:id/reuniones', requiereSesion, (req, res) => {
  const grupoId = Number(req.params.id);

  if (!puedeVerGrupo(grupoId, req.usuario)) {
    res.status(403).json({ error: 'No puedes consultar este grupo.' });
    return;
  }

  const reuniones = db.prepare(`
    SELECT * FROM reuniones
    WHERE grupo_id = ?
    ORDER BY fecha DESC
  `).all(grupoId);

  res.json(reuniones);
});

app.post('/api/grupos/:id/reuniones', requiereSesion, requiereRol(['Administrador', 'Líder de Grupo']), (req, res) => {
  const grupoId = Number(req.params.id);

  if (req.usuario.rol !== 'Administrador') {
    if (!puedeVerGrupo(grupoId, req.usuario)) {
      res.status(403).json({ error: 'Solo puedes registrar reuniones en tus propios grupos.' });
      return;
    }
  }

  const fecha = req.body.fecha;
  const tipo = req.body.tipo || 'Grupo habitual';
  const duracion = req.body.duracion || null;
  const observacion = req.body.observacion || null;
  const realizada = req.body.realizada === undefined ? 1 : (req.body.realizada ? 1 : 0);

  if (!fecha) {
    res.status(400).json({ error: 'La fecha es obligatoria.' });
    return;
  }

  const tiposValidos = ['Grupo habitual', 'Servicio de red', 'Actividad especial', 'Reunión cancelada'];
  if (!tiposValidos.includes(tipo)) {
    res.status(400).json({ error: 'El tipo de reunión no es válido.' });
    return;
  }

  const resultado = db.prepare(`
    INSERT INTO reuniones (grupo_id, fecha, tipo, realizada, duracion, observacion)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(grupoId, fecha, tipo, realizada, duracion, observacion);

  res.status(201).json({ id: Number(resultado.lastInsertRowid), fecha, tipo, realizada, duracion, observacion });
});

app.get('/api/reuniones/:id', requiereSesion, (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (!puedeVerGrupo(reunion.grupo_id, req.usuario)) {
    res.status(403).json({ error: 'No puedes consultar esta reunión.' });
    return;
  }

  const integrantes = db.prepare(`
    SELECT p.id, p.nombre_completo, pg.rol, ar.asistio
    FROM persona_grupo pg
    JOIN personas p ON p.id = pg.persona_id
    LEFT JOIN asistencia_reunion ar ON ar.reunion_id = ? AND ar.persona_id = p.id
    WHERE pg.grupo_id = ? AND pg.activo = 1
    ORDER BY CASE pg.rol WHEN 'Líder' THEN 0 WHEN 'Apoyo' THEN 1 WHEN 'Anfitrión' THEN 2 ELSE 3 END, p.nombre_completo
  `).all(reunionId, reunion.grupo_id);

  const visitantes = db.prepare('SELECT * FROM visitantes WHERE reunion_id = ?').all(reunionId);

  res.json({ reunion, integrantes, visitantes });
});

app.post('/api/reuniones/:id/asistencia', requiereSesion, requiereRol(['Administrador', 'Líder de Grupo']), (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (req.usuario.rol !== 'Administrador' && !puedeVerGrupo(reunion.grupo_id, req.usuario)) {
    res.status(403).json({ error: 'Solo puedes registrar asistencia en tus propios grupos.' });
    return;
  }

  const personaId = Number(req.body.personaId);
  const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId);

  if (!persona) {
    res.status(400).json({ error: 'La persona no existe.' });
    return;
  }

  const pertenece = db.prepare('SELECT id FROM persona_grupo WHERE persona_id = ? AND grupo_id = ? AND activo = 1').get(personaId, reunion.grupo_id);

  if (!pertenece) {
    res.status(400).json({ error: 'La persona no es integrante activo de este grupo.' });
    return;
  }

  const asistio = req.body.asistio ? 1 : 0;

  db.prepare(`
    INSERT INTO asistencia_reunion (reunion_id, persona_id, asistio)
    VALUES (?, ?, ?)
    ON CONFLICT (reunion_id, persona_id)
    DO UPDATE SET asistio = excluded.asistio
  `).run(reunionId, personaId, asistio);

  res.json({ ok: true, personaId, asistio });
});

app.post('/api/reuniones/:id/visitantes', requiereSesion, requiereRol(['Administrador', 'Líder de Grupo']), (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (req.usuario.rol !== 'Administrador' && !puedeVerGrupo(reunion.grupo_id, req.usuario)) {
    res.status(403).json({ error: 'Solo puedes registrar visitantes en tus propios grupos.' });
    return;
  }

  const nombre = req.body.nombre;

  if (!nombre) {
    res.status(400).json({ error: 'El nombre del visitante es obligatorio.' });
    return;
  }

  const telefono = req.body.telefono || null;
  const observacion = req.body.observacion || null;

  const resultado = db.prepare(`
    INSERT INTO visitantes (reunion_id, nombre, telefono, observacion)
    VALUES (?, ?, ?, ?)
  `).run(reunionId, nombre, telefono, observacion);

  res.status(201).json({ id: Number(resultado.lastInsertRowid), nombre, telefono, observacion });
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