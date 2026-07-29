const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/database');

const baseUrl = process.env.E2E_BASE_URL;
const enabled = Boolean(baseUrl);
let token;
let createdClientId;
let createdOrderId;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${response.status} ${payload?.error || path}`);
  return payload;
}

test('login local abre uma sessão válida', { skip: !enabled }, async () => {
  const result = await request('/api/auth/login', { method: 'POST', body: { email: 'teste.local@saas2026.local', password: 'Teste@2026' } });
  token = result.token;
  assert.equal(result.user.companyId, 1);
});

test('todos os módulos visíveis respondem ao usuário autenticado', { skip: !enabled }, async () => {
  const paths = [
    '/api/reports/financial', '/api/reports/operational', '/api/clients?pageSize=5', '/api/users?pageSize=5',
    '/api/catalog/suppliers?pageSize=5', '/api/catalog/products?pageSize=5', '/api/catalog/services?pageSize=5',
    '/api/inventory/movements?pageSize=5', '/api/finance/receivables?pageSize=5', '/api/finance/payables?pageSize=5', '/api/finance/payment-methods?pageSize=5',
    '/api/sales?pageSize=5', '/api/work/orders?pageSize=5', '/api/work/quotes?pageSize=5'
  ];
  for (const path of paths) assert.ok(await request(path), path);
});

test('CRUD de cliente funciona da interface até o MySQL', { skip: !enabled }, async () => {
  const created = await request('/api/clients', { method: 'POST', body: { nome: 'Cliente E2E Temporário', telefone: '' } });
  createdClientId = created.id;
  assert.equal((await request(`/api/clients/${createdClientId}`)).ativo, 'Sim');
  await request(`/api/clients/${createdClientId}`, { method: 'PATCH', body: { cidade: 'Cidade E2E' } });
  const updated = await request(`/api/clients/${createdClientId}`);
  assert.equal(updated.cidade, 'Cidade E2E');
  await request(`/api/clients/${createdClientId}`, { method: 'DELETE', body: { reason: 'Teste automatizado' } });
  assert.equal((await request(`/api/clients/${createdClientId}`)).ativo, 'Não');
  await request(`/api/clients/${createdClientId}/restore`, { method: 'POST', body: {} });
  assert.equal((await request(`/api/clients/${createdClientId}`)).ativo, 'Sim');
});

test('ordem de serviço mantém itens e transições válidas', { skip: !enabled }, async () => {
  const [products] = await pool.execute("SELECT id FROM produtos WHERE empresa = 1 AND ativo = 'Sim' LIMIT 1");
  const [services] = await pool.execute("SELECT id FROM servicos WHERE empresa = 1 AND ativo = 'Sim' LIMIT 1");
  const created = await request('/api/work/orders', {
    method: 'POST',
    body: {
      cliente: 1,
      data_entrega: '2026-07-30',
      status: 'Aberta',
      valor: 0,
      equipamento: 'Equipamento de teste',
      items: [
        { kind: 'product', itemId: products[0].id, quantity: 2 },
        { kind: 'service', itemId: services[0].id, quantity: 1 }
      ]
    }
  });
  createdOrderId = created.id;
  const work = await request(`/api/work/orders/${createdOrderId}`);
  assert.equal(work.items.length, 2);
  assert.equal(Number(work.total_produtos) > 0, true);
  assert.equal(Number(work.total_servicos) > 0, true);
  await request(`/api/work/orders/${createdOrderId}/status`, { method: 'PATCH', body: { status: 'Iniciada' } });
  assert.equal((await request(`/api/work/orders/${createdOrderId}`)).status, 'Iniciada');
});

test.after(async () => {
  if (!enabled) return;
  if (createdClientId) {
    await pool.execute("DELETE FROM node_audit_log WHERE entidade = 'cliente' AND entidade_id = ? AND empresa = 1", [createdClientId]);
    await pool.execute('DELETE FROM clientes WHERE id = ? AND empresa = 1', [createdClientId]);
  }
  if (createdOrderId) {
    await pool.execute('DELETE FROM produtos_orc WHERE os = ?', [createdOrderId]);
    await pool.execute('DELETE FROM servicos_orc WHERE os = ?', [createdOrderId]);
    await pool.execute("DELETE FROM node_audit_log WHERE entidade = 'orders' AND entidade_id = ? AND empresa = 1", [createdOrderId]);
    await pool.execute('DELETE FROM os WHERE id = ? AND empresa = 1', [createdOrderId]);
  }
  await pool.end();
});
