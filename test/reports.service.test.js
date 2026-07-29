const test = require('node:test');
const assert = require('node:assert/strict');
const { financialSummary } = require('../src/modules/reports/reports.service');

test('financialSummary consulta recebimentos e pagamentos da mesma empresa', async () => {
  const params = [];
  const db = { execute: async (_sql, values) => { params.push(values); return [[params.length === 1 ? { recebido: 10, a_receber: 5 } : { pago: 3, a_pagar: 2 }]]; } };
  assert.deepEqual(await financialSummary(8, db), { recebido: 10, a_receber: 5, pago: 3, a_pagar: 2 });
  assert.deepEqual(params, [[8], [8]]);
});
