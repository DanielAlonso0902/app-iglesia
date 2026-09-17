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

  if (usuario.rol === 'Líder de Red') {
    if (!usuario.persona_id) return false;

    const pertenencia = db.prepare(`
      SELECT pr.id
      FROM persona_red pr
      JOIN grupos g ON g.red_id = pr.red_id
      WHERE pr.persona_id = ? AND pr.activo = 1 AND g.id = ?
    `).get(usuario.persona_id, grupoId);

    return !!pertenencia;
  }

  if (usuario.rol === 'Miembro') {
    if (!usuario.persona_id) return false;

    const pertenencia = db.prepare(`
      SELECT id FROM persona_grupo
      WHERE persona_id = ? AND grupo_id = ? AND activo = 1
    `).get(usuario.persona_id, grupoId);

    return !!pertenencia;
  }

  return false;
}

function rolAutomatico(personaId) {
  const comoLiderRed = db.prepare('SELECT id FROM persona_red WHERE persona_id = ? AND activo = 1').get(personaId);
  if (comoLiderRed) return 'Líder de Red';

  const comoLiderGrupo = db.prepare("SELECT id FROM persona_grupo WHERE persona_id = ? AND rol = 'Líder' AND activo = 1").get(personaId);
  if (comoLiderGrupo) return 'Líder de Grupo';

  return 'Miembro';
}

function actualizarRolDe(personaId) {
  if (!personaId) return;

  const usuario = db.prepare('SELECT id, rol FROM usuarios WHERE persona_id = ?').get(personaId);
  if (!usuario) return;

  if (!['Líder de Red', 'Líder de Grupo', 'Miembro'].includes(usuario.rol)) return;

  const nuevoRol = rolAutomatico(personaId);
  if (nuevoRol !== usuario.rol) {
    db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(nuevoRol, usuario.id);
  }
}

function puedeVerPersona(personaId, usuario) {
  if (usuario.rol === 'Administrador' || usuario.rol === 'Pastor') {
    return true;
  }

  const grupos = db.prepare('SELECT grupo_id FROM persona_grupo WHERE persona_id = ? AND activo = 1').all(personaId);

  return grupos.some((pertenencia) => puedeVerGrupo(pertenencia.grupo_id, usuario));
}

const etapasFormacion = ['Discípulo S1', 'Discípulo S2', 'Discípulo S3', 'Discípulo S4', 'Bendición N1', 'Bendición N2', 'Bendición N3', 'Ministerio de la Misericordia'];

function puedeVerRed(redId, usuario) {
  if (usuario.rol === 'Administrador' || usuario.rol === 'Pastor') {
    return true;
  }

  if (usuario.rol === 'Líder de Red') {
    if (!usuario.persona_id) return false;

    return !!db.prepare(`
      SELECT id FROM persona_red
      WHERE persona_id = ? AND red_id = ? AND activo = 1
    `).get(usuario.persona_id, redId);
  }

  return false;
}

app.get('/api/personas/:id', requiereSesion, (req, res) => {
  const personaId = Number(req.params.id);
  const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId);

  if (!persona) {
    res.status(404).json({ error: 'Persona no encontrada.' });
    return;
  }

  if (!puedeVerPersona(personaId, req.usuario)) {
    res.status(403).json({ error: 'No puedes consultar esta persona.' });
    return;
  }

  const formacion = db.prepare(`
    SELECT * FROM proceso_formacion
    WHERE persona_id = ?
    ORDER BY fecha_inicio, id
  `).all(personaId);

  res.json({ persona, formacion });
});

