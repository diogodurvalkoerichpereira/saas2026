const { test, expect, request } = require('@playwright/test');

// O conteúdo da landing de planos é editado pelo administrador do SaaS (painel → Site e planos) e
// reflete na página pública, como no legado (index.php lia `site`/`recursos_site`/`perguntas_site`
// da empresa 0). Aqui o texto era fixo no HTML; este teste é a garantia de que continua vindo do
// banco — se alguém voltar a cravar a frase no HTML, o teste quebra.

async function saas() {
  const ctx = await request.newContext();
  const token = (await (await ctx.post('/api/auth/login', { data: { email: 'sas.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  return { ctx, headers: { authorization: `Bearer ${token}` } };
}

// Pelo NOME do plano: filtrar o card por texto pega vizinhos, porque o Profissional lista
// "Tudo do Essencial" entre as suas características.
const cardDoPlano = (page, nome) => page.locator('.plan-card').filter({ has: page.locator('.plan-name', { hasText: new RegExp(`^${nome}$`) }) });

// Devolve o conteúdo ao estado inicial para não contaminar os outros testes.
const ORIGINAL = {
  titulo: 'Escolha o plano ideal para o seu negócio',
  item1: '3 dias grátis',
  titulo_perguntas: 'Perguntas frequentes'
};

test.afterEach(async () => {
  const { ctx, headers } = await saas();
  await ctx.put('/api/admin/site', { headers, data: ORIGINAL });
  await ctx.dispose();
});

test('o texto da landing vem do painel do SaaS, não do HTML', async ({ page }) => {
  const { ctx, headers } = await saas();
  await ctx.put('/api/admin/site', {
    headers,
    data: { titulo: 'Gestão sem complicação', item1: 'Teste por 7 dias', titulo_perguntas: 'Dúvidas comuns' }
  });

  await page.goto('/planos.html');
  await expect(page.locator('#hero-title')).toHaveText('Gestão sem complicação');
  await expect(page.locator('.trust span').first()).toHaveText('Teste por 7 dias');
  await expect(page.locator('#faq-title')).toHaveText('Dúvidas comuns');
  await ctx.dispose();
});

test('cards de recurso e perguntas criados no painel aparecem na landing', async ({ page }) => {
  const { ctx, headers } = await saas();
  const card = await (await ctx.post('/api/admin/site/features', {
    headers,
    data: { titulo_recurso: 'Emissão fiscal', descricao_recurso: 'NF-e e NFC-e', icone_recurso: 'file-text', posicao_recurso: 99 }
  })).json();
  const pergunta = await (await ctx.post('/api/admin/site/faqs', {
    headers,
    data: { titulo_pergunta: 'Emitem nota fiscal?', descricao_pergunta: 'Sim, NF-e e NFC-e nos planos que incluem o módulo fiscal.', posicao_pergunta: 99 }
  })).json();

  await page.goto('/planos.html');
  await expect(page.locator('.feature-card', { hasText: 'Emissão fiscal' })).toContainText('NF-e e NFC-e');
  await expect(page.locator('.faq-item summary', { hasText: 'Emitem nota fiscal?' })).toBeVisible();

  // Excluir no painel também some da página.
  await ctx.delete(`/api/admin/site/features/${card.id}`, { headers });
  await ctx.delete(`/api/admin/site/faqs/${pergunta.id}`, { headers });
  await page.reload();
  await expect(page.locator('.feature-card', { hasText: 'Emissão fiscal' })).toHaveCount(0);
  await expect(page.locator('.faq-item summary', { hasText: 'Emitem nota fiscal?' })).toHaveCount(0);
  await ctx.dispose();
});

// Guardado antes de mexer no plano e devolvido no afterEach — inclusive quando o teste falha no
// meio, senão a característica de teste fica no banco e contamina a rodada seguinte.
let planoOriginal = null;

test.afterEach(async () => {
  if (!planoOriginal) return;
  const { ctx, headers } = await saas();
  await ctx.put(`/api/admin/plans/${planoOriginal.id}/resources`, { headers, data: { resourceIds: planoOriginal.recursos, items: planoOriginal.itens } });
  await ctx.dispose();
  planoOriginal = null;
});

test('as características do plano são editadas no painel e aparecem no card', async ({ page }) => {
  const { ctx, headers } = await saas();
  const plans = await (await ctx.get('/api/admin/plans?pageSize=100', { headers })).json();
  const plano = plans.items.find((p) => p.nome === 'Essencial');
  const atual = await (await ctx.get(`/api/admin/plans/${plano.id}/resources`, { headers })).json();
  planoOriginal = { id: plano.id, itens: atual.itens, recursos: atual.items.filter((i) => i.selecionado === 'Sim').map((i) => i.id) };
  // O GET traz as características para o painel poder editá-las (antes só o PUT as aceitava, e a
  // tela não tinha como preencher o campo com o que já estava salvo).
  expect(atual.itens.length, 'o painel precisa receber as características para editá-las').toBeGreaterThan(0);

  await ctx.put(`/api/admin/plans/${plano.id}/resources`, {
    headers, data: { resourceIds: planoOriginal.recursos, items: [...atual.itens, 'Suporte por e-mail em 24h'] }
  });
  await page.goto('/planos.html');
  await expect(cardDoPlano(page, 'Essencial')).toContainText('Suporte por e-mail em 24h');

  await ctx.put(`/api/admin/plans/${plano.id}/resources`, { headers, data: { resourceIds: planoOriginal.recursos, items: atual.itens } });
  await page.reload();
  await expect(cardDoPlano(page, 'Essencial')).not.toContainText('Suporte por e-mail em 24h');
  await ctx.dispose();
});

test('seção sem conteúdo não vira título solto na página', async ({ page }) => {
  const { ctx, headers } = await saas();
  // Admin apaga a chamada final inteira: a faixa some, em vez de aparecer vazia.
  await ctx.put('/api/admin/site', { headers, data: { titulo_rodape: '', descricao_rodape: '', botao_rodape: '' } });
  await page.goto('/planos.html');
  await expect(page.locator('#closing')).toBeHidden();

  await ctx.put('/api/admin/site', {
    headers,
    data: { titulo_rodape: 'Pronto para começar?', descricao_rodape: 'Crie sua conta em menos de um minuto e teste o sistema completo por 3 dias, sem cartão de crédito.', botao_rodape: 'Começar agora' }
  });
  await page.reload();
  await expect(page.locator('#closing')).toBeVisible();
  await expect(page.locator('#closing-btn')).toHaveText('Começar agora');
  await ctx.dispose();
});
