const { test, expect, request } = require('@playwright/test');

// Upgrade de plano pelo painel do lojista (espelha o modal "Upgrade Plano" do legado):
// lista só os planos superiores com a diferença pro-rata, gera a cobrança de ajuste, e a troca
// de plano só acontece quando o pagamento é confirmado.

async function saas() {
  const ctx = await request.newContext();
  const token = (await (await ctx.post('/api/auth/login', { data: { email: 'sas.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  return { ctx, headers: { authorization: `Bearer ${token}` } };
}

async function setPlan(nome) {
  const { ctx, headers } = await saas();
  const plans = await (await ctx.get('/api/admin/plans?page=1&pageSize=100', { headers })).json();
  const id = plans.items.find((p) => p.nome === nome).id;
  await ctx.patch('/api/admin/companies/1', { headers, data: { plano: id } });
  await ctx.dispose();
}

test.afterEach(async () => { await setPlan('Enterprise'); });

test('lojista vê só planos superiores com a diferença proporcional e solicita o upgrade', async ({ page }) => {
  await setPlan('Essencial');
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('teste.local@saas2026.local');
  await page.getByLabel('Senha').fill('Teste@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();

  await page.goto('/#/subscription');
  const cards = page.locator('.upgrade-card');
  await expect(cards.first()).toBeVisible();
  // No Essencial (o mais barato), os 3 superiores aparecem — e o próprio Essencial, não.
  // Confere pelos NOMES dos planos (os itens de um card podem citar "Tudo do Essencial").
  await expect(cards).toHaveCount(3);
  expect(await page.locator('.upgrade-name').allTextContents()).toEqual(['Profissional', 'Avançado', 'Enterprise']);
  // Cada card mostra quanto custa migrar hoje.
  await expect(cards.first()).toContainText('Para migrar hoje');
});

test('upgrade só troca o plano depois do pagamento confirmado', async () => {
  await setPlan('Essencial');
  const { ctx, headers } = await saas();

  // Lojista solicita o upgrade para Profissional.
  const tenant = (await (await ctx.post('/api/auth/login', { data: { email: 'teste.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  const th = { authorization: `Bearer ${tenant}` };
  const upgrades = await (await ctx.get('/api/content/subscription/upgrades', { headers: th })).json();
  // Alvo: o plano mais caro — a diferença é positiva qualquer que seja a mensalidade em aberto.
  const alvo = upgrades.plans.find((p) => p.nome === 'Enterprise');
  expect(alvo.diferenca, 'diferença proporcional deve ser positiva').toBeGreaterThan(0);

  const pedido = await (await ctx.post('/api/content/subscription/upgrade', { headers: th, data: { planId: alvo.id } })).json();
  expect(pedido.id, 'cobrança de ajuste criada').toBeTruthy();

  // Antes de pagar, o plano continua o mesmo.
  const antes = await (await ctx.get('/api/content/subscription', { headers: th })).json();
  expect(antes.company.plano_nome).toBe('Essencial');

  // Admin confirma o pagamento → o plano troca.
  const pago = await (await ctx.post(`/api/admin/billing/${pedido.id}/pay`, { headers })).json();
  expect(pago.upgrade?.nome).toBe('Enterprise');

  const depois = await (await ctx.get('/api/content/subscription', { headers: th })).json();
  expect(depois.company.plano_nome).toBe('Enterprise');
  // E os recursos do novo plano já valem: marketing entra no Enterprise.
  expect((await ctx.get('/api/marketing/campaigns', { headers: th })).status()).toBe(200);

  await ctx.dispose();
});