app.post('/api/personas/:id/formacion/avanzar', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), (req, res) => {
  const personaId = Number(req.params.id);
  const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId);

  if (!persona) {
    res.status(404).json({ error: 'Persona no encontrada.' });
    return;
  }

  if (!puedeVerPersona(personaId, req.usuario)) {
    res.status(403).json({ error: 'No puedes gestionar esta persona.' });
    return;
  }

  const etapa = req.body.etapa;
  const promedio = req.body.promedio === undefined || req.body.promedio === '' ? null : Number(req.body.promedio);

  if (!etapasFormacion.includes(etapa)) {
    res.status(400).json({ error: 'La etapa de formación no es válida.' });
    return;
  }

  if (promedio !== null && (isNaN(promedio) || promedio < 0 || promedio > 5)) {
    res.status(400).json({ error: 'El promedio debe estar entre 0 y 5.' });
    return;
  }

  const transicion = db.transaction(() => {
    const hoy = new Date().toISOString().slice(0, 10);

    db.prepare(`
      UPDATE proceso_formacion
      SET fecha_fin = ?, activo = 0
      WHERE persona_id = ? AND activo = 1
    `).run(hoy, personaId);

    const resultado = db.prepare(`
      INSERT INTO proceso_formacion (persona_id, etapa, promedio, fecha_inicio, activo)
      VALUES (?, ?, ?, ?, 1)
    `).run(personaId, etapa, promedio, hoy);

    return Number(resultado.lastInsertRowid);
  });

  try {
    const id = transicion();
    res.status(201).json({ id, etapa, promedio });
  } catch (e) {
    res.status(409).json({ error: 'La persona ya registró esa etapa.' });
  }
});

app.get('/api/mis-redes', requiereSesion, (req, res) => {
  let redes;

  if (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Pastor') {
    redes = db.prepare('SELECT * FROM redes WHERE activo = 1 ORDER BY nombre').all();
  } else {
    redes = db.prepare(`
      SELECT redes.*
      FROM redes
      JOIN persona_red pr ON pr.red_id = redes.id
      WHERE pr.persona_id = ? AND pr.activo = 1 AND redes.activo = 1
      ORDER BY redes.nombre
    `).all(req.usuario.persona_id);
  }

  res.json(redes);
});

app.get('/api/reportes/red/:id', requiereSesion, (req, res) => {
  const redId = Number(req.params.id);
  const red = db.prepare('SELECT * FROM redes WHERE id = ?').get(redId);

  if (!red) {
    res.status(404).json({ error: 'Red no encontrada.' });
    return;
  }

  if (!puedeVerRed(redId, req.usuario)) {
    res.status(403).json({ error: 'No puedes consultar esta red.' });
    return;
  }

  const grupos = db.prepare('SELECT id, nombre FROM grupos WHERE red_id = ? AND activo = 1 ORDER BY nombre').all(redId);

  const porGrupo = grupos.map((grupo) => ({
    id: grupo.id,
    nombre: grupo.nombre,
    integrantes: db.prepare('SELECT COUNT(*) AS n FROM persona_grupo WHERE grupo_id = ? AND activo = 1').get(grupo.id).n,
    reuniones: db.prepare('SELECT COUNT(*) AS n FROM reuniones WHERE grupo_id = ?').get(grupo.id).n
  }));

  const totalIntegrantes = porGrupo.reduce((suma, grupo) => suma + grupo.integrantes, 0);
  const totalReuniones = porGrupo.reduce((suma, grupo) => suma + grupo.reuniones, 0);

  const integrantesDeLaRed = db.prepare(`
    SELECT DISTINCT pg.persona_id
    FROM persona_grupo pg
    JOIN grupos g ON g.id = pg.grupo_id
    WHERE g.red_id = ? AND g.activo = 1 AND pg.activo = 1
  `).all(redId);

  const fichaPersona = db.prepare('SELECT es_nuevo, bautizado FROM personas WHERE id = ?');
  const etapaActiva = db.prepare('SELECT etapa FROM proceso_formacion WHERE persona_id = ? AND activo = 1');

  const contadorEtapas = {};
  let nuevos = 0;
  let bautizados = 0;

  for (const fila of integrantesDeLaRed) {
    const ficha = fichaPersona.get(fila.persona_id);
    if (ficha.es_nuevo === 1) nuevos++;
    if (ficha.bautizado === 1) bautizados++;

    const etapa = etapaActiva.get(fila.persona_id);
    const clave = etapa ? etapa.etapa : 'Sin formación';
    contadorEtapas[clave] = (contadorEtapas[clave] || 0) + 1;
  }

  const formacion = Object.entries(contadorEtapas)
    .map(([etapa, cantidad]) => ({ etapa, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  res.json({
    red: red.nombre,
    totalGrupos: porGrupo.length,
    totalIntegrantes,
    totalReuniones,
    porGrupo,
    formacion,
    nuevos,
    bautizados
  });
});

app.get('/api/reportes/formacion', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const porEtapa = db.prepare(`
    SELECT COALESCE(pf.etapa, 'Sin formación') AS etapa, COUNT(*) AS cantidad
    FROM personas p
    LEFT JOIN proceso_formacion pf ON pf.persona_id = p.id AND pf.activo = 1
    GROUP BY pf.etapa
    ORDER BY cantidad DESC
  `).all();

  const resumen = db.prepare(`
    SELECT
      COUNT(*) AS personas,
      SUM(CASE WHEN es_nuevo = 1 THEN 1 ELSE 0 END) AS nuevos,
      SUM(CASE WHEN bautizado = 1 THEN 1 ELSE 0 END) AS bautizados
    FROM personas
  `).get();

  res.json({ porEtapa, resumen });
});

app.post('/api/redes', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const nombre = req.body.nombre;

  if (!nombre) {
    res.status(400).json({ error: 'El nombre de la red es obligatorio.' });
    return;
  }

  const resultado = db.prepare('INSERT INTO redes (nombre) VALUES (?)').run(nombre);
  res.status(201).json({ id: Number(resultado.lastInsertRowid), nombre, activo: 1 });
});

app.patch('/api/redes/:id/estado', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const redId = Number(req.params.id);
  const red = db.prepare('SELECT id FROM redes WHERE id = ?').get(redId);

  if (!red) {
    res.status(404).json({ error: 'Red no encontrada.' });
    return;
  }

  const activo = req.body.activo ? 1 : 0;
  db.prepare('UPDATE redes SET activo = ? WHERE id = ?').run(activo, redId);

  res.json({ id: redId, activo });
});

