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

app.get('/api/personas', (req, res) => {
  const personas = db.prepare('SELECT * FROM personas ORDER BY nombre_completo').all();
  res.json(personas);
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});