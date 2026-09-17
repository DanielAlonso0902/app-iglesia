const express = require('express');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

app.get('/api/estado', (req, res) => {
  res.json({
    mensaje: 'El servidor está funcionando',
    hora: new Date().toISOString()
  });
});

app.get('/api/redes', (req, res) => {
  const redes = db.prepare('SELECT * FROM redes ORDER BY nombre').all();
  res.json(redes);
});

app.get('/api/grupos', (req, res) => {
  const grupos = db.prepare(`
    SELECT grupos.*, redes.nombre AS red
    FROM grupos
    JOIN redes ON redes.id = grupos.red_id
    ORDER BY grupos.nombre
  `).all();
  res.json(grupos);
});

app.get('/api/redes/:id/grupos', (req, res) => {
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

app.get('/api/grupos/:id/integrantes', (req, res) => {
  const grupoId = Number(req.params.id);

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

app.post('/api/grupos/:id/integrantes', (req, res) => {
  const grupoId = Number(req.params.id);
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