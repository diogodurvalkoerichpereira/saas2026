const test = require('node:test');
const assert = require('node:assert/strict');
const { moveStock } = require('../src/modules/inventory/inventory.service');

function fakeDb(stock) {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push('begin'), commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback'), release: () => calls.push('release'),
    execute: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith('SELECT')) return [[{ id: 1, estoque: stock, tem_estoque: 'Sim' }]]; return [{ affectedRows: 1 }]; }
  };
  return { db: { getConnection: async () => connection }, calls };
}

test('saída atualiza estoque e registra movimento na mesma transação', async () => {
  const { db, calls } = fakeDb(10);
  await moveStock({ type: 'saida', productId: 1, quantity: 3, reason: 'Venda', userId: 2, companyId: 4 }, db);
  assert.ok(calls.some((call) => call.sql?.includes('estoque = estoque + ?') && call.params[0] === -3));
  assert.ok(calls.includes('commit'));
});

test('saída rejeita estoque negativo e desfaz transação', async () => {
  const { db, calls } = fakeDb(1);
  await assert.rejects(() => moveStock({ type: 'saida', productId: 1, quantity: 2, reason: 'Venda', userId: 2, companyId: 4 }, db), (error) => error.status === 409);
  assert.ok(calls.includes('rollback'));
});
