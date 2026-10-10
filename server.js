const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

app.get('/api/estado', (req, res) => {
  res.json({
    mensaje: 'El servidor está funcionando',
    hora: new Date().toISOString()
  });
});

async function requiereSesion(req, res, next) {
  const token = req.cookies.sesion;

  if (!token) {
    res.status(401).json({ error: 'No has iniciado sesión.' });
    return;
  }

  const sesion = await db.prepare(`
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

async function puedeVerGrupo(grupoId, usuario) {
  if (usuario.rol === 'Administrador' || usuario.rol === 'Pastor') {
    return true;
  }

  if (usuario.rol === 'Líder de Grupo') {
    if (!usuario.persona_id) return false;

    const pertenencia = await db.prepare(`
      SELECT id FROM persona_grupo
      WHERE persona_id = ? AND grupo_id = ? AND rol = 'Líder' AND activo = 1
    `).get(usuario.persona_id, grupoId);

    return !!pertenencia;
  }

  if (usuario.rol === 'Líder de Red') {
    if (!usuario.persona_id) return false;

    const pertenencia = await db.prepare(`
      SELECT pr.id
      FROM persona_red pr
      JOIN grupos g ON g.red_id = pr.red_id
      WHERE pr.persona_id = ? AND pr.activo = 1 AND g.id = ?
    `).get(usuario.persona_id, grupoId);

    return !!pertenencia;
  }

  if (usuario.rol === 'Miembro') {
    if (!usuario.persona_id) return false;

    const pertenencia = await db.prepare(`
      SELECT id FROM persona_grupo
      WHERE persona_id = ? AND grupo_id = ? AND activo = 1
    `).get(usuario.persona_id, grupoId);

    return !!pertenencia;
  }

  return false;
}

async function rolAutomatico(personaId) {
  const comoLiderRed = await db.prepare('SELECT id FROM persona_red WHERE persona_id = ? AND activo = 1').get(personaId);
  if (comoLiderRed) return 'Líder de Red';

  const comoLiderGrupo = await db.prepare("SELECT id FROM persona_grupo WHERE persona_id = ? AND rol = 'Líder' AND activo = 1").get(personaId);
  if (comoLiderGrupo) return 'Líder de Grupo';

  return 'Miembro';
}

async function actualizarRolDe(personaId) {
  if (!personaId) return;

  const usuario = await db.prepare('SELECT id, rol FROM usuarios WHERE persona_id = ?').get(personaId);
  if (!usuario) return;

  if (!['Líder de Red', 'Líder de Grupo', 'Miembro'].includes(usuario.rol)) return;

  const nuevoRol = await rolAutomatico(personaId);
  if (nuevoRol !== usuario.rol) {
    await db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(nuevoRol, usuario.id);
  }
}

async function puedeVerPersona(personaId, usuario) {
  if (usuario.rol === 'Administrador' || usuario.rol === 'Pastor') {
    return true;
  }

  const grupos = await db.prepare('SELECT grupo_id FROM persona_grupo WHERE persona_id = ? AND activo = 1').all(personaId);

  for (const pertenencia of grupos) {
    if (await puedeVerGrupo(pertenencia.grupo_id, usuario)) {
      return true;
    }
  }

  return false;
}

const etapasFormacion = ['Discípulo S1', 'Discípulo S2', 'Discípulo S3', 'Discípulo S4', 'Bendición N1', 'Bendición N2', 'Bendición N3', 'Ministerio de la Misericordia'];

async function puedeVerRed(redId, usuario) {
  if (usuario.rol === 'Administrador' || usuario.rol === 'Pastor') {
    return true;
  }

  if (!usuario.persona_id) return false;

  if (usuario.rol === 'Líder de Red') {
    return !!(await db.prepare(`
      SELECT id FROM persona_red
      WHERE persona_id = ? AND red_id = ? AND activo = 1
    `).get(usuario.persona_id, redId));
  }

  const pertenencia = await db.prepare(`
    SELECT pg.id
    FROM persona_grupo pg
    JOIN grupos g ON g.id = pg.grupo_id
    WHERE pg.persona_id = ? AND g.red_id = ? AND pg.activo = 1 AND g.activo = 1
  `).get(usuario.persona_id, redId);

  return !!pertenencia;
}

app.get('/api/personas/:id', requiereSesion, async (req, res) => {
  const personaId = Number(req.params.id);
  const persona = await db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId);

  if (!persona) {
    res.status(404).json({ error: 'Persona no encontrada.' });
    return;
  }

  if (!(await puedeVerPersona(personaId, req.usuario))) {
    res.status(403).json({ error: 'No puedes consultar esta persona.' });
    return;
  }

  const formacion = await db.prepare(`
    SELECT * FROM proceso_formacion
    WHERE persona_id = ?
    ORDER BY fecha_inicio, id
  `).all(personaId);

  res.json({ persona, formacion });
});

app.post('/api/personas/:id/formacion/avanzar', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const personaId = Number(req.params.id);
  const persona = await db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId);

  if (!persona) {
    res.status(404).json({ error: 'Persona no encontrada.' });
    return;
  }

  if (!(await puedeVerPersona(personaId, req.usuario))) {
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

  try {
    const id = await db.transaccion(async () => {
      const hoy = new Date().toISOString().slice(0, 10);

      await db.prepare(`
        UPDATE proceso_formacion
        SET fecha_fin = ?, activo = 0
        WHERE persona_id = ? AND activo = 1
      `).run(hoy, personaId);

      const resultado = await db.prepare(`
        INSERT INTO proceso_formacion (persona_id, etapa, promedio, fecha_inicio, activo)
        VALUES (?, ?, ?, ?, 1)
      `).run(personaId, etapa, promedio, hoy);

      return Number(resultado.lastInsertRowid);
    });

    res.status(201).json({ id, etapa, promedio });
  } catch (e) {
    res.status(409).json({ error: 'La persona ya registró esa etapa.' });
  }
});

app.get('/api/mis-redes', requiereSesion, async (req, res) => {
  let redes;

  if (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Pastor') {
    redes = await db.prepare('SELECT * FROM redes WHERE activo = 1 ORDER BY nombre').all();
  } else {
    redes = await db.prepare(`
      SELECT redes.*
      FROM redes
      JOIN persona_red pr ON pr.red_id = redes.id
      WHERE pr.persona_id = ? AND pr.activo = 1 AND redes.activo = 1
      ORDER BY redes.nombre
    `).all(req.usuario.persona_id);
  }

  res.json(redes);
});

app.get('/api/reportes/red/:id', requiereSesion, async (req, res) => {
  const redId = Number(req.params.id);
  const red = await db.prepare('SELECT * FROM redes WHERE id = ?').get(redId);

  if (!red) {
    res.status(404).json({ error: 'Red no encontrada.' });
    return;
  }

  if (!(await puedeVerRed(redId, req.usuario))) {
    res.status(403).json({ error: 'No puedes consultar esta red.' });
    return;
  }

  const grupos = await db.prepare('SELECT id, nombre FROM grupos WHERE red_id = ? AND activo = 1 ORDER BY nombre').all(redId);

  const porGrupo = [];
  for (const grupo of grupos) {
    const integrantes = (await db.prepare('SELECT COUNT(*) AS n FROM persona_grupo WHERE grupo_id = ? AND activo = 1').get(grupo.id)).n;
    const reuniones = (await db.prepare('SELECT COUNT(*) AS n FROM reuniones WHERE grupo_id = ?').get(grupo.id)).n;
    porGrupo.push({ id: grupo.id, nombre: grupo.nombre, integrantes, reuniones });
  }

  const totalIntegrantes = porGrupo.reduce((suma, grupo) => suma + grupo.integrantes, 0);
  const totalReuniones = porGrupo.reduce((suma, grupo) => suma + grupo.reuniones, 0);

  const integrantesDeLaRed = await db.prepare(`
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
    const ficha = await fichaPersona.get(fila.persona_id);
    if (ficha.es_nuevo === 1) nuevos++;
    if (ficha.bautizado === 1) bautizados++;

    const etapa = await etapaActiva.get(fila.persona_id);
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

app.get('/api/reportes/formacion', requiereSesion, requiereRol(['Administrador', 'Pastor']), async (req, res) => {
  const porEtapa = await db.prepare(`
    SELECT COALESCE(pf.etapa, 'Sin formación') AS etapa, COUNT(*) AS cantidad
    FROM personas p
    LEFT JOIN proceso_formacion pf ON pf.persona_id = p.id AND pf.activo = 1
    GROUP BY pf.etapa
    ORDER BY cantidad DESC
  `).all();

  const resumen = await db.prepare(`
    SELECT
      COUNT(*) AS personas,
      SUM(CASE WHEN es_nuevo = 1 THEN 1 ELSE 0 END) AS nuevos,
      SUM(CASE WHEN bautizado = 1 THEN 1 ELSE 0 END) AS bautizados
    FROM personas
  `).get();

  res.json({ porEtapa, resumen });
});

app.post('/api/redes', requiereSesion, requiereRol(['Administrador', 'Pastor']), async (req, res) => {
  const nombre = req.body.nombre;

  if (!nombre) {
    res.status(400).json({ error: 'El nombre de la red es obligatorio.' });
    return;
  }

  const resultado = await db.prepare('INSERT INTO redes (nombre) VALUES (?)').run(nombre);
  res.status(201).json({ id: Number(resultado.lastInsertRowid), nombre, activo: 1 });
});

app.patch('/api/redes/:id/estado', requiereSesion, requiereRol(['Administrador', 'Pastor']), async (req, res) => {
  const redId = Number(req.params.id);
  const red = await db.prepare('SELECT id FROM redes WHERE id = ?').get(redId);

  if (!red) {
    res.status(404).json({ error: 'Red no encontrada.' });
    return;
  }

  const activo = req.body.activo ? 1 : 0;
  await db.prepare('UPDATE redes SET activo = ? WHERE id = ?').run(activo, redId);

  res.json({ id: redId, activo });
});

app.patch('/api/redes/:id', requiereSesion, requiereRol(['Administrador', 'Pastor']), async (req, res) => {
  const redId = Number(req.params.id);
  const red = await db.prepare('SELECT id FROM redes WHERE id = ?').get(redId);

  if (!red) {
    res.status(404).json({ error: 'Red no encontrada.' });
    return;
  }

  const nombre = req.body.nombre;
  if (!nombre) {
    res.status(400).json({ error: 'El nombre de la red es obligatorio.' });
    return;
  }

  await db.prepare('UPDATE redes SET nombre = ? WHERE id = ?').run(nombre, redId);

  res.json({ id: redId, nombre });
});

app.post('/api/grupos', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red']), async (req, res) => {
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

  if (!(await puedeVerRed(redId, req.usuario))) {
    res.status(403).json({ error: 'Solo puedes crear grupos en tu propia red.' });
    return;
  }

  const red = await db.prepare('SELECT id FROM redes WHERE id = ? AND activo = 1').get(redId);

  if (!red) {
    res.status(400).json({ error: 'La red no existe o está inactiva.' });
    return;
  }

  const resultado = await db.prepare(`
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

app.patch('/api/grupos/:id/estado', requiereSesion, requiereRol(['Administrador', 'Pastor']), async (req, res) => {
  const grupoId = Number(req.params.id);
  const grupo = await db.prepare('SELECT id FROM grupos WHERE id = ?').get(grupoId);

  if (!grupo) {
    res.status(404).json({ error: 'Grupo no encontrado.' });
    return;
  }

  const activo = req.body.activo ? 1 : 0;
  await db.prepare('UPDATE grupos SET activo = ? WHERE id = ?').run(activo, grupoId);

  res.json({ id: grupoId, activo });
});

app.patch('/api/grupos/:id', requiereSesion, requiereRol(['Administrador', 'Pastor']), async (req, res) => {
  const grupoId = Number(req.params.id);

  if (!(await db.prepare('SELECT id FROM grupos WHERE id = ?').get(grupoId))) {
    res.status(404).json({ error: 'Grupo no encontrado.' });
    return;
  }

  const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const camposEscritos = ['nombre', 'dia_habitual', 'hora_habitual', 'duracion_habitual', 'direccion', 'barrio', 'ciudad', 'referencia']
    .filter((campo) => req.body[campo] !== undefined);

  const cambios = camposEscritos.map((campo) => [campo, req.body[campo] || null]);

  if (cambios.length === 0) {
    res.status(400).json({ error: 'No hay campos para actualizar.' });
    return;
  }

  const valores = {};
  for (const [campo, valor] of cambios) {
    valores[campo] = valor;
  }

  if (valores.nombre !== null && !String(valores.nombre).trim()) {
    res.status(400).json({ error: 'El nombre del grupo es obligatorio.' });
    return;
  }

  if (valores.dia_habitual && !diasValidos.includes(valores.dia_habitual)) {
    res.status(400).json({ error: 'El día habitual debe ser uno de la lista.' });
    return;
  }

  if (valores.hora_habitual && !/^\d{1,2}:\d{2} (AM|PM)$/.test(valores.hora_habitual)) {
    res.status(400).json({ error: 'La hora habitual debe ser como 5:30 PM.' });
    return;
  }

  const asignaciones = cambios.map(([campo]) => campo + ' = ?').join(', ');
  await db.prepare('UPDATE grupos SET ' + asignaciones + ' WHERE id = ?').run(...cambios.map(([, valor]) => valor), grupoId);

  res.json({ id: grupoId, mensaje: 'Grupo actualizado.' });
});

app.post('/api/reiniciar-datos', requiereSesion, requiereRol(['Administrador']), async (req, res) => {
  await db.transaccion(async () => {
    await db.prepare('DELETE FROM asistencia_reunion').run();
    await db.prepare('DELETE FROM visitantes').run();
    await db.prepare('DELETE FROM reuniones').run();
    await db.prepare('DELETE FROM proceso_formacion').run();
    await db.prepare('DELETE FROM persona_grupo').run();
    await db.prepare('DELETE FROM persona_red').run();
    await db.prepare("DELETE FROM sesiones WHERE usuario_id IN (SELECT id FROM usuarios WHERE rol != 'Administrador')").run();
    await db.prepare("DELETE FROM usuarios WHERE rol != 'Administrador'").run();
    await db.prepare('DELETE FROM personas').run();
    await db.prepare('DELETE FROM grupos').run();
  });

  res.json({ mensaje: 'Reinicio completo: quedan el administrador y las redes.' });
});

app.get('/api/usuarios', requiereSesion, requiereRol(['Administrador', 'Líder de Red']), async (req, res) => {
  const usuarios = await db.prepare(`
    SELECT usuarios.id, usuarios.cedula, usuarios.rol, usuarios.activo, personas.nombre_completo
    FROM usuarios
    LEFT JOIN personas ON personas.id = usuarios.persona_id
    ORDER BY usuarios.rol, personas.nombre_completo
  `).all();
  res.json(usuarios);
});

app.post('/api/usuarios', requiereSesion, requiereRol(['Administrador', 'Líder de Red']), async (req, res) => {
  let personaId = Number(req.body.persona_id);
  const nombrePersona = (req.body.nombre_persona || '').trim();
  const rol = req.body.rol;
  const cedula = req.body.cedula || '';
  const contrasena = req.body.contrasena;

  if (!personaId && nombrePersona) {
    const resultado = await db.prepare('INSERT INTO personas (nombre_completo) VALUES (?)').run(nombrePersona);
    personaId = Number(resultado.lastInsertRowid);
  }

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

  if (req.usuario.rol === 'Líder de Red') {
    if (rol === 'Administrador' || rol === 'Pastor') {
      res.status(403).json({ error: 'Un líder de red solo crea usuarios del rol Líder de Red o Líder de Grupo.' });
      return;
    }

    const puedeCrearEnRed = rol === 'Líder de Red'
      ? await puedeVerRed(Number(req.body.red_id), req.usuario)
      : false;

    const puedeCrearEnGrupo = rol === 'Líder de Grupo'
      ? await (async () => {
          const grupo = await db.prepare('SELECT red_id FROM grupos WHERE id = ?').get(Number(req.body.grupo_id));
          return grupo ? await puedeVerRed(grupo.red_id, req.usuario) : false;
        })()
      : false;

    if (!puedeCrearEnRed && !puedeCrearEnGrupo) {
      res.status(403).json({ error: 'Solo puedes crear usuarios dentro de tu propia red.' });
      return;
    }
  }

  if (!(await db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId))) {
    res.status(400).json({ error: 'La persona no existe.' });
    return;
  }

  if (await db.prepare('SELECT id FROM usuarios WHERE persona_id = ?').get(personaId)) {
    res.status(400).json({ error: 'Esa persona ya tiene usuario.' });
    return;
  }

  if (await db.prepare('SELECT id FROM usuarios WHERE cedula = ?').get(cedula)) {
    res.status(400).json({ error: 'Esa cédula ya está en uso.' });
    return;
  }

  if (rol === 'Líder de Red') {
    const redId = Number(req.body.red_id);
    if (!(await db.prepare('SELECT id FROM redes WHERE id = ? AND activo = 1').get(redId))) {
      res.status(400).json({ error: 'Debes elegir una red activa para el líder de red.' });
      return;
    }
    await db.prepare('INSERT INTO persona_red (persona_id, red_id, fecha_inicio, activo) VALUES (?, ?, ?, 1)')
      .run(personaId, redId, new Date().toISOString().slice(0, 10));
  }

  if (rol === 'Líder de Grupo') {
    const grupoId = Number(req.body.grupo_id);
    if (!(await db.prepare('SELECT id FROM grupos WHERE id = ? AND activo = 1').get(grupoId))) {
      res.status(400).json({ error: 'Debes elegir un grupo activo para el líder de grupo.' });
      return;
    }
    await db.prepare('INSERT INTO persona_grupo (persona_id, grupo_id, rol, fecha_inicio, activo) VALUES (?, ?, ?, ?, 1)')
      .run(personaId, grupoId, 'Líder', new Date().toISOString().slice(0, 10));
  }

  const resultado = await db.prepare('INSERT INTO usuarios (cedula, password_hash, rol, persona_id) VALUES (?, ?, ?, ?)')
    .run(cedula, bcrypt.hashSync(contrasena, 10), rol, personaId);

  await actualizarRolDe(personaId);

  res.status(201).json({ id: Number(resultado.lastInsertRowid), cedula, rol });
});

app.patch('/api/usuarios/:id/estado', requiereSesion, requiereRol(['Administrador']), async (req, res) => {
  const usuarioId = Number(req.params.id);

  if (usuarioId === req.usuario.id) {
    res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });
    return;
  }

  if (!(await db.prepare('SELECT id FROM usuarios WHERE id = ?').get(usuarioId))) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }

  const activo = req.body.activo ? 1 : 0;
  await db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo, usuarioId);
  res.json({ id: usuarioId, activo });
});

app.patch('/api/usuarios/:id/contrasena', requiereSesion, requiereRol(['Administrador']), async (req, res) => {
  const usuarioId = Number(req.params.id);
  const contrasena = req.body.contrasena;

  if (!contrasena || contrasena.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  if (!(await db.prepare('SELECT id FROM usuarios WHERE id = ?').get(usuarioId))) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }

  await db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(contrasena, 10), usuarioId);
  res.json({ mensaje: 'Contraseña actualizada.' });
});

app.post('/api/grupos/:id/integrantes/:personaId/retirar', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const grupoId = Number(req.params.id);
  const personaId = Number(req.params.personaId);

  if (!(await puedeVerGrupo(grupoId, req.usuario))) {
    res.status(403).json({ error: 'No tienes permiso para este grupo.' });
    return;
  }

  const pertenencia = await db.prepare('SELECT id FROM persona_grupo WHERE grupo_id = ? AND persona_id = ? AND activo = 1').get(grupoId, personaId);

  if (!pertenencia) {
    res.status(404).json({ error: 'Esa persona no es integrante activo del grupo.' });
    return;
  }

  await db.prepare('UPDATE persona_grupo SET fecha_fin = ?, activo = 0 WHERE grupo_id = ? AND persona_id = ? AND activo = 1')
    .run(new Date().toISOString().slice(0, 10), grupoId, personaId);

  await actualizarRolDe(personaId);

  res.json({ mensaje: 'Integrante retirado del grupo.' });
});

app.post('/api/grupos/:id/transferir-lider', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red']), async (req, res) => {
  const grupoId = Number(req.params.id);
  const personaId = Number(req.body.persona_id);

  if (!personaId) {
    res.status(400).json({ error: 'Debes elegir el nuevo líder.' });
    return;
  }

  if (!(await puedeVerGrupo(grupoId, req.usuario))) {
    res.status(403).json({ error: 'No tienes permiso para este grupo.' });
    return;
  }

  if (!(await db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId))) {
    res.status(400).json({ error: 'La persona no existe.' });
    return;
  }

  if (!(await db.prepare('SELECT id FROM persona_grupo WHERE grupo_id = ? AND persona_id = ? AND activo = 1').get(grupoId, personaId))) {
    res.status(400).json({ error: 'El nuevo líder debe ser integrante activo del grupo.' });
    return;
  }

  const yaEsLider = await db.prepare("SELECT id FROM persona_grupo WHERE grupo_id = ? AND persona_id = ? AND rol = 'Líder' AND activo = 1").get(grupoId, personaId);

  if (yaEsLider) {
    res.status(400).json({ error: 'Esa persona ya es líder del grupo.' });
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const anteriores = await db.prepare("SELECT DISTINCT persona_id FROM persona_grupo WHERE grupo_id = ? AND rol = 'Líder' AND activo = 1").all(grupoId);
  const antiguosLideres = anteriores.map((fila) => fila.persona_id);

  try {
    await db.transaccion(async () => {
      await db.prepare("UPDATE persona_grupo SET fecha_fin = ?, activo = 0 WHERE grupo_id = ? AND rol = 'Líder' AND activo = 1").run(hoy, grupoId);

      const miembro = await db.prepare('SELECT id FROM persona_grupo WHERE grupo_id = ? AND persona_id = ? AND activo = 1').get(grupoId, personaId);
      if (!miembro) {
        throw new Error('El nuevo líder debe ser integrante activo del grupo.');
      }

      await db.prepare("UPDATE persona_grupo SET rol = 'Líder' WHERE id = ?").run(miembro.id);
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  await actualizarRolDe(personaId);
  for (const personaAntigua of antiguosLideres) {
    await actualizarRolDe(personaAntigua);
  }

  res.json({ mensaje: 'Liderazgo transferido.' });
});

app.post('/api/redes/:id/transferir-lider', requiereSesion, requiereRol(['Administrador', 'Pastor']), async (req, res) => {
  const redId = Number(req.params.id);
  const personaId = Number(req.body.persona_id);

  if (!personaId) {
    res.status(400).json({ error: 'Debes elegir el nuevo líder.' });
    return;
  }

  if (!(await db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId))) {
    res.status(400).json({ error: 'La persona no existe.' });
    return;
  }

  if (await db.prepare('SELECT id FROM persona_red WHERE red_id = ? AND persona_id = ? AND activo = 1').get(redId, personaId)) {
    res.status(400).json({ error: 'Esa persona ya es líder de la red.' });
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const anteriores = await db.prepare('SELECT DISTINCT persona_id FROM persona_red WHERE red_id = ? AND activo = 1').all(redId);
  const antiguosLideres = anteriores.map((fila) => fila.persona_id);

  await db.transaccion(async () => {
    await db.prepare('UPDATE persona_red SET fecha_fin = ?, activo = 0 WHERE red_id = ? AND activo = 1').run(hoy, redId);
    await db.prepare('INSERT INTO persona_red (persona_id, red_id, fecha_inicio, activo) VALUES (?, ?, ?, 1)').run(personaId, redId, hoy);
  });

  await actualizarRolDe(personaId);
  for (const personaAntigua of antiguosLideres) {
    await actualizarRolDe(personaAntigua);
  }

  res.json({ mensaje: 'Liderazgo de la red transferido.' });
});

app.post('/api/login', async (req, res) => {
  const cedula = req.body.cedula;
  const contrasena = req.body.contrasena;

  if (!cedula || !contrasena) {
    res.status(400).json({ error: 'La cédula y la contraseña son obligatorias.' });
    return;
  }

  const usuario = await db.prepare('SELECT * FROM usuarios WHERE cedula = ?').get(cedula);

  if (!usuario || usuario.activo !== 1 || !bcrypt.compareSync(contrasena, usuario.password_hash)) {
    res.status(401).json({ error: 'Cédula o contraseña incorrecta.' });
    return;
  }

  await actualizarRolDe(usuario.persona_id);

  const token = crypto.randomBytes(32).toString('hex');
  await db.prepare('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)').run(token, usuario.id);

  const rolActual = (await db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuario.id)).rol;
  res.cookie('sesion', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ id: usuario.id, cedula: usuario.cedula, rol: rolActual });
});

app.get('/api/me', requiereSesion, (req, res) => {
  res.json({ id: req.usuario.id, cedula: req.usuario.cedula, rol: req.usuario.rol });
});

app.post('/api/logout', async (req, res) => {
  const token = req.cookies.sesion;
  if (token) {
    await db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
  }
  res.clearCookie('sesion');
  res.json({ mensaje: 'Sesión cerrada.' });
});

app.patch('/api/mi-contrasena', requiereSesion, async (req, res) => {
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

  const usuario = await db.prepare('SELECT id, password_hash FROM usuarios WHERE id = ?').get(req.usuario.id);

  if (!bcrypt.compareSync(contrasenaActual, usuario.password_hash)) {
    res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    return;
  }

  await db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(contrasenaNueva, 10), usuario.id);
  await db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token != ?').run(usuario.id, req.cookies.sesion);

  res.json({ mensaje: 'Contraseña actualizada.' });
});

app.get('/api/redes', requiereSesion, async (req, res) => {
  const esAdministrador = req.usuario.rol === 'Administrador' || req.usuario.rol === 'Pastor';
  const incluirInactivas = req.query.todas === '1' && esAdministrador;

  if (esAdministrador) {
    const redes = incluirInactivas
      ? await db.prepare('SELECT * FROM redes ORDER BY nombre').all()
      : await db.prepare('SELECT * FROM redes WHERE activo = 1 ORDER BY nombre').all();
    res.json(redes);
    return;
  }

  if (!req.usuario.persona_id) {
    res.json([]);
    return;
  }

  const redes = await db.prepare(`
    SELECT * FROM redes
    WHERE activo = 1
      AND id IN (
        SELECT red_id FROM persona_red WHERE persona_id = ? AND activo = 1
        UNION
        SELECT g.red_id
        FROM persona_grupo pg
        JOIN grupos g ON g.id = pg.grupo_id
        WHERE pg.persona_id = ? AND pg.activo = 1 AND g.activo = 1
      )
    ORDER BY nombre
  `).all(req.usuario.persona_id, req.usuario.persona_id);

  res.json(redes);
});

app.get('/api/grupos', requiereSesion, async (req, res) => {
  const esAdministrador = req.usuario.rol === 'Administrador' || req.usuario.rol === 'Pastor';
  const incluirInactivos = req.query.todas === '1' && esAdministrador;

  const condiciones = incluirInactivos ? [] : ['grupos.activo = 1'];

  if (!esAdministrador) {
    condiciones.push(`
      grupos.red_id IN (
        SELECT red_id FROM persona_red WHERE persona_id = ? AND activo = 1
        UNION
        SELECT g.red_id
        FROM persona_grupo pg
        JOIN grupos g ON g.id = pg.grupo_id
        WHERE pg.persona_id = ? AND pg.activo = 1 AND g.activo = 1
      )
    `);
  }

  const filtro = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  const parametros = !esAdministrador ? [req.usuario.persona_id, req.usuario.persona_id] : [];

  const grupos = await db.prepare(`
    SELECT grupos.*, redes.nombre AS red
    FROM grupos
    JOIN redes ON redes.id = grupos.red_id
    ${filtro}
    ORDER BY grupos.nombre
  `).all(...parametros);
  res.json(grupos);
});

app.get('/api/redes/:id/grupos', requiereSesion, async (req, res) => {
  const redId = Number(req.params.id);

  if (!(await puedeVerRed(redId, req.usuario))) {
    res.status(403).json({ error: 'No puedes consultar esta red.' });
    return;
  }

  const grupos = await db.prepare(`
    SELECT grupos.*, redes.nombre AS red
    FROM grupos
    JOIN redes ON redes.id = grupos.red_id
    WHERE grupos.red_id = ? AND grupos.activo = 1
    ORDER BY grupos.nombre
  `).all(redId);

  res.json(grupos);
});

app.get('/api/grupos/:id/integrantes', requiereSesion, async (req, res) => {
  const grupoId = Number(req.params.id);

  if (!(await puedeVerGrupo(grupoId, req.usuario))) {
    res.status(403).json({ error: 'No puedes consultar este grupo.' });
    return;
  }

  const integrantes = await db.prepare(`
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

app.get('/api/personas', requiereSesion, async (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) {
    const personas = await db.prepare('SELECT id, nombre_completo FROM personas ORDER BY nombre_completo').all();
    res.json(personas);
    return;
  }

  const busqueda = '%' + q + '%';
  const personas = await db.prepare(`
    SELECT p.id, p.nombre_completo, p.celular, p.activo AS persona_activo, COALESCE(p.cedula, u.cedula) AS cedula
    FROM personas p
    LEFT JOIN usuarios u ON u.persona_id = p.id
    WHERE p.nombre_completo ILIKE ? OR p.celular ILIKE ? OR p.cedula ILIKE ? OR u.cedula ILIKE ?
    ORDER BY p.nombre_completo
    LIMIT 50
  `).all(busqueda, busqueda, busqueda, busqueda);

  for (const persona of personas) {
    persona.grupos = await db.prepare(`
      SELECT g.nombre, pg.rol
      FROM persona_grupo pg
      JOIN grupos g ON g.id = pg.grupo_id
      WHERE pg.persona_id = ? AND pg.activo = 1
      ORDER BY g.nombre
    `).all(persona.id);
  }

  res.json(personas);
});

app.get('/api/grupos/:id/reuniones', requiereSesion, async (req, res) => {
  const grupoId = Number(req.params.id);

  if (!(await puedeVerGrupo(grupoId, req.usuario))) {
    res.status(403).json({ error: 'No puedes consultar este grupo.' });
    return;
  }

  const reuniones = await db.prepare(`
    SELECT * FROM reuniones
    WHERE grupo_id = ?
    ORDER BY fecha DESC
  `).all(grupoId);

  res.json(reuniones);
});

app.post('/api/grupos/:id/reuniones', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const grupoId = Number(req.params.id);

  if (req.usuario.rol !== 'Administrador') {
    if (!(await puedeVerGrupo(grupoId, req.usuario))) {
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

  const resultado = await db.prepare(`
    INSERT INTO reuniones (grupo_id, fecha, tipo, realizada, duracion, observacion)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(grupoId, fecha, tipo, realizada, duracion, observacion);

  res.status(201).json({ id: Number(resultado.lastInsertRowid), fecha, tipo, realizada, duracion, observacion });
});

app.patch('/api/reuniones/:id', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = await db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (req.usuario.rol !== 'Administrador' && !(await puedeVerGrupo(reunion.grupo_id, req.usuario))) {
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

  await db.prepare(`
    UPDATE reuniones
    SET fecha = ?, tipo = ?, realizada = ?, duracion = ?, observacion = ?
    WHERE id = ?
  `).run(fecha, tipo, realizada, duracion, observacion, reunionId);

  res.json({ mensaje: 'Reunión actualizada.' });
});

app.post('/api/reuniones/:id/anular', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = await db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (req.usuario.rol !== 'Administrador' && !(await puedeVerGrupo(reunion.grupo_id, req.usuario))) {
    res.status(403).json({ error: 'Solo puedes anular reuniones de tus propios grupos.' });
    return;
  }

  await db.prepare('UPDATE reuniones SET realizada = 0, tipo = ?, observacion = ? WHERE id = ?').run(
    'Reunión cancelada',
    [reunion.observacion, req.body.motivo].filter(Boolean).join(' · '),
    reunionId
  );

  res.json({ mensaje: 'Reunión anulada.' });
});

app.get('/api/reuniones/:id', requiereSesion, async (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = await db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (!(await puedeVerGrupo(reunion.grupo_id, req.usuario))) {
    res.status(403).json({ error: 'No puedes consultar esta reunión.' });
    return;
  }

  const integrantes = await db.prepare(`
    SELECT p.id, p.nombre_completo, pg.rol, ar.asistio
    FROM persona_grupo pg
    JOIN personas p ON p.id = pg.persona_id
    LEFT JOIN asistencia_reunion ar ON ar.reunion_id = ? AND ar.persona_id = p.id
    WHERE pg.grupo_id = ? AND pg.activo = 1
    ORDER BY CASE pg.rol WHEN 'Líder' THEN 0 WHEN 'Apoyo' THEN 1 WHEN 'Anfitrión' THEN 2 ELSE 3 END, p.nombre_completo
  `).all(reunionId, reunion.grupo_id);

  const visitantes = await db.prepare('SELECT * FROM visitantes WHERE reunion_id = ?').all(reunionId);

  res.json({ reunion, integrantes, visitantes });
});

app.post('/api/reuniones/:id/asistencia', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = await db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (req.usuario.rol !== 'Administrador' && !(await puedeVerGrupo(reunion.grupo_id, req.usuario))) {
    res.status(403).json({ error: 'Solo puedes registrar asistencia en tus propios grupos.' });
    return;
  }

  const personaId = Number(req.body.personaId);
  const persona = await db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId);

  if (!persona) {
    res.status(400).json({ error: 'La persona no existe.' });
    return;
  }

  const pertenece = await db.prepare('SELECT id FROM persona_grupo WHERE persona_id = ? AND grupo_id = ? AND activo = 1').get(personaId, reunion.grupo_id);

  if (!pertenece) {
    res.status(400).json({ error: 'La persona no es integrante activo de este grupo.' });
    return;
  }

  const asistio = req.body.asistio ? 1 : 0;

  await db.prepare(`
    INSERT INTO asistencia_reunion (reunion_id, persona_id, asistio)
    VALUES (?, ?, ?)
    ON CONFLICT (reunion_id, persona_id)
    DO UPDATE SET asistio = excluded.asistio
  `).run(reunionId, personaId, asistio);

  res.json({ ok: true, personaId, asistio });
});

app.post('/api/reuniones/:id/visitantes', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const reunionId = Number(req.params.id);
  const reunion = await db.prepare('SELECT * FROM reuniones WHERE id = ?').get(reunionId);

  if (!reunion) {
    res.status(404).json({ error: 'Reunión no encontrada.' });
    return;
  }

  if (req.usuario.rol !== 'Administrador' && !(await puedeVerGrupo(reunion.grupo_id, req.usuario))) {
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

  const resultado = await db.prepare(`
    INSERT INTO visitantes (reunion_id, nombre, telefono, observacion)
    VALUES (?, ?, ?, ?)
  `).run(reunionId, nombre, telefono, observacion);

  res.status(201).json({ id: Number(resultado.lastInsertRowid), nombre, telefono, observacion });
});

const rolesValidos = ['Líder', 'Apoyo', 'Anfitrión', 'Integrante'];

app.patch('/api/grupos/:id/integrantes/:personaId', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const grupoId = Number(req.params.id);
  const personaId = Number(req.params.personaId);

  if (req.usuario.rol !== 'Administrador') {
    if (!(await puedeVerGrupo(grupoId, req.usuario))) {
      res.status(403).json({ error: 'Solo puedes editar integrantes en tus propios grupos.' });
      return;
    }
  }

  const pertenencia = await db.prepare(
    'SELECT id FROM persona_grupo WHERE persona_id = ? AND grupo_id = ? AND activo = 1'
  ).get(personaId, grupoId);

  if (!pertenencia) {
    res.status(404).json({ error: 'La persona no es integrante activo de este grupo.' });
    return;
  }

  const rol = req.body.rol;

  if (rol && !rolesValidos.includes(rol)) {
    res.status(400).json({ error: 'El rol no es válido.' });
    return;
  }

  const nombre = req.body.nombre;

  if (!nombre) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }

  const cedula = req.body.cedula || null;
  const celular = req.body.celular || null;
  const direccion = req.body.direccion || null;

  if (cedula) {
    const duplicado = await db.prepare(`
      SELECT p.id, p.nombre_completo
      FROM personas p
      LEFT JOIN usuarios u ON u.persona_id = p.id
      WHERE p.activo = 1 AND p.id != ? AND (p.cedula = ? OR u.cedula = ?)
    `).get(personaId, cedula, cedula);

    if (duplicado) {
      res.status(409).json({ error: 'Ya existe una persona con esa cédula: ' + duplicado.nombre_completo + '.' });
      return;
    }
  }

  await db.prepare(`
    UPDATE personas SET nombre_completo = ?, cedula = ?, celular = ?, direccion = ? WHERE id = ?
  `).run(nombre, cedula, celular, direccion, personaId);

  if (rol) {
    await db.prepare('UPDATE persona_grupo SET rol = ? WHERE id = ?').run(rol, pertenencia.id);
  }

  res.json({ id: personaId, nombre, cedula, celular, direccion, rol: rol || null });
});

app.post('/api/grupos/:id/integrantes', requiereSesion, requiereRol(['Administrador', 'Pastor', 'Líder de Red', 'Líder de Grupo']), async (req, res) => {
  const grupoId = Number(req.params.id);

  if (req.usuario.rol !== 'Administrador') {
    if (!(await puedeVerGrupo(grupoId, req.usuario))) {
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
    const persona = await db.prepare('SELECT id, nombre_completo FROM personas WHERE id = ? AND activo = 1').get(personaIdExistente);

    if (!persona) {
      res.status(404).json({ error: 'La persona no existe.' });
      return;
    }

    const yaIntegrante = await db.prepare('SELECT id FROM persona_grupo WHERE persona_id = ? AND grupo_id = ? AND activo = 1').get(personaIdExistente, grupoId);

    if (yaIntegrante) {
      res.status(409).json({ error: 'Esta persona ya es integrante de este grupo.' });
      return;
    }

    await insertarPertenencia.run(personaIdExistente, grupoId, rol, hoy);
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

  const existePorCedula = cedula ? await db.prepare(`
    SELECT p.id, p.nombre_completo, p.cedula AS persona_cedula, u.cedula AS usuario_cedula
    FROM personas p
    LEFT JOIN usuarios u ON u.persona_id = p.id
    WHERE p.activo = 1 AND (p.cedula = ? OR u.cedula = ?)
  `).get(cedula, cedula) : null;

  if (existePorCedula) {
    const yaIntegrante = await db.prepare('SELECT id FROM persona_grupo WHERE persona_id = ? AND grupo_id = ? AND activo = 1').get(existePorCedula.id, grupoId);

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

  const personaId = await db.transaccion(async () => {
    const resultado = await insertarPersona.run(nombre, cedula, celular, direccion);
    const nuevaId = Number(resultado.lastInsertRowid);
    await insertarPertenencia.run(nuevaId, grupoId, rol, hoy);
    return nuevaId;
  });

  res.status(201).json({ id: personaId, nombre, cedula, celular, direccion, rol });
});

app.use((err, req, res, next) => {
  console.error('Error del servidor:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

async function iniciar() {
  await db.inicializar();
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

iniciar().catch((e) => {
  console.error('No se pudo iniciar la aplicación:', e);
  process.exit(1);
});