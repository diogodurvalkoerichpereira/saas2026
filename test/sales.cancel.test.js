const test = require('node:test');
const assert = require('node:assert/strict');
const { cancelSale } = require('../src/modules/sales/sales.service');

test('cancelSale restaura estoque e marca venda como cancelada na mesma transação', async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    execute: async (sql) => {
      calls.push(sql);
      if (sql.startsWith('SELECT id')) return [[{ id: 9, node_status: 'ativo' }]];
      if (sql.startsWith('SELECT produto')) return [[{ produto: 2, quantidade: 3 }]];
      return [{ affectedRows: 1 }];
    }
  };
  await cancelSale(9, 1, 7, 'Erro de lançamento', { getConnection: async () => connection });
  assert.ok(calls.some((sql) => typeof sql === 'string' && sql.includes('estoque + ?')));
  assert.ok(calls.includes('commit'));
});