app.post('/api/grupos', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const redId = Number(req.body.red_id);
  const nombre = req.body.nombre;
  const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const diaHabitual = req.body.dia_habitual || null;
  const horaHabitual = req.body.hora_habitual || null;

  if (!redId || !nombre) {
    res.status(400).json({ error: 'La red y el nombre del grupo son obligatorios.' });
    return;
  }

  if (diaHabitual && !diasValidos.includes(diaHabitual)) {
    res.status(400).json({ error: 'El día habitual debe ser uno de la lista.' });
    return;
  }

  if (horaHabitual && !/^\d{1,2}:\d{2} (AM|PM)$/.test(horaHabitual)) {
    res.status(400).json({ error: 'La hora habitual debe ser como 5:30 PM.' });
    return;
  }

  const red = db.prepare('SELECT id FROM redes WHERE id = ? AND activo = 1').get(redId);

  if (!red) {
    res.status(400).json({ error: 'La red no existe o está inactiva.' });
    return;
  }

  const resultado = db.prepare(`
    INSERT INTO grupos (red_id, nombre, dia_habitual, hora_habitual, duracion_habitual, direccion, barrio, ciudad, referencia)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    redId,
    nombre,
    diaHabitual,
    horaHabitual,
    req.body.duracion_habitual || null,
    req.body.direccion || null,
    req.body.barrio || null,
    req.body.ciudad || null,
    req.body.referencia || null
  );

  res.status(201).json({ id: Number(resultado.lastInsertRowid), nombre });
});

app.patch('/api/grupos/:id/estado', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const grupoId = Number(req.params.id);
  const grupo = db.prepare('SELECT id FROM grupos WHERE id = ?').get(grupoId);

  if (!grupo) {
    res.status(404).json({ error: 'Grupo no encontrado.' });
    return;
  }

  const activo = req.body.activo ? 1 : 0;
  db.prepare('UPDATE grupos SET activo = ? WHERE id = ?').run(activo, grupoId);

  res.json({ id: grupoId, activo });
});

app.get('/api/usuarios', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const usuarios = db.prepare(`
    SELECT usuarios.id, usuarios.cedula, usuarios.rol, usuarios.activo, personas.nombre_completo
    FROM usuarios
    LEFT JOIN personas ON personas.id = usuarios.persona_id
    ORDER BY usuarios.rol, personas.nombre_completo
  `).all();
  res.json(usuarios);
});

app.post('/api/usuarios', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const personaId = Number(req.body.persona_id);
  const rol = req.body.rol;
  const cedula = req.body.cedula || '';
  const contrasena = req.body.contrasena;

  if (!personaId || !rol || !cedula || !contrasena) {
    res.status(400).json({ error: 'La persona, el rol, la cédula y la contraseña son obligatorios.' });
    return;
  }

  if (contrasena.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  if (!['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo'].includes(rol)) {
    res.status(400).json({ error: 'Rol no válido.' });
    return;
  }

  if (!db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId)) {
    res.status(400).json({ error: 'La persona no existe.' });
    return;
  }

  if (db.prepare('SELECT id FROM usuarios WHERE persona_id = ?').get(personaId)) {
    res.status(400).json({ error: 'Esa persona ya tiene usuario.' });
    return;
  }

  if (db.prepare('SELECT id FROM usuarios WHERE cedula = ?').get(cedula)) {
    res.status(400).json({ error: 'Esa cédula ya está en uso.' });
    return;
  }

  if (rol === 'Líder de Red') {
    const redId = Number(req.body.red_id);
    if (!db.prepare('SELECT id FROM redes WHERE id = ? AND activo = 1').get(redId)) {
      res.status(400).json({ error: 'Debes elegir una red activa para el líder de red.' });
      return;
    }
    db.prepare('INSERT INTO persona_red (persona_id, red_id, fecha_inicio, activo) VALUES (?, ?, ?, 1)')
      .run(personaId, redId, new Date().toISOString().slice(0, 10));
  }

  if (rol === 'Líder de Grupo') {
    const grupoId = Number(req.body.grupo_id);
    if (!db.prepare('SELECT id FROM grupos WHERE id = ? AND activo = 1').get(grupoId)) {
      res.status(400).json({ error: 'Debes elegir un grupo activo para el líder de grupo.' });
      return;
    }
    db.prepare('INSERT INTO persona_grupo (persona_id, grupo_id, rol, fecha_inicio, activo) VALUES (?, ?, ?, ?, 1)')
      .run(personaId, grupoId, 'Líder', new Date().toISOString().slice(0, 10));
  }

  const resultado = db.prepare('INSERT INTO usuarios (cedula, password_hash, rol, persona_id) VALUES (?, ?, ?, ?)')
    .run(cedula, bcrypt.hashSync(contrasena, 10), rol, personaId);

  actualizarRolDe(personaId);

  res.status(201).json({ id: Number(resultado.lastInsertRowid), cedula, rol });
});

app.patch('/api/usuarios/:id/estado', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const usuarioId = Number(req.params.id);

  if (usuarioId === req.usuario.id) {
    res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });
    return;
  }

  if (!db.prepare('SELECT id FROM usuarios WHERE id = ?').get(usuarioId)) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }

  const activo = req.body.activo ? 1 : 0;
  db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo, usuarioId);
  res.json({ id: usuarioId, activo });
});

app.patch('/api/usuarios/:id/contrasena', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const usuarioId = Number(req.params.id);
  const contrasena = req.body.contrasena;

  if (!contrasena || contrasena.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  if (!db.prepare('SELECT id FROM usuarios WHERE id = ?').get(usuarioId)) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }

  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(contrasena, 10), usuarioId);
  res.json({ mensaje: 'Contraseña actualizada.' });
});

app.post('/api/grupos/:id/integrantes/:personaId/retirar', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), (req, res) => {
  const grupoId = Number(req.params.id);
  const personaId = Number(req.params.personaId);

  if (!puedeVerGrupo(grupoId, req.usuario)) {
    res.status(403).json({ error: 'No tienes permiso para este grupo.' });
    return;
  }

  const pertenencia = db.prepare('SELECT id FROM persona_grupo WHERE grupo_id = ? AND persona_id = ? AND activo = 1').get(grupoId, personaId);

  if (!pertenencia) {
    res.status(404).json({ error: 'Esa persona no es integrante activo del grupo.' });
    return;
  }

  db.prepare('UPDATE persona_grupo SET fecha_fin = ?, activo = 0 WHERE grupo_id = ? AND persona_id = ? AND activo = 1')
    .run(new Date().toISOString().slice(0, 10), grupoId, personaId);

  actualizarRolDe(personaId);

  res.json({ mensaje: 'Integrante retirado del grupo.' });
});

app.post('/api/grupos/:id/transferir-lider', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red']), (req, res) => {
  const grupoId = Number(req.params.id);
  const personaId = Number(req.body.persona_id);

  if (!personaId) {
    res.status(400).json({ error: 'Debes elegir el nuevo líder.' });
    return;
  }

  if (!puedeVerGrupo(grupoId, req.usuario)) {
    res.status(403).json({ error: 'No tienes permiso para este grupo.' });
    return;
  }

  if (!db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId)) {
    res.status(400).json({ error: 'La persona no existe.' });
    return;
  }

  if (!db.prepare('SELECT id FROM persona_grupo WHERE grupo_id = ? AND persona_id = ? AND activo = 1').get(grupoId, personaId)) {
    res.status(400).json({ error: 'El nuevo líder debe ser integrante activo del grupo.' });
    return;
  }

  const yaEsLider = db.prepare("SELECT id FROM persona_grupo WHERE grupo_id = ? AND persona_id = ? AND rol = 'Líder' AND activo = 1").get(grupoId, personaId);

  if (yaEsLider) {
    res.status(400).json({ error: 'Esa persona ya es líder del grupo.' });
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const antiguosLideres = db.prepare("SELECT DISTINCT persona_id FROM persona_grupo WHERE grupo_id = ? AND rol = 'Líder' AND activo = 1").all(grupoId).map((fila) => fila.persona_id);

  const cerrar = db.transaction(() => {
    db.prepare("UPDATE persona_grupo SET fecha_fin = ?, activo = 0 WHERE grupo_id = ? AND rol = 'Líder' AND activo = 1").run(hoy, grupoId);

    const miembro = db.prepare('SELECT id FROM persona_grupo WHERE grupo_id = ? AND persona_id = ? AND activo = 1').get(grupoId, personaId);
    if (!miembro) {
      throw new Error('El nuevo líder debe ser integrante activo del grupo.');
    }

    db.prepare("UPDATE persona_grupo SET rol = 'Líder' WHERE id = ?").run(miembro.id);
  });

  try {
    cerrar();
  } catch (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  actualizarRolDe(personaId);
  antiguosLideres.forEach(actualizarRolDe);

  res.json({ mensaje: 'Liderazgo transferido.' });
});

app.post('/api/redes/:id/transferir-lider', requiereSesion, requiereRol(['Administrador', 'Pastor']), (req, res) => {
  const redId = Number(req.params.id);
  const personaId = Number(req.body.persona_id);

  if (!personaId) {
    res.status(400).json({ error: 'Debes elegir el nuevo líder.' });
    return;
  }

  if (!db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId)) {
    res.status(400).json({ error: 'La persona no existe.' });
    return;
  }

  if (db.prepare('SELECT id FROM persona_red WHERE red_id = ? AND persona_id = ? AND activo = 1').get(redId, personaId)) {
    res.status(400).json({ error: 'Esa persona ya es líder de la red.' });
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const antiguosLideres = db.prepare('SELECT DISTINCT persona_id FROM persona_red WHERE red_id = ? AND activo = 1').all(redId).map((fila) => fila.persona_id);

  const cerrar = db.transaction(() => {
    db.prepare('UPDATE persona_red SET fecha_fin = ?, activo = 0 WHERE red_id = ? AND activo = 1').run(hoy, redId);
    db.prepare('INSERT INTO persona_red (persona_id, red_id, fecha_inicio, activo) VALUES (?, ?, ?, 1)').run(personaId, redId, hoy);
  });

  cerrar();

  actualizarRolDe(personaId);
  antiguosLideres.forEach(actualizarRolDe);

  res.json({ mensaje: 'Liderazgo de la red transferido.' });
});

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

  actualizarRolDe(usuario.persona_id);

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)').run(token, usuario.id);

  const rolActual = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuario.id).rol;
  res.cookie('sesion', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ id: usuario.id, cedula: usuario.cedula, rol: rolActual });
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

app.patch('/api/mi-contrasena', requiereSesion, (req, res) => {
  const contrasenaActual = req.body.contrasena_actual;
  const contrasenaNueva = req.body.contrasena_nueva;

  if (!contrasenaActual || !contrasenaNueva) {
    res.status(400).json({ error: 'Debes escribir tu contraseña actual y la nueva.' });
    return;
  }

  if (contrasenaNueva.length < 6) {
    res.status(400).json({ error: 'La contraseña nueva debe tener al menos 6 caracteres.' });
    return;
  }

  const usuario = db.prepare('SELECT id, password_hash FROM usuarios WHERE id = ?').get(req.usuario.id);

  if (!bcrypt.compareSync(contrasenaActual, usuario.password_hash)) {
    res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    return;
  }

  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(contrasenaNueva, 10), usuario.id);
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token != ?').run(usuario.id, req.cookies.sesion);

  res.json({ mensaje: 'Contraseña actualizada.' });
});

app.get('/api/redes', requiereSesion, (req, res) => {
  const incluirInactivas = req.query.todas === '1' && (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Pastor');

  const redes = incluirInactivas
    ? db.prepare('SELECT * FROM redes ORDER BY nombre').all()
    : db.prepare('SELECT * FROM redes WHERE activo = 1 ORDER BY nombre').all();

  res.json(redes);
});

app.get('/api/grupos', requiereSesion, (req, res) => {
  const incluirInactivos = req.query.todas === '1' && (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Pastor');

  const filtro = incluirInactivos ? '' : 'WHERE grupos.activo = 1 ';

  const grupos = db.prepare(`
    SELECT grupos.*, redes.nombre AS red
    FROM grupos
    JOIN redes ON redes.id = grupos.red_id
    ${filtro}
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
    WHERE grupos.red_id = ? AND grupos.activo = 1
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
    SELECT personas.id, personas.nombre_completo, personas.cedula, personas.celular, personas.direccion, persona_grupo.rol
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

  if (!q) {
    const personas = db.prepare('SELECT id, nombre_completo FROM personas ORDER BY nombre_completo').all();
    res.json(personas);
    return;
  }

  const busqueda = '%' + q + '%';
  const personas = db.prepare(`
    SELECT p.id, p.nombre_completo, p.celular, p.activo AS persona_activo, COALESCE(p.cedula, u.cedula) AS cedula
    FROM personas p
    LEFT JOIN usuarios u ON u.persona_id = p.id
    WHERE p.nombre_completo LIKE ? OR p.celular LIKE ? OR p.cedula LIKE ? OR u.cedula LIKE ?
    ORDER BY p.nombre_completo
    LIMIT 50
  `).all(busqueda, busqueda, busqueda, busqueda);

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

app.post('/api/grupos/:id/reuniones', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), (req, res) => {
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

app.patch('/api/reuniones/:id', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (req.usuario.rol !== 'Administrador' && !puedeVerGrupo(reunion.grupo_id, req.usuario)) {
    res.status(403).json({ error: 'Solo puedes editar reuniones de tus propios grupos.' });
    return;
  }

  const fecha = req.body.fecha === undefined ? reunion.fecha : req.body.fecha;
  const tipo = req.body.tipo === undefined ? reunion.tipo : req.body.tipo;
  const duracion = req.body.duracion === undefined ? reunion.duracion : (req.body.duracion || null);
  const observacion = req.body.observacion === undefined ? reunion.observacion : (req.body.observacion || null);
  const realizada = req.body.realizada === undefined ? reunion.realizada : (req.body.realizada ? 1 : 0);

  if (!fecha) {
    res.status(400).json({ error: 'La fecha es obligatoria.' });
    return;
  }

  const tiposValidos = ['Grupo habitual', 'Servicio de red', 'Actividad especial', 'Reunión cancelada'];
  if (!tiposValidos.includes(tipo)) {
    res.status(400).json({ error: 'El tipo de reunión no es válido.' });
    return;
  }

  db.prepare(`
    UPDATE reuniones
    SET fecha = ?, tipo = ?, realizada = ?, duracion = ?, observacion = ?
    WHERE id = ?
  `).run(fecha, tipo, realizada, duracion, observacion, reunionId);

  res.json({ mensaje: 'Reunión actualizada.' });
});

app.post('/api/reuniones/:id/anular', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (req.usuario.rol !== 'Administrador' && !puedeVerGrupo(reunion.grupo_id, req.usuario)) {
    res.status(403).json({ error: 'Solo puedes anular reuniones de tus propios grupos.' });
    return;
  }

  db.prepare('UPDATE reuniones SET realizada = 0, tipo = ?, observacion = ? WHERE id = ?').run(
    'Reunión cancelada',
    [reunion.observacion, req.body.motivo].filter(Boolean).join(' · '),
    reunionId
  );

  res.json({ mensaje: 'Reunión anulada.' });
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

app.post('/api/reuniones/:id/asistencia', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), (req, res) => {
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

app.post('/api/reuniones/:id/visitantes', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), (req, res) => {
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

app.post('/api/grupos/:id/integrantes', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), (req, res) => {
  const grupoId = Number(req.params.id);

  if (req.usuario.rol !== 'Administrador') {
    if (!puedeVerGrupo(grupoId, req.usuario)) {
      res.status(403).json({ error: 'Solo puedes registrar integrantes en tus propios grupos.' });
      return;
    }
  }

  const rol = req.body.rol;

  if (!rol) {
    res.status(400).json({ error: 'El rol es obligatorio.' });
    return;
  }

  if (!rolesValidos.includes(rol)) {
    res.status(400).json({ error: 'El rol no es válido.' });
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const insertarPertenencia = db.prepare(
    'INSERT INTO persona_grupo (persona_id, grupo_id, rol, fecha_inicio, activo) VALUES (?, ?, ?, ?, 1)'
  );

  const personaIdExistente = Number(req.body.persona_id);
  if (personaIdExistente) {
    const persona = db.prepare('SELECT id, nombre_completo FROM personas WHERE id = ? AND activo = 1').get(personaIdExistente);

    if (!persona) {
      res.status(404).json({ error: 'La persona no existe.' });
      return;
    }

    const yaIntegrante = db.prepare('SELECT id FROM persona_grupo WHERE persona_id = ? AND grupo_id = ? AND activo = 1').get(personaIdExistente, grupoId);

    if (yaIntegrante) {
      res.status(409).json({ error: 'Esta persona ya es integrante de este grupo.' });
      return;
    }

    insertarPertenencia.run(personaIdExistente, grupoId, rol, hoy);
    res.status(201).json({ id: personaIdExistente, nombre: persona.nombre_completo, rol });
    return;
  }

  const nombre = req.body.nombre;
  const cedula = req.body.cedula || null;
  const celular = req.body.celular || null;
  const direccion = req.body.direccion || null;

  if (!nombre) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }

  const existePorCedula = cedula ? db.prepare(`
    SELECT p.id, p.nombre_completo, p.cedula AS persona_cedula, u.cedula AS usuario_cedula
    FROM personas p
    LEFT JOIN usuarios u ON u.persona_id = p.id
    WHERE p.activo = 1 AND (p.cedula = ? OR u.cedula = ?)
  `).get(cedula, cedula) : null;

  if (existePorCedula) {
    const yaIntegrante = db.prepare('SELECT id FROM persona_grupo WHERE persona_id = ? AND grupo_id = ? AND activo = 1').get(existePorCedula.id, grupoId);

    if (yaIntegrante) {
      res.status(409).json({ error: 'Ya existe una persona con esa cédula y ya es integrante de este grupo.' });
      return;
    }

    res.status(409).json({
      error: 'Ya existe una persona con esa cédula: ' + existePorCedula.nombre_completo + '.',
      persona: { id: existePorCedula.id, nombre_completo: existePorCedula.nombre_completo, cedula: existePorCedula.persona_cedula || existePorCedula.usuario_cedula }
    });
    return;
  }

  const insertarPersona = db.prepare(
    'INSERT INTO personas (nombre_completo, cedula, celular, direccion) VALUES (?, ?, ?, ?)'
  );

  const crearIntegrante = db.transaction(() => {
    const resultado = insertarPersona.run(nombre, cedula, celular, direccion);
    const personaId = Number(resultado.lastInsertRowid);
    insertarPertenencia.run(personaId, grupoId, rol, hoy);
    return personaId;
  });

  const personaId = crearIntegrante();

  res.status(201).json({ id: personaId, nombre, cedula, celular, direccion, rol });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});