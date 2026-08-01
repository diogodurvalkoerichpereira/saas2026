'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { rawPool } = require('./database');

// Aplicador de migrações idempotente, rodado no start. Cada arquivo db/migrations/*.sql roda uma
// única vez, registrado em node_schema_migrations. Isso faz o deploy se auto-corrigir: subir o
// código novo aplica as colunas que ele precisa, sem SQL manual na VPS.
//
// O baseline (db/001-schema.sql) NÃO entra aqui — ele é aplicado uma vez ao criar o banco. As
// migrações são só os incrementos a partir dele.

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');

async function runMigrations({ logger = console } = {}) {
  if (!fs.existsSync(MIGRATIONS_DIR)) return { applied: [] };
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort();
  if (!files.length) return { applied: [] };

  const client = await rawPool.connect();
  const applied = [];
  try {
    await client.query('CREATE TABLE IF NOT EXISTS node_schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const { rows } = await client.query('SELECT name FROM node_schema_migrations');
    const done = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      // Cada migração roda numa transação: ou aplica inteira e registra, ou não deixa rastro.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO node_schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        logger.log(`[migrate] aplicada: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error(`Falha na migração ${file}: ${error.message}`), { cause: error });
      }
    }
  } finally {
    client.release();
  }
  return { applied };
}

module.exports = { runMigrations };
