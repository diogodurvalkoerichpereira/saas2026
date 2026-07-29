const test = require('node:test');
const assert = require('node:assert/strict');
const { createRepository } = require('../src/modules/catalog/catalog.repository');

test('repositório de catálogo sempre filtra alterações por empresa', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [{ affectedRows: 1 }]; } };
  const repository = createRepository({ table: 'servicos', fields: ['nome', 'valor'] });
  await repository.update(4, { valor: 90 }, 2, db);
  assert.match(call.sql, /WHERE id = \? AND empresa = \?/);
  assert.deepEqual(call.params, [90, 4, 2]);
});
