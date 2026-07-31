const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTransition, configFor, listWork, updateStatus, loadTextDefaults } = require('../src/modules/work/work.service');

test('listWork filtra por empresa e status', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [[]]; } };
  await listWork('orders', 6, 'Aberta', null, db);
  assert.deepEqual(call.params, [6, 'Aberta']);
  assert.match(call.sql, /FROM os WHERE empresa = \? AND status = \?/);
});

test('listWork restringe a ordens do responsável quando mostrar_registros é Não', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [[]]; } };
  await listWork('orders', 6, null, 42, db);
  assert.deepEqual(call.params, [6, 42, 42]);
  assert.match(call.sql, /AND \(funcionario = \? OR tecnico = \?\)/);
});

test('updateStatus rejeita transição com status desconhecido', async () => {
  await assert.rejects(() => updateStatus('quotes', 1, 'Entregue', 2, {}), (error) => error.status === 400);
});

test('loadTextDefaults busca as colunas com sufixo correto por tipo', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [[{ defeito: 'Padrão OS' }]]; } };
  const defaults = await loadTextDefaults('orders', 6, db);
  assert.match(call.sql, /mao_obra_os AS mao_obra_texto/);
  assert.match(call.sql, /laudo_os AS laudo/);
  assert.deepEqual(call.params, [6]);
  assert.equal(defaults.defeito, 'Padrão OS');

  await loadTextDefaults('quotes', 6, db);
  assert.match(call.sql, /mao_obra_orc AS mao_obra_texto/);
});

test('transições de OS e orçamento bloqueiam saltos inválidos', () => {
  assert.doesNotThrow(() => assertTransition(configFor('orders'), 'Finalizada', 'Entregue'));
  assert.throws(() => assertTransition(configFor('orders'), 'Entregue', 'Aberta'), (error) => error.status === 409);
  assert.doesNotThrow(() => assertTransition(configFor('quotes'), 'Reprovado', 'Pendente'));
  assert.throws(() => assertTransition(configFor('quotes'), 'Aprovado', 'Pendente'), (error) => error.status === 409);
});
