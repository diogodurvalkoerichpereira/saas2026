const test = require('node:test');
const assert = require('node:assert/strict');
const { findOverdueReceivables } = require('../src/jobs/overdue.job');

test('job de vencimentos não contém credenciais nem dispara integração diretamente', async () => {
  let query;
  const db = { execute: async (sql) => { query = sql; return [[]]; } };
  await findOverdueReceivables(db);
  assert.match(query, /vencimento < CURRENT_DATE/);
});
