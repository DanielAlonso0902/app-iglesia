const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

const carpetaDb = path.join(__dirname, 'db');

if (!fs.existsSync(carpetaDb)) {
  fs.mkdirSync(carpetaDb, { recursive: true });
}

const db = new Database(path.join(carpetaDb, 'iglesia.db'));

db.pragma('foreign_keys = ON');

db.exec(fs.readFileSync(path.join(carpetaDb, 'schema.sql'), 'utf8'));

module.exports = db;

const redesExistentes = db.prepare('SELECT COUNT(*) AS total FROM redes').get().total;

if (redesExistentes === 0) {
  require('./db/seed');
}