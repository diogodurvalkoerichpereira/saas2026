const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('teste.local@saas2026.local');
  await page.getByLabel('Senha').fill('Teste@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
}

test('etiqueta gera código de barras Code128 do produto', async ({ page }) => {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await login(page);
  await page.goto('/#/products');
  // Escopo em #page-root: o título também aparece na topbar (#page-title), o que violaria o strict mode.
  await expect(page.locator('#page-root').getByRole('heading', { name: 'Produtos' })).toBeVisible();

  const botao = page.locator('button[data-action="label"]').first();
  await expect(botao).toBeVisible();
  await botao.click();

  const label = page.locator('.barcode-label');
  await expect(label).toBeVisible();
  // O SVG precisa ter barras de verdade (rects), não estar vazio.
  const rects = await label.locator('svg rect').count();
  expect(rects).toBeGreaterThan(20);
  // O código impresso embaixo deve casar com o da linha do produto.
  const codigoNaEtiqueta = (await label.locator('small').textContent()).trim();
  expect(codigoNaEtiqueta.length).toBeGreaterThan(0);
  await expect(page.locator('#modal-submit-label')).toHaveText('Imprimir');
  expect(erros).toEqual([]);
});
