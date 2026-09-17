const express = require('express');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(express.static('public'));

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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});