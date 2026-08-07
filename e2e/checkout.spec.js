const { test, expect, request } = require('@playwright/test');

// Checkout da assinatura pública.
//
// A regra que estes testes existem para proteger: NENHUM dado de cartão passa pelo nosso servidor.
// O legado recebia número, validade e CVV no próprio PHP (sas/asaas/config/blocos/cartao.php), o
// que coloca a aplicação inteira no escopo do PCI-DSS. Aqui a cobrança é aberta pela API do
// provedor e o cliente digita o cartão na página HOSPEDADA por ele. Se alguém voltar a pôr campo de
// cartão no formulário, o primeiro teste quebra.

const novoCadastro = (extra = {}) => {
  const t = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    nome: `Teste Checkout ${t}`,
    email: `checkout${t}@exemplo.invalid`,
    telefone: `(47) 9${String(t).slice(-8)}`,
    cpf: '12345678901',
    tipo_pessoa: 'Jurídica',
    ...extra
  };
};

test('o formulário de assinatura não pede dados de cartão', async ({ page }) => {
  await page.goto('/planos.html');
  await page.waitForSelector('.plan-card');
  await page.locator('.plan-card').first().locator('[data-plan]').click();
  await expect(page.locator('#sub-modal')).toBeVisible();

  const suspeitos = await page.$$eval('#sub-form input, #sub-form select', (campos) => campos
    .map((c) => `${c.name} ${c.getAttribute('autocomplete') || ''}`)
    .filter((texto) => /card|cartao|ccv|cvv|expdate|validade|cc-num|cc-csc|cc-exp/i.test(texto)));
  expect(suspeitos, 'dado de cartão nunca pode ser coletado aqui — ver checkout.service.js').toEqual([]);
});

test('endereço de cobrança só é exigido quando a forma de pagamento precisa dele', async ({ page }) => {
  await page.goto('/planos.html');
  await page.waitForSelector('.plan-card');
  await page.locator('.plan-card').first().locator('[data-plan]').click();
  await expect(page.locator('#sub-modal')).toBeVisible();

  const bloco = page.locator('#sub-pagamento');
  test.skip(await bloco.isHidden(), 'sem provedor de pagamento configurado neste ambiente');

  // Pix dispensa endereço; boleto e cartão exigem CEP e número.
  await expect(page.locator('#sub-endereco')).toBeHidden();
  await page.locator('.sub-metodo', { hasText: 'Boleto' }).click();
  await expect(page.locator('#sub-endereco')).toBeVisible();
  expect(await page.locator('[name=cep]').evaluate((n) => n.required)).toBe(true);

  await page.locator('.sub-metodo', { hasText: 'Pix' }).click();
  await expect(page.locator('#sub-endereco')).toBeHidden();
  expect(await page.locator('[name=cep]').evaluate((n) => n.required)).toBe(false);
});

test('a assinatura exige CPF ou CNPJ válido', async () => {
  const ctx = await request.newContext();
  const { plans } = await (await ctx.get('/api/public/landing')).json();
  const planId = plans[0].id;

  const semDocumento = await ctx.post('/api/public/subscribe', { data: { planId, ...novoCadastro({ cpf: undefined }) } });
  expect(semDocumento.status(), 'nenhum provedor abre cobrança sem CPF/CNPJ').toBe(400);

  const documentoTorto = await ctx.post('/api/public/subscribe', { data: { planId, ...novoCadastro({ cpf: '1234567' }) } });
  expect(documentoTorto.status()).toBe(400);
  await ctx.dispose();
});

test('boleto sem endereço é recusado com a explicação do campo que falta', async () => {
  const ctx = await request.newContext();
  const { plans } = await (await ctx.get('/api/public/landing')).json();
  const resposta = await ctx.post('/api/public/subscribe', {
    data: { planId: plans[0].id, ...novoCadastro({ forma_pagamento: 'boleto', numero: '10' }) }
  });
  expect(resposta.status()).toBe(400);
  expect((await resposta.json()).error).toContain('CEP');
  await ctx.dispose();
});

test('o teste grátis concedido é exatamente o que a página promete', async () => {
  const ctx = await request.newContext();
  const landing = await (await ctx.get('/api/public/landing')).json();
  const prometido = landing.teste.dias;
  expect(prometido, 'o período de teste precisa vir do servidor').toBeGreaterThan(0);

  const pago = landing.plans.find((p) => Number(p.valor) > 0);
  const resposta = await ctx.post('/api/public/subscribe', { data: { planId: pago.id, ...novoCadastro() } });
  expect(resposta.status()).toBe(201);
  const corpo = await resposta.json();

  // A cobrança vence no fim do teste, nunca no dia do cadastro — a página promete que a cobrança
  // só acontece depois do período grátis, e com vencimento hoje a mensalidade nasceria vencida.
  const hoje = new Date();
  const vencimento = new Date(`${corpo.mensalidade.vencimento.slice(0, 10)}T12:00:00`);
  const concedido = Math.round((vencimento - new Date(`${hoje.toISOString().slice(0, 10)}T12:00:00`)) / 86400000);
  expect(concedido, `a página anuncia ${prometido} dias; o cadastro precisa conceder os mesmos`).toBe(prometido);
  await ctx.dispose();
});

test('a página não afirma um prazo de teste diferente do configurado', async ({ page }) => {
  await page.goto('/planos.html');
  await page.waitForSelector('.plan-card');
  const { teste } = await page.evaluate(() => fetch('/api/public/landing').then((r) => r.json()));

  // O número do teste ficava escrito à mão em seis lugares. Se voltar a ser cravado, esta
  // asserção quebra assim que o prazo mudar.
  await expect(page.locator('.plan-trial').first()).toHaveText(`${teste.texto} para testar`);
  await page.locator('.plan-card').first().locator('[data-plan]').click();
  await expect(page.locator('#sub-trial')).toHaveText(`${teste.texto}, depois cobra`);
});
