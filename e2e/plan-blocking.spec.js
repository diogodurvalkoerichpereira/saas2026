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
  const payload = await res.json();
  // Erro (ex.: sessão expirada num run longo) devolve { error } em vez de { items }.
  if (!payload.items) throw new Error(`não foi possível listar planos: ${payload.error || res.status()}`);
  const plano = payload.items.find((p) => p.nome === nome);
  if (!plano) throw new Error(`plano "${nome}" não encontrado`);
  return plano.id;
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

// Estes testes trocam o plano da empresa 1 (estado compartilhado). Restaura depois de CADA teste,
// não só no fim do arquivo — se um teste falhar no meio, os seguintes (e os outros arquivos) não
// herdam uma empresa sem recursos.
test.afterEach(async () => {
  try { await setPlan('Enterprise'); } catch { /* não mascara a falha do teste */ }
});

test('plano criado SEM habilitar nada não libera nenhum módulo', async () => {
  const { ctx, headers } = await saasContext();
  const criado = await (await ctx.post('/api/admin/plans', { headers, data: { nome: `Vazio ${Date.now()}`, valor: 29 } })).json();
  await ctx.put(`/api/admin/plans/${criado.id}/resources`, { headers, data: { resourceIds: [] } });
  await ctx.patch('/api/admin/companies/1', { headers, data: { plano: criado.id } });

  const gtoken = (await (await ctx.post('/api/auth/login', { data: { email: 'teste.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  const h = { authorization: `Bearer ${gtoken}` };
  // Nada habilitado = nada acessível (só dashboard/assinatura, que não têm API própria de módulo).
  for (const path of ['/api/clients', '/api/catalog/products', '/api/finance/receivables', '/api/inventory/movements', '/api/sales', '/api/reports/financial', '/api/users', '/api/content/settings']) {
    expect((await ctx.get(path, { headers: h })).status(), `${path} deveria recusar em plano vazio`).toBe(403);
  }

  await setPlan('Enterprise');
  await ctx.patch(`/api/admin/plans/${criado.id}`, { headers, data: { ativo: 'Não' } }).catch(() => {});
  await ctx.dispose();
});

test('criar um plano novo com recursos escolhidos entrega exatamente esses ao usuário', async () => {
  const { ctx, headers } = await saasContext();
  // 1) cria um plano novo
  const created = await (await ctx.post('/api/admin/plans', { headers, data: { nome: `Custom ${Date.now()}`, valor: 199.9 } })).json();
  const novoId = created.id;
  // 2) escolhe SÓ marketing + orçamentos como premium
  const res = await (await ctx.get(`/api/admin/plans/${novoId}/resources`, { headers })).json();
  const escolhidos = res.items.filter((r) => ['marketing', 'orcamentos'].includes(r.chave)).map((r) => r.id);
  await ctx.put(`/api/admin/plans/${novoId}/resources`, { headers, data: { resourceIds: escolhidos } });
  // 3) atribui a empresa 1 a esse plano
  await ctx.patch('/api/admin/companies/1', { headers, data: { plano: novoId } });

  // 4) o usuário recebe exatamente o escolhido: marketing/orçamentos liberam, o resto bloqueia
  const gtoken = (await (await ctx.post('/api/auth/login', { data: { email: 'gerente.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  const h = { authorization: `Bearer ${gtoken}` };
  expect((await ctx.get('/api/marketing/campaigns', { headers: h })).status(), 'marketing escolhido').toBe(200);
  expect((await ctx.get('/api/fiscal/config', { headers: h })).status(), 'fiscal não escolhido').toBe(403);
  expect((await ctx.get('/api/hr/employees', { headers: h })).status(), 'RH não escolhido').toBe(403);
  expect((await ctx.get('/api/operations/contracts', { headers: h })).status(), 'contratos não escolhido').toBe(403);

  // limpeza: volta a empresa ao Enterprise e desativa o plano de teste (some da vitrine)
  await setPlan('Enterprise');
  await ctx.patch(`/api/admin/plans/${novoId}`, { headers, data: { ativo: 'Não' } }).catch(() => {});
  await ctx.dispose();
});

test('tirar um recurso do plano remove o acesso de quem já está nele', async () => {
  const { ctx, headers } = await saasContext();
  const profId = await planId(ctx, headers, 'Profissional');
  // empresa 1 no Profissional (que inclui marketing)
  await ctx.patch('/api/admin/companies/1', { headers, data: { plano: profId } });

  const before = await (await ctx.get(`/api/admin/plans/${profId}/resources`, { headers })).json();
  const marketing = before.items.find((r) => r.chave === 'marketing');
  expect(marketing.selecionado).toBe('Sim');

  // remove 'marketing' do plano
  const semMarketing = before.items.filter((r) => r.selecionado === 'Sim' && r.chave !== 'marketing').map((r) => r.id);
  const put = await ctx.put(`/api/admin/plans/${profId}/resources`, { headers, data: { resourceIds: semMarketing } });
  expect(put.status()).toBe(204);

  // o Gerente da empresa 1 (no Profissional) já não acessa marketing
  const login = await ctx.post('/api/auth/login', { data: { email: 'gerente.local@saas2026.local', password: 'Teste@2026' } });
  const gtoken = (await login.json()).token;
  const resp = await ctx.get('/api/marketing/campaigns', { headers: { authorization: `Bearer ${gtoken}` } });
  expect(resp.status(), 'acesso deve cair ao tirar o recurso do plano').toBe(403);

  // restaura: recoloca marketing no plano
  const comMarketing = [...semMarketing, marketing.id];
  await ctx.put(`/api/admin/plans/${profId}/resources`, { headers, data: { resourceIds: comMarketing } });
  await ctx.dispose();
});

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
