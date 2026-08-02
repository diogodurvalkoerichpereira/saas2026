const { test, expect, request } = require('@playwright/test');

// Bloqueio de recursos por plano: uma empresa no Essencial não vê nem acessa os módulos premium.
// Usa a API do painel SaaS (sas.local) para trocar o plano da empresa 1 e restaura no fim.

async function saasContext() {
  const ctx = await request.newContext();
  const login = await ctx.post('/api/auth/login', { data: { email: 'sas.local@saas2026.local', password: 'Teste@2026' } });
  const token = (await login.json()).token;
  return { ctx, headers: { authorization: `Bearer ${token}` } };
}

async function planId(ctx, headers, nome) {
  const res = await ctx.get('/api/admin/plans?page=1&pageSize=100', { headers });
  const items = (await res.json()).items;
  return items.find((p) => p.nome === nome)?.id;
}

async function setPlan(nome) {
  const { ctx, headers } = await saasContext();
  const id = await planId(ctx, headers, nome);
  const res = await ctx.patch('/api/admin/companies/1', { headers, data: { plano: id } });
  expect(res.status(), `trocar plano para ${nome}`).toBeLessThan(300);
  await ctx.dispose();
}

async function loginGerente(page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('gerente.local@saas2026.local');
  await page.getByLabel('Senha').fill('Teste@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
}

test.afterAll(async () => { await setPlan('Enterprise'); }); // devolve a empresa ao estado cheio

test('no plano Essencial, o Gerente não vê nem acessa módulos premium', async ({ page }) => {
  await setPlan('Essencial');
  await loginGerente(page);

  // Guias premium fora do Essencial recebem o atributo hidden (o accordion pode estar recolhido,
  // por isso checamos a propriedade hidden, não a visibilidade calculada).
  for (const feature of ['orcamentos', 'marketing', 'compras', 'fiscal', 'recursos_humanos', 'cobrancas_recorrentes']) {
    await expect(page.locator(`#sidebar [data-feature="${feature}"]`).first(), `guia ${feature} deveria sumir`).toHaveJSProperty('hidden', true);
  }
  // Guias de núcleo NÃO ficam escondidas pelo plano.
  await expect(page.locator('#sidebar a[data-route="clients"]')).toHaveJSProperty('hidden', false);
  await expect(page.locator('#sidebar a[data-route="sales"]')).toHaveJSProperty('hidden', false);

  // E a API recusa o módulo premium mesmo se chamada direto.
  const token = await page.evaluate(() => sessionStorage.getItem('saas2026.token'));
  const auth = { authorization: `Bearer ${token}` };
  // Todos os módulos premium fora do Essencial recusam a API (não só o Orçamentos).
  for (const path of ['/api/work/budgets', '/api/marketing/campaigns', '/api/operations/commissions', '/api/operations/contracts', '/api/reference/coupons', '/api/store/orders', '/api/hr/employees', '/api/fiscal/config']) {
    expect((await page.request.get(path, { headers: auth })).status(), `${path} deveria recusar`).toBe(403);
  }
  // Chamados está em todos os planos — continua liberado no Essencial.
  expect((await page.request.get('/api/collaboration/tickets', { headers: auth })).status()).toBe(200);
});

test('o Administrador da própria empresa também é limitado pelo plano', async ({ page }) => {
  await setPlan('Essencial');
  // teste.local é Administrador da empresa 1 — ainda assim não pode furar o plano.
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('teste.local@saas2026.local');
  await page.getByLabel('Senha').fill('Teste@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();

  await expect(page.locator('#sidebar [data-feature="fiscal"]').first()).toHaveJSProperty('hidden', true);
  const token = await page.evaluate(() => sessionStorage.getItem('saas2026.token'));
  const api = await page.request.get('/api/fiscal/config', { headers: { authorization: `Bearer ${token}` } });
  expect(api.status()).toBe(403);
});

test('ao subir para Profissional, os módulos incluídos aparecem', async ({ page }) => {
  await setPlan('Profissional');
  await loginGerente(page);
  // Profissional inclui marketing e orçamentos (não ficam escondidos pelo plano).
  await expect(page.locator('#sidebar [data-feature="marketing"]').first()).toHaveJSProperty('hidden', false);
  await expect(page.locator('#sidebar [data-feature="orcamentos"]').first()).toHaveJSProperty('hidden', false);
  // Mas fiscal é só Avançado+ — continua escondido.
  await expect(page.locator('#sidebar [data-feature="fiscal"]').first()).toHaveJSProperty('hidden', true);
});
