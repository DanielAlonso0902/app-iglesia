const db = require('../db');
const bcrypt = require('bcryptjs');

const yaTieneDatos = db.prepare('SELECT COUNT(*) AS total FROM redes').get().total > 0;

if (yaTieneDatos) {
  console.log('La base de datos ya tiene datos. Nada que hacer.');
  process.exit(0);
}

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
nombresRedes.forEach((nombre) => insertarRed.run(nombre));

const redJovenes = db.prepare("SELECT id FROM redes WHERE nombre = 'Jóvenes'").get().id;
const redParejas = db.prepare("SELECT id FROM redes WHERE nombre = 'Parejas'").get().id;

const resultadoGrupo100 = insertarGrupo.run('Grupo #100', redJovenes, 'Sábado', '5:30 PM', '1 hora 45 minutos', 'Carrera 30 #45-10', 'Manuela Beltrán', 'Bogotá');
const grupo100 = Number(resultadoGrupo100.lastInsertRowid);

const resultadoGrupo200 = insertarGrupo.run('Grupo #200', redParejas, 'Viernes', '7:00 PM', '1 hora 30 minutos', 'Calle 10 #5-20', 'El Prado', 'Bogotá');
const grupo200 = Number(resultadoGrupo200.lastInsertRowid);

const resultadoCarlos = insertarPersona.run('Carlos Pérez', '1990-03-15', 'Masculino', '3105550101', 'Casado', 1, 0, 1);
const carlos = Number(resultadoCarlos.lastInsertRowid);

const resultadoAna = insertarPersona.run('Ana Gómez', '1995-07-22', 'Femenino', '3205550202', 'Soltera', 1, 1, 1);
const ana = Number(resultadoAna.lastInsertRowid);

const resultadoMaria = insertarPersona.run('María Ramírez', '1992-11-30', 'Femenino', '3005550303', 'Casada', 1, 0, 1);
const maria = Number(resultadoMaria.lastInsertRowid);

const resultadoLaura = insertarPersona.run('Laura Torres', '1998-04-12', 'Femenino', '3105550404', 'Soltera', 1, 1, 1);
const laura = Number(resultadoLaura.lastInsertRowid);

insertarPersonaGrupo.run(carlos, grupo200, 'Líder', '2026-01-15', null, 1);
insertarPersonaGrupo.run(carlos, grupo100, 'Integrante', '2025-02-01', '2025-12-31', 0);
insertarPersonaGrupo.run(ana, grupo100, 'Apoyo', '2026-02-10', null, 1);

insertarPersonaRed.run(maria, redJovenes, '2026-01-10');

insertarFormacion.run(carlos, 'Discípulo S4', 4.5, '2025-08-01', null, 1);
insertarFormacion.run(ana, 'Discípulo S2', null, '2026-03-01', null, 1);
insertarFormacion.run(maria, 'Bendición N3', 4.8, '2025-01-15', '2025-12-10', 0);
insertarFormacion.run(maria, 'Ministerio de la Misericordia', null, '2026-01-15', null, 1);

insertarUsuario.run('1000000001', bcrypt.hashSync('admin123', 10), 'Administrador', null);
insertarUsuario.run('1023456789', bcrypt.hashSync('carlos123', 10), 'Líder de Grupo', carlos);
insertarUsuario.run('1034567890', bcrypt.hashSync('maria123', 10), 'Líder de Red', maria);

if (require.main === module) {
  console.log('Datos de ejemplo creados correctamente.');

  const consultaHistorial = db.prepare(`
    SELECT personas.nombre_completo, grupos.nombre AS grupo, persona_grupo.rol, persona_grupo.fecha_inicio, persona_grupo.fecha_fin, persona_grupo.activo
    FROM persona_grupo
    JOIN personas ON personas.id = persona_grupo.persona_id
    JOIN grupos ON grupos.id = persona_grupo.grupo_id
    ORDER BY personas.nombre_completo, persona_grupo.fecha_inicio
  `);
  console.log('\nHistorial de participacion (persona | grupo | rol | inicio | fin | activo):');
  consultaHistorial.all().forEach((fila) =>
    console.log(fila.nombre_completo + ' | ' + fila.grupo + ' | ' + fila.rol + ' | ' + fila.fecha_inicio + ' | ' + fila.fecha_fin + ' | ' + fila.activo)
  );

  const consultaFormacion = db.prepare(`
    SELECT personas.nombre_completo, proceso_formacion.etapa, proceso_formacion.promedio, proceso_formacion.activo
    FROM proceso_formacion
    JOIN personas ON personas.id = proceso_formacion.persona_id
    ORDER BY personas.nombre_completo, proceso_formacion.etapa
  `);
  console.log('\nFormacion (persona | etapa | promedio | activo):');
  consultaFormacion.all().forEach((fila) =>
    console.log(fila.nombre_completo + ' | ' + fila.etapa + ' | ' + fila.promedio + ' | ' + fila.activo)
  );

  db.close();
}