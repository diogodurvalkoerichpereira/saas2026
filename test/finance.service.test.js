const test = require('node:test');
const assert = require('node:assert/strict');
const { tableFor, listEntries, settleEntry } = require('../src/modules/finance/finance.service');

test('tableFor separa tabelas do SaaS e das empresas', () => {
  assert.equal(tableFor('payables', 2), 'pagar');
  assert.equal(tableFor('receivables', 0), 'receber_sas');
});

test('listEntries aplica empresa e filtros parametrizados', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [[]]; } };
  await listEntries('receivables', 4, { paid: 'Não', from: '2026-01-01' }, db);
  assert.deepEqual(call.params, [4, 'Não', '2026-01-01']);
});

test('settleEntry impede baixa duplicada', async () => {
  const db = { execute: async () => [{ affectedRows: 0 }] };
  await assert.rejects(() => settleEntry('payables', 1, 2, 3, '2026-07-29', db), (error) => error.status === 409);
});
