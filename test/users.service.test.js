const test = require('node:test');
const assert = require('node:assert/strict');
const { listUsers, listPermissions, tenantClause } = require('../src/modules/users/users.service');

test('tenantClause separa empresa e administração SaaS', () => {
  assert.deepEqual(tenantClause(7), { sql: 'empresa = ?', params: [7] });
  assert.deepEqual(tenantClause(0), { sql: '(empresa = 0 OR empresa IS NULL)', params: [] });
});

test('listUsers sempre limita a consulta à empresa autenticada', async () => {
  const calls = [];
  const db = { execute: async (sql, params) => { calls.push({ sql, params }); return [[{ id: 1 }]]; } };
  assert.deepEqual(await listUsers(12, db), [{ id: 1 }]);
  assert.match(calls[0].sql, /WHERE empresa = \?/);
  assert.deepEqual(calls[0].params, [12]);
});

test('listPermissions rejeita usuário fora da empresa', async () => {
  const db = { execute: async () => [[]] };
  await assert.rejects(() => listPermissions(99, 12, db), (error) => error.status === 404);
});

test('listPermissions usa a tabela correta por contexto', async () => {
  const sql = [];
  const db = { execute: async (query) => { sql.push(query); return sql.length % 2 ? [[{ id: 7 }]] : [[{ permissao: 4 }]]; } };
  assert.deepEqual(await listPermissions(7, 3, db), [4]);
  assert.match(sql[1], /usuarios_permissoes /);
  sql.length = 0;
  assert.deepEqual(await listPermissions(7, 0, db), [4]);
  assert.match(sql[1], /usuarios_permissoes_sas/);
});
