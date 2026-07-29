const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTransition, configFor, listWork, updateStatus } = require('../src/modules/work/work.service');

test('listWork filtra por empresa e status', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [[]]; } };
  await listWork('orders', 6, 'Aberta', db);
  assert.deepEqual(call.params, [6, 'Aberta']);
  assert.match(call.sql, /FROM os WHERE empresa = \? AND status = \?/);
});

test('updateStatus rejeita transição com status desconhecido', async () => {
  await assert.rejects(() => updateStatus('quotes', 1, 'Entregue', 2, {}), (error) => error.status === 400);
});

test('transições de OS e orçamento bloqueiam saltos inválidos', () => {
  assert.doesNotThrow(() => assertTransition(configFor('orders'), 'Finalizada', 'Entregue'));
  assert.throws(() => assertTransition(configFor('orders'), 'Entregue', 'Aberta'), (error) => error.status === 409);
  assert.doesNotThrow(() => assertTransition(configFor('quotes'), 'Reprovado', 'Pendente'));
  assert.throws(() => assertTransition(configFor('quotes'), 'Aprovado', 'Pendente'), (error) => error.status === 409);
});
