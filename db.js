const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const { Pool, types } = require('pg');

function cargarEnv() {
  const archivo = path.join(__dirname, '.env');
  if (!fs.existsSync(archivo)) return;
  const lineas = fs.readFileSync(archivo, 'utf8').split(/\r?\n/);
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const separador = limpia.indexOf('=');
    if (separador === -1) continue;
    const clave = limpia.slice(0, separador).trim();
    const valor = limpia.slice(separador + 1).trim();
    if (!process.env[clave]) {
      process.env[clave] = valor;
    }
  }
}

cargarEnv();

if (!process.env.DATABASE_URL) {
  console.error('Falta la variable DATABASE_URL. Crea un archivo .env con DATABASE_URL=postgresql://...');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

types.setTypeParser(20, (valor) => Number.parseInt(valor, 10));

const almacen = new AsyncLocalStorage();

function convertirParametros(sql) {
  let indice = 0;
  return sql.replace(/\?/g, () => '$' + (++indice));
}

function preparar(sql) {
  return {
    async get(...params) {
      const cliente = almacen.getStore();
      const res = cliente
        ? await cliente.query(convertirParametros(sql), params)
        : await pool.query(convertirParametros(sql), params);
      return res.rows[0] ?? undefined;
    },

    async all(...params) {
      const cliente = almacen.getStore();
      const res = cliente
        ? await cliente.query(convertirParametros(sql), params)
        : await pool.query(convertirParametros(sql), params);
      return res.rows;
    },

    async run(...params) {
      const cliente = almacen.getStore();
      const esInsercion = /^\s*INSERT INTO/i.test(sql);
      const texto = esInsercion ? sql + ' RETURNING id' : sql;
      try {
        const res = cliente
          ? await cliente.query(convertirParametros(texto), params)
          : await pool.query(convertirParametros(texto), params);
        return {
          lastInsertRowid: res.rows && res.rows[0] ? Number(res.rows[0].id) : 0,
          changes: res.rowCount
        };
      } catch (e) {
        if (esInsercion && e.code === '42703' && /column "id" does not exist/.test(e.message)) {
          const res = cliente
            ? await cliente.query(convertirParametros(sql), params)
            : await pool.query(convertirParametros(sql), params);
          return {
            lastInsertRowid: res.rows && res.rows[0] ? Number(res.rows[0].id) : 0,
            changes: res.rowCount
          };
        }
        throw e;
      }
    }
  };
}

async function transaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await almacen.run(cliente, fn);
    await cliente.query('COMMIT');
    return resultado;
  } catch (e) {
    try {
      await cliente.query('ROLLBACK');
    } catch (_) {}
    throw e;
  } finally {
    cliente.release();
  }
}

async function migrar() {
  await pool.query(`
    ALTER TABLE personas
      ADD COLUMN IF NOT EXISTS en_discipulado INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS nivel_discipulado TEXT
  `);
}

async function inicializar() {
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  await migrar();
  const { sembrar } = require('./db/sembrar');
  await sembrar();
}

module.exports = {
  prepare: preparar,
  transaccion,
  inicializar,
  pool
};