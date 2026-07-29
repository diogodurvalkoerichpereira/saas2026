const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/database');
const { listUsers } = require('../src/modules/users/users.service');
const { listPermissions, replacePermissions } = require('../src/modules/users/users.service');
const { listClients, createClient, updateClient } = require('../src/modules/clients/clients.service');
const { financialSummary } = require('../src/modules/reports/reports.service');
const { listWork } = require('../src/modules/work/work.service');
const { moveStock } = require('../src/modules/inventory/inventory.service');
const { createSale } = require('../src/modules/sales/sales.service');

const enabled = process.env.INTEGRATION_DB === '1';

test('backup legado contém as tabelas essenciais', { skip: !enabled }, async () => {
  const [rows] = await pool.query("SELECT COUNT(*) quantidade FROM information_schema.tables WHERE table_schema = DATABASE()");
  assert.ok(Number(rows[0].quantidade) >= 62);
  for (const table of ['usuarios', 'clientes', 'produtos', 'receber', 'pagar', 'os', 'orcamentos', 'node_audit_log']) {
    const [found] = await pool.query('SELECT COUNT(*) quantidade FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table]);
    assert.equal(Number(found[0].quantidade), 1, `Tabela ausente: ${table}`);
  }
});

test('módulos consultam dados reais preservando a empresa', { skip: !enabled }, async () => {
  const users = await listUsers(1);
  const clients = await listClients(1);
  const finance = await financialSummary(1);
  const orders = await listWork('orders', 1);
  assert.ok(users.length > 0);
  assert.ok(clients.length > 0);
  assert.equal(orders.every((item) => Number(item.empresa) === 1), true);
  assert.ok(Object.hasOwn(finance, 'a_receber'));
});

test('gravações principais são compatíveis com o esquema legado', { skip: !enabled }, async () => {
  const clientId = await createClient({ nome: 'Cliente Integração', ativo: 'Sim' }, 1, 1);
  await updateClient(clientId, { telefone: '(00) 00000-0000' }, 1);
  const [products] = await pool.query("SELECT id, estoque, vendas FROM produtos WHERE empresa = 1 AND ativo = 'Sim' AND tem_estoque = 'Sim' AND estoque > 0 LIMIT 1");
  assert.ok(products[0], 'O backup precisa conter um produto disponível');
  const product = products[0];
  await moveStock({ type: 'saida', productId: product.id, quantity: 1, reason: 'Teste integrado', userId: 1, companyId: 1 });
  await moveStock({ type: 'entrada', productId: product.id, quantity: 1, reason: 'Reversão teste integrado', userId: 1, companyId: 1 });
  const sale = await createSale({ clientId, paymentMethodId: 0, dueDate: '2026-07-29', paid: false, items: [{ productId: product.id, quantity: 1 }], userId: 1, companyId: 1 });
  assert.ok(sale.id > 0);
  await pool.execute('DELETE FROM itens_venda WHERE id_venda = ? AND empresa = 1', [sale.id]);
  await pool.execute('DELETE FROM receber WHERE id = ? AND empresa = 1', [sale.id]);
  await pool.execute('UPDATE produtos SET estoque = ?, vendas = ? WHERE id = ? AND empresa = 1', [product.estoque, product.vendas, product.id]);
  await pool.execute("DELETE FROM entradas WHERE empresa = 1 AND motivo = 'Reversão teste integrado'");
  await pool.execute("DELETE FROM saidas WHERE empresa = 1 AND motivo = 'Teste integrado'");
  await pool.execute('DELETE FROM clientes WHERE id = ? AND empresa = 1', [clientId]);
});

test('permissões são gravadas sem atravessar a empresa', { skip: !enabled }, async () => {
  const [created] = await pool.execute("INSERT INTO usuarios (nome, email, senha_crip, nivel, ativo, data, empresa) VALUES ('Usuário Integração', 'integracao@example.invalid', 'hash-local', 'Comum', 'Sim', CURRENT_DATE, 1)");
  await replacePermissions(created.insertId, [1, 2, 2], 1);
  assert.deepEqual(await listPermissions(created.insertId, 1), [1, 2]);
  await pool.execute('DELETE FROM usuarios_permissoes WHERE usuario = ?', [created.insertId]);
  await pool.execute('DELETE FROM usuarios WHERE id = ? AND empresa = 1', [created.insertId]);
});

test.after(async () => {
  if (enabled) await pool.end();
});
