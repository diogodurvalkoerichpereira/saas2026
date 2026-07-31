const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/database');

const baseUrl = process.env.E2E_BASE_URL;
const enabled = Boolean(baseUrl);
let token;
let adminToken;
let clientToken;
let createdClientId;
let createdOrderId;
let createdStoreOrderId;
let createdStoreReceivableId;
let createdStoreClientId;
let storeProductId;
let storeStockBefore;

async function request(path, options = {}, authToken = token) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${response.status} ${payload?.error || path}`);
  return payload;
}

async function response(path, options = {}, authToken = token) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
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
    '/api/sales?pageSize=5', '/api/work/orders?pageSize=5', '/api/work/quotes?pageSize=5',
    '/api/reference/categories?pageSize=5', '/api/reference/subcategories?pageSize=5',
    '/api/reference/brands?pageSize=5', '/api/reference/equipment?pageSize=5',
    '/api/reference/models?pageSize=5', '/api/reference/payment-methods?pageSize=5',
    '/api/reference/positions?pageSize=5', '/api/reference/frequencies?pageSize=5',
    '/api/reference/account-plans?pageSize=5', '/api/reference/coupons?pageSize=5',
    '/api/reference/contract-templates?pageSize=5',
    '/api/collaboration/notes?pageSize=5', '/api/collaboration/tasks?pageSize=5',
    '/api/collaboration/tickets?pageSize=5',
    '/api/marketing/status', '/api/marketing/campaigns?pageSize=5',
    '/api/marketing/groups?pageSize=5', '/api/marketing/devices?pageSize=5',
    '/api/operations/cash?pageSize=5', '/api/operations/purchases?pageSize=5',
    '/api/operations/recurring?pageSize=5', '/api/operations/contracts?pageSize=5',
    '/api/operations/commissions?pageSize=5',
    '/api/hr/attendance?pageSize=5', '/api/hr/payroll?pageSize=5',
    '/api/content/settings', '/api/content/site', '/api/content/site/features?pageSize=5',
    '/api/content/site/faqs?pageSize=5', '/api/content/tutorials?pageSize=5',
    '/api/content/subscription', '/api/store/orders?pageSize=5',
    '/api/reports/sales', '/api/reports/cash-flow', '/api/reports/inventory',
    '/api/reports/delinquency', '/api/reports/cash-registers'
  ];
  for (const path of paths) assert.ok(await request(path), path);
});

test('portais e administração respeitam o tipo de sessão', { skip: !enabled }, async () => {
  const admin = await request(
    '/api/auth/login',
    { method: 'POST', body: { email: 'sas.local@saas2026.local', password: 'Teste@2026' } },
    null
  );
  adminToken = admin.token;
  assert.equal(admin.user.companyId, 0);

  const client = await request(
    '/api/client/login',
    { method: 'POST', body: { email: 'cliente@exemplo.local', password: 'Teste@2026', companyId: 1 } },
    null
  );
  clientToken = client.token;
  assert.equal(client.user.companyId, 1);

  const adminPaths = [
    '/api/admin/dashboard', '/api/admin/companies?pageSize=5', '/api/admin/plans?pageSize=5',
    '/api/admin/resources?pageSize=5', '/api/admin/alerts?pageSize=5', '/api/admin/billing?pageSize=5'
  ];
  for (const path of adminPaths) assert.ok(await request(path, {}, adminToken), path);

  const clientPaths = [
    '/api/client/me', '/api/client/orders?pageSize=5', '/api/client/quotes?pageSize=5',
    '/api/client/contracts?pageSize=5', '/api/client/billing?pageSize=5'
  ];
  for (const path of clientPaths) assert.ok(await request(path, {}, clientToken), path);

  assert.equal((await response('/api/admin/dashboard', {}, token)).status, 403);
  assert.equal((await response('/api/clients?pageSize=1', {}, clientToken)).status, 403);
  assert.equal((await response('/api/client/me', {}, token)).status, 403);
});

test('site público, catálogo e cupom expõem somente o conteúdo publicado', { skip: !enabled }, async () => {
  const site = await request('/api/public/1/site', {}, null);
  const catalog = await request('/api/public/1/catalog', {}, null);
  const coupon = await request('/api/public/1/coupons/TESTE10', {}, null);
  assert.equal(site.company.id, 1);
  assert.ok(catalog.products.length);
  assert.ok(catalog.services.length);
  assert.equal(coupon.codigo, 'TESTE10');
  assert.equal(JSON.stringify(site).includes('senha_crip'), false);
});

test('checkout e cancelamento restauram o estoque na mesma empresa', { skip: !enabled }, async () => {
  const catalog = await request('/api/public/1/catalog', {}, null);
  const product = catalog.products.find((item) => item.tem_estoque !== 'Não' && Number(item.estoque) > 0);
  assert.ok(product);
  storeProductId = product.id;
  storeStockBefore = Number(product.estoque);
  const checkout = await request('/api/public/1/checkout', {
    method: 'POST',
    body: {
      customer: { name: 'Cliente checkout E2E', email: `checkout-e2e-${Date.now()}@example.local`, phone: '48999990000' },
      items: [{ kind: 'product', itemId: product.id, quantity: 1 }],
      paymentMethodId: catalog.paymentMethods[0].id,
      notes: 'Teste automatizado local'
    }
  }, null);
  createdStoreOrderId = checkout.orderId;
  const tracked = await request(`/api/public/orders/${checkout.trackingToken}`, {}, null);
  assert.equal(tracked.id, createdStoreOrderId);

  const [orders] = await pool.execute('SELECT recebivel, cliente FROM node_store_orders WHERE id = ? AND empresa = 1', [createdStoreOrderId]);
  createdStoreReceivableId = orders[0].recebivel;
  createdStoreClientId = orders[0].cliente;
  const [afterCheckout] = await pool.execute('SELECT estoque FROM produtos WHERE id = ? AND empresa = 1', [storeProductId]);
  assert.equal(Number(afterCheckout[0].estoque), storeStockBefore - 1);

  await request(`/api/store/orders/${createdStoreOrderId}`, {
    method: 'DELETE',
    body: { reason: 'Cancelamento automatizado de teste' }
  });
  const [afterCancel] = await pool.execute('SELECT estoque FROM produtos WHERE id = ? AND empresa = 1', [storeProductId]);
  assert.equal(Number(afterCancel[0].estoque), storeStockBefore);
});

test('anexo autorizado pode ser enviado, baixado e removido', { skip: !enabled }, async () => {
  const fileContents = Buffer.from('arquivo de teste local');
  const uploadResponse = await fetch(`${baseUrl}/api/files/clients/1`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/octet-stream',
      'x-file-type': 'text/plain',
      'x-file-name': encodeURIComponent('teste-e2e.txt')
    },
    body: fileContents
  });
  assert.equal(uploadResponse.status, 201);
  const uploaded = await uploadResponse.json();
  const listed = await request('/api/files/clients/1');
  assert.ok(listed.items.some((item) => item.id === uploaded.id));
  const download = await response(`/api/files/clients/1/${uploaded.id}/download`);
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'arquivo de teste local');
  await request(`/api/files/clients/1/${uploaded.id}`, { method: 'DELETE', body: { reason: 'Limpeza E2E' } });
});

test('CRUD de cliente funciona da interface até o banco', { skip: !enabled }, async () => {
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
  if (createdStoreOrderId) {
    await pool.execute("DELETE FROM node_audit_log WHERE entidade = 'pedido_loja' AND entidade_id = ? AND empresa = 1", [createdStoreOrderId]);
    await pool.execute('DELETE FROM entradas WHERE motivo = ? AND empresa = 1', [`Cancelamento pedido loja #${createdStoreOrderId}`]);
    await pool.execute('DELETE FROM saidas WHERE motivo = ? AND empresa = 1', [`Pedido loja #${createdStoreOrderId}`]);
    await pool.execute('DELETE FROM itens_venda WHERE id_venda = ? AND empresa = 1', [createdStoreReceivableId]);
    await pool.execute('DELETE FROM node_store_order_items WHERE pedido = ?', [createdStoreOrderId]);
    await pool.execute('DELETE FROM node_store_orders WHERE id = ? AND empresa = 1', [createdStoreOrderId]);
    await pool.execute('DELETE FROM receber WHERE id = ? AND empresa = 1', [createdStoreReceivableId]);
    await pool.execute('DELETE FROM clientes WHERE id = ? AND empresa = 1', [createdStoreClientId]);
  }
  await pool.end();
});
