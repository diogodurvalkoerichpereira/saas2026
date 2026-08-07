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
  item1: '14 dias grátis',
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

// PNG 1x1 verde, o menor arquivo válido — o teste é do fluxo, não da imagem.
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('logo e fundo enviados no painel aparecem no topo da landing', async ({ page }) => {
  const { ctx, headers } = await saas();
  const enviar = (slot) => ctx.post(`/api/admin/site/image/${slot}`, {
    headers: { ...headers, 'content-type': 'application/octet-stream', 'x-file-type': 'image/png' },
    data: PNG_1X1
  });

  const logo = await (await enviar('logo')).json();
  await enviar('fundo');
  expect(logo.logo, 'o upload devolve o nome do arquivo gravado').toMatch(/\.png$/);

  await page.goto('/planos.html');
  await expect(page.locator('#hero-logo')).toBeVisible();
  // A imagem precisa de fato carregar: um nome gravado sem arquivo servível seria um <img> quebrado.
  expect(await page.locator('#hero-logo').evaluate((n) => n.complete && n.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.hero')).toHaveClass(/has-bg/);

  // O interruptor esconde a logo sem apagar o arquivo enviado.
  await ctx.put('/api/admin/site', { headers, data: { logo_topo: 'Não' } });
  await page.reload();
  await expect(page.locator('#hero-logo')).toBeHidden();
  await expect(page.locator('.hero')).toHaveClass(/has-bg/);

  // Remover no painel tira da página.
  await ctx.put('/api/admin/site', { headers, data: { logo_topo: 'Sim' } });
  await ctx.delete('/api/admin/site/image/logo', { headers });
  await ctx.delete('/api/admin/site/image/fundo', { headers });
  await page.reload();
  await expect(page.locator('#hero-logo')).toBeHidden();
  await expect(page.locator('.hero')).not.toHaveClass(/has-bg/);
  await ctx.dispose();
});

test('o upload de imagem do site recusa arquivo que não é imagem', async () => {
  const { ctx, headers } = await saas();
  const resposta = await ctx.post('/api/admin/site/image/logo', {
    headers: { ...headers, 'content-type': 'application/octet-stream', 'x-file-type': 'application/pdf' },
    data: Buffer.from('%PDF-1.4 nao sou imagem')
  });
  expect(resposta.status()).toBe(415);
  // E o slot inventado também não passa.
  const slot = await ctx.post('/api/admin/site/image/qualquer', {
    headers: { ...headers, 'content-type': 'application/octet-stream', 'x-file-type': 'image/png' },
    data: PNG_1X1
  });
  expect(slot.status()).toBe(400);
  await ctx.dispose();
});

test('a tabela de comparação reflete exatamente os recursos de cada plano', async ({ page }) => {
  await page.goto('/planos.html');
  await page.waitForSelector('.compare-table tbody tr');

  const dados = await page.evaluate(() => fetch('/api/public/landing').then((r) => r.json()));
  const colunas = await page.$$eval('.compare-table thead .cp-nome', (n) => n.map((x) => x.textContent));
  expect(colunas, 'uma coluna por plano ativo, na ordem de preço').toEqual(dados.plans.map((p) => p.nome));

  // Confere a matriz inteira contra a API: cada célula tem de bater com o que o plano libera.
  const celulas = await page.$$eval('.compare-table tbody tr:not(.cp-grupo)', (linhas) => linhas.map((linha) => ({
    recurso: linha.querySelector('td.rec').textContent.trim(),
    marcas: [...linha.querySelectorAll('td')].slice(1).map((td) => td.textContent.trim())
  })));
  const porNome = new Map(dados.recursos.map((r) => [r.nome, r]));
  expect(celulas.length, 'toda linha do catálogo aparece na tabela').toBe(dados.recursos.length);

  for (const { recurso, marcas } of celulas) {
    const meta = porNome.get(recurso);
    expect(meta, `"${recurso}" precisa existir no catálogo`).toBeTruthy();
    const esperado = dados.plans.map((plan) =>
      (meta.nucleo === 'Sim' || (plan.chaves || []).includes(meta.chave) ? '✓' : '–'));
    expect(marcas, `linha "${recurso}" não bate com os recursos dos planos`).toEqual(esperado);
  }
});

test('publicar um plano no painel acrescenta a coluna na comparação', async ({ page }) => {
  const { ctx, headers } = await saas();
  const nome = `Comparação ${Date.now()}`;
  const criado = await (await ctx.post('/api/admin/plans', { headers, data: { nome, valor: 9.9, ativo: 'Sim', usuarios: 1, clientes: 10 } })).json();
  const catalogo = await (await ctx.get(`/api/admin/plans/${criado.id}/resources`, { headers })).json();
  const clientes = catalogo.items.find((r) => r.chave === 'clientes');
  await ctx.put(`/api/admin/plans/${criado.id}/resources`, { headers, data: { resourceIds: [clientes.id] } });

  await page.goto('/planos.html');
  await page.waitForSelector('.compare-table tbody tr');
  // Plano mais barato de todos: entra como primeira coluna (índice 0 depois da coluna do recurso).
  const coluna = await page.$$eval('.compare-table thead .cp-nome', (n) => n.map((x) => x.textContent));
  expect(coluna[0]).toBe(nome);

  const linhaDe = async (rotulo) => page.$$eval('.compare-table tbody tr', (linhas, r) => {
    const linha = linhas.find((l) => l.querySelector('td.rec')?.textContent.trim() === r);
    return [...linha.querySelectorAll('td')].slice(1).map((td) => td.textContent.trim());
  }, rotulo);
  expect((await linhaDe('Clientes'))[0], 'o único recurso marcado aparece incluído').toBe('✓');
  expect((await linhaDe('Estoque'))[0], 'o que não foi marcado aparece de fora').toBe('–');
  expect((await linhaDe('Dashboard'))[0], 'o núcleo aparece em qualquer plano').toBe('✓');

  // Tirar da vitrine remove a coluna — a tabela é o banco, não uma lista escrita à mão.
  await ctx.delete(`/api/admin/plans/${criado.id}`, { headers });
  await page.reload();
  await page.waitForSelector('.compare-table tbody tr');
  expect(await page.$$eval('.compare-table thead .cp-nome', (n) => n.map((x) => x.textContent))).not.toContain(nome);
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
    data: { titulo_rodape: 'Pronto para começar?', descricao_rodape: 'Crie sua conta em menos de um minuto e teste o sistema completo por 14 dias, sem cartão de crédito.', botao_rodape: 'Começar agora' }
  });
  await page.reload();
  await expect(page.locator('#closing')).toBeVisible();
  await expect(page.locator('#closing-btn')).toHaveText('Começar agora');
  await ctx.dispose();
});
