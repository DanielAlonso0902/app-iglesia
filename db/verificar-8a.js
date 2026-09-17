const db = require('../db');
const bcrypt = require('bcryptjs');

const admin = db.prepare('SELECT cedula, rol, password_hash FROM usuarios WHERE cedula = ?').get('1000000001');

console.log('Cedula del admin:', admin.cedula);
console.log('Rol:', admin.rol);
console.log('Hash almacenado:', admin.password_hash);
console.log('----------------------------');
console.log('bcrypt.compareSync("admin123", hash) =>', bcrypt.compareSync('admin123', admin.password_hash));
console.log('bcrypt.compareSync("otra", hash) =>', bcrypt.compareSync('otra', admin.password_hash));

const carlos = db.prepare('SELECT u.cedula, u.rol, p.nombre_completo FROM usuarios u LEFT JOIN personas p ON p.id = u.persona_id WHERE u.cedula = ?').get('1023456789');
console.log('Usuario Líder de Grupo vinculado a:', carlos.nombre_completo);

db.close();