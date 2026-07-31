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

test('settleEntry calcula multa e juros automaticamente quando em atraso', async () => {
  const calls = [];
  const db = {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT vencimento, valor')) return [[{ vencimento: '2026-07-01', valor: 100 }]];
      if (sql.includes('FROM config')) return [[{ multa_atraso: 2, juros_atraso: 0.1 }]];
      return [{ affectedRows: 1 }];
    }
  };
  await settleEntry('receivables', 5, 4, 3, '2026-07-11', db);
  const update = calls[calls.length - 1];
  assert.match(update.sql, /SET pago = 'Sim'.*multa = \?, juros = \?, subtotal = \?/s);
  const [, , , multa, juros, subtotal] = update.params;
  assert.equal(multa, 2);
  assert.equal(juros, 1);
  assert.equal(subtotal, 103);
});

test('settleEntry não aplica encargos quando pago em dia', async () => {
  const calls = [];
  const db = {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT vencimento, valor')) return [[{ vencimento: '2026-07-15', valor: 100 }]];
      return [{ affectedRows: 1 }];
    }
  };
  await settleEntry('receivables', 5, 4, 3, '2026-07-15', db);
  assert.equal(calls.some((call) => call.sql.includes('FROM config')), false);
  const update = calls[calls.length - 1];
  const [, , , multa, juros, subtotal] = update.params;
  assert.equal(multa, 0);
  assert.equal(juros, 0);
  assert.equal(subtotal, 100);
});
