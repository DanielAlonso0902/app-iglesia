const db = require('../db');
const bcrypt = require('bcryptjs');

async function sembrar() {
  const conteo = await db.prepare('SELECT COUNT(*) AS total FROM redes').get();
  if (conteo.total > 0) return false;

  const insertarRed = db.prepare('INSERT INTO redes (nombre) VALUES (?)');
  const insertarGrupo = db.prepare(
    'INSERT INTO grupos (nombre, red_id, dia_habitual, hora_habitual, duracion_habitual, direccion, barrio, ciudad) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertarPersona = db.prepare(
    'INSERT INTO personas (nombre_completo, fecha_nacimiento, sexo, celular, estado_civil, bautizado, es_nuevo, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertarPersonaGrupo = db.prepare(
    'INSERT INTO persona_grupo (persona_id, grupo_id, rol, fecha_inicio, fecha_fin, activo) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertarPersonaRed = db.prepare(
    'INSERT INTO persona_red (persona_id, red_id, fecha_inicio, activo) VALUES (?, ?, ?, 1)'
  );
  const insertarFormacion = db.prepare(
    'INSERT INTO proceso_formacion (persona_id, etapa, promedio, fecha_inicio, fecha_fin, activo) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertarUsuario = db.prepare(
    'INSERT INTO usuarios (cedula, password_hash, rol, persona_id, activo) VALUES (?, ?, ?, ?, 1)'
  );

  const nombresRedes = ['Jóvenes', 'Caballeros', 'Damas', 'Parejas', 'Niños', 'Adolescentes'];
  for (const nombre of nombresRedes) {
    await insertarRed.run(nombre);
  }

  const redJovenes = (await db.prepare("SELECT id FROM redes WHERE nombre = 'Jóvenes'").get()).id;
  const redParejas = (await db.prepare("SELECT id FROM redes WHERE nombre = 'Parejas'").get()).id;

  const grupo100 = (await insertarGrupo.run('Grupo #100', redJovenes, 'Sábado', '5:30 PM', '1 hora 45 minutos', 'Carrera 30 #45-10', 'Manuela Beltrán', 'Bogotá')).lastInsertRowid;
  const grupo200 = (await insertarGrupo.run('Grupo #200', redParejas, 'Viernes', '7:00 PM', '1 hora 30 minutos', 'Calle 10 #5-20', 'El Prado', 'Bogotá')).lastInsertRowid;

  const carlos = (await insertarPersona.run('Carlos Pérez', '1990-03-15', 'Masculino', '3105550101', 'Casado', 1, 0, 1)).lastInsertRowid;
  const ana = (await insertarPersona.run('Ana Gómez', '1995-07-22', 'Femenino', '3205550202', 'Soltera', 1, 1, 1)).lastInsertRowid;
  const maria = (await insertarPersona.run('María Ramírez', '1992-11-30', 'Femenino', '3005550303', 'Casada', 1, 0, 1)).lastInsertRowid;
  const laura = (await insertarPersona.run('Laura Torres', '1998-04-12', 'Femenino', '3105550404', 'Soltera', 1, 1, 1)).lastInsertRowid;

  await insertarPersonaGrupo.run(carlos, grupo200, 'Líder', '2026-01-15', null, 1);
  await insertarPersonaGrupo.run(carlos, grupo100, 'Integrante', '2025-02-01', '2025-12-31', 0);
  await insertarPersonaGrupo.run(ana, grupo100, 'Apoyo', '2026-02-10', null, 1);

  await insertarPersonaRed.run(maria, redJovenes, '2026-01-10');

  await insertarPersonaRed.run(carlos, redParejas, '2026-01-15');
  await insertarPersonaGrupo.run(laura, grupo200, 'Integrante', '2026-02-05', null, 1);
  await insertarPersonaGrupo.run(maria, grupo100, 'Integrante', '2026-03-01', null, 1);

  await insertarFormacion.run(carlos, 'Discípulo S4', 4.5, '2025-08-01', null, 1);
  await insertarFormacion.run(ana, 'Discípulo S2', null, '2026-03-01', null, 1);
  await insertarFormacion.run(maria, 'Bendición N3', 4.8, '2025-01-15', '2025-12-10', 0);
  await insertarFormacion.run(maria, 'Ministerio de la Misericordia', null, '2026-01-15', null, 1);

  await insertarUsuario.run('1000000001', bcrypt.hashSync('admin123', 10), 'Administrador', null);
  await insertarUsuario.run('1023456789', bcrypt.hashSync('carlos123', 10), 'Líder de Grupo', carlos);
  await insertarUsuario.run('1034567890', bcrypt.hashSync('maria123', 10), 'Líder de Red', maria);

  return true;
}

module.exports = { sembrar };