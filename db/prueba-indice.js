const db = require('../db');

try {
  db.prepare("INSERT INTO proceso_formacion (persona_id, etapa, promedio, fecha_inicio, activo) VALUES (2, 'Discípulo S3', 3.0, '2026-01-01', 1)").run();
  console.log('ERROR: la base permitio dos etapas activas para Ana');
} catch (e) {
  console.log('Bien: base rechazo la segunda etapa activa ->', e.message.slice(0, 60));
}

const filas = db.prepare('SELECT id, etapa, activo FROM proceso_formacion WHERE persona_id = 2').all();
console.log('Filas de Ana:', JSON.stringify(filas));

db.close();