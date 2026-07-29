const test = require('node:test');
const assert = require('node:assert/strict');
const { listWork, updateStatus } = require('../src/modules/work/work.service');

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
