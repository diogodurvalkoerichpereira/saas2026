const test = require('node:test');
const assert = require('node:assert/strict');
const { listClients, updateClient } = require('../src/modules/clients/clients.service');

test('listClients limita resultados à empresa autenticada', async () => {
  let params;
  const db = { execute: async (_sql, values) => { params = values; return [[]]; } };
  await listClients(9, null, db);
  assert.deepEqual(params, [9]);
});

test('listClients restringe ao usuário quando mostrar_registros é Não', async () => {
  let call;
  const db = { execute: async (sql, values) => { call = { sql, values }; return [[]]; } };
  await listClients(9, 42, db);
  assert.match(call.sql, /AND usuario = \?/);
  assert.deepEqual(call.values, [9, 42]);
});

test('updateClient inclui empresa no filtro de alteração', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [{ affectedRows: 1 }]; } };
  await updateClient(3, { nome: 'Cliente atualizado' }, 9, db);
  assert.match(call.sql, /WHERE id = \? AND empresa = \?/);
  assert.deepEqual(call.params, ['Cliente atualizado', 3, 9]);
});

test('updateClient acusa registro fora da empresa', async () => {
  const db = { execute: async () => [{ affectedRows: 0 }] };
  await assert.rejects(() => updateClient(3, { nome: 'Outro' }, 9, db), (error) => error.status === 404);
});
