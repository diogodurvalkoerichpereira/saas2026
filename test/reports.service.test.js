const test = require('node:test');
const assert = require('node:assert/strict');
const {
  financialSummary, topProductsReport, annualBalanceReport, syntheticPayablesReport, syntheticReceivablesReport
} = require('../src/modules/reports/reports.service');

test('financialSummary consulta recebimentos e pagamentos da mesma empresa', async () => {
  const params = [];
  const db = { execute: async (_sql, values) => { params.push(values); return [[params.length === 1 ? { recebido: 10, a_receber: 5 } : { pago: 3, a_pagar: 2 }]]; } };
  assert.deepEqual(await financialSummary(8, db), { recebido: 10, a_receber: 5, pago: 3, a_pagar: 2 });
  assert.deepEqual(params, [[8], [8]]);
});

test('financialSummary usa tabelas administrativas para empresa zero', async () => {
  const queries = [];
  const db = { execute: async (sql) => { queries.push(sql); return [[{}]]; } };
  await financialSummary(0, db);
  assert.match(queries[0], /FROM receber_sas/);
  assert.match(queries[1], /FROM pagar_sas/);
});

test('topProductsReport agrupa itens de venda por produto no período', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [[]]; } };
  await topProductsReport(4, { from: '2026-01-01', to: '2026-01-31' }, db);
  assert.match(call.sql, /GROUP BY p\.id, p\.codigo, p\.nome/);
  assert.deepEqual(call.params, [4, '2026-01-01', '2026-01-31']);
});

test('annualBalanceReport preenche os 12 meses mesmo sem lançamentos', async () => {
  const db = { execute: async () => [[{ mes: 3, total: 150 }]] };
  const rows = await annualBalanceReport(4, 2026, db);
  assert.equal(rows.length, 12);
  assert.deepEqual(rows[2], { mes: 3, receitas: 150, despesas: 150, saldo: 0 });
  assert.deepEqual(rows[0], { mes: 1, receitas: 0, despesas: 0, saldo: 0 });
});

test('syntheticPayablesReport agrupa despesas por plano de contas', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [[]]; } };
  await syntheticPayablesReport(4, { from: '2026-01-01', to: '2026-01-31' }, db);
  assert.match(call.sql, /LEFT JOIN plano_contas/);
  assert.deepEqual(call.params, [4, '2026-01-01', '2026-01-31']);
});

test('syntheticReceivablesReport agrupa recebíveis por referência', async () => {
  let call;
  const db = { execute: async (sql, params) => { call = { sql, params }; return [[]]; } };
  await syntheticReceivablesReport(4, { from: '2026-01-01', to: '2026-01-31' }, db);
  assert.match(call.sql, /GROUP BY categoria/);
  assert.deepEqual(call.params, [4, '2026-01-01', '2026-01-31']);
});
