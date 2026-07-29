const test = require('node:test');
const assert = require('node:assert/strict');
const { createSale, money } = require('../src/modules/sales/sales.service');

test('money converte valores para centavos sem acumular ponto flutuante', () => assert.equal(money('10.99'), 1099));

test('createSale cria recebível, itens e baixa estoque atomicamente', async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push('begin'), commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback'), release: () => calls.push('release'),
    execute: async (sql, params) => { calls.push({ sql, params }); if (sql.startsWith('SELECT')) return [[{ id: 1, valor_venda: '10.50', valor_compra: '5.00', estoque: 5, tem_estoque: 'Sim' }]]; if (sql.startsWith('INSERT INTO receber')) return [{ insertId: 77 }]; return [{ affectedRows: 1 }]; }
  };
  const result = await createSale({ clientId: 1, paymentMethodId: 2, dueDate: '2026-07-29', paid: true, items: [{ productId: 1, quantity: 2 }], userId: 3, companyId: 4 }, { getConnection: async () => connection });
  assert.deepEqual(result, { id: 77, total: '21.00' });
  assert.ok(calls.includes('commit'));
});
