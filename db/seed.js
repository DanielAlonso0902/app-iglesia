const db = require('../db');
const { sembrar } = require('./sembrar');

(async () => {
  const creado = await sembrar();
  console.log(creado ? 'Datos de ejemplo creados correctamente.' : 'La base de datos ya tiene datos. Nada que hacer.');

  const historial = await db.prepare(`
    SELECT personas.nombre_completo, grupos.nombre AS grupo, persona_grupo.rol, persona_grupo.fecha_inicio, persona_grupo.fecha_fin, persona_grupo.activo
    FROM persona_grupo
    JOIN personas ON personas.id = persona_grupo.persona_id
    JOIN grupos ON grupos.id = persona_grupo.grupo_id
    ORDER BY personas.nombre_completo, persona_grupo.fecha_inicio
  `).all();
  console.log('\nHistorial de participacion (persona | grupo | rol | inicio | fin | activo):');
  historial.forEach((fila) =>
    console.log(fila.nombre_completo + ' | ' + fila.grupo + ' | ' + fila.rol + ' | ' + fila.fecha_inicio + ' | ' + fila.fecha_fin + ' | ' + fila.activo)
  );

  const formacion = await db.prepare(`
    SELECT personas.nombre_completo, proceso_formacion.etapa, proceso_formacion.promedio, proceso_formacion.activo
    FROM proceso_formacion
    JOIN personas ON personas.id = proceso_formacion.persona_id
    ORDER BY personas.nombre_completo, proceso_formacion.etapa
  `).all();
  console.log('\nFormacion (persona | etapa | promedio | activo):');
  formacion.forEach((fila) =>
    console.log(fila.nombre_completo + ' | ' + fila.etapa + ' | ' + fila.promedio + ' | ' + fila.activo)
  );

  db.pool.end();
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});