const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('teste.local@saas2026.local');
  await page.getByLabel('Senha').fill('Teste@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
}

test('configuração de pagamento por empresa grava e nunca reexibe os segredos', async ({ page }) => {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await login(page);
  await page.goto('/#/settings');
  await page.locator('#page-root [data-edit]').click();

  // Provedor de pagamento com as opções do legado.
  const select = page.locator('select[name="api_pagamento"]');
  await expect(select).toBeVisible();
  expect(await select.locator('option').allTextContents()).toEqual(['Nenhuma (cobrança manual)', 'Mercado Pago', 'Asaas']);

  // Grava provedor, segredos e a chave pública.
  await select.selectOption('Mercado Pago');
  await page.locator('input[name="access_token"]').fill('MP-SEGREDO-E2E');
  await page.locator('input[name="chave_api_asaas"]').fill('ASAAS-SEGREDO-E2E');
  await page.locator('input[name="public_key"]').fill('MP-PUBLICA-E2E');
  await page.locator('#modal-submit').click();
  await expect(page.locator('#app-modal')).not.toBeVisible();

  // O resumo mostra o provedor e que os segredos estão configurados — sem mostrá-los.
  const resumo = page.locator('#page-root');
  await expect(resumo).toContainText('Mercado Pago');
  await expect(resumo).toContainText('Configurado');
  await expect(resumo).not.toContainText('MP-SEGREDO-E2E');
  await expect(resumo).not.toContainText('ASAAS-SEGREDO-E2E');

  // Ao reabrir, os segredos voltam em branco (write-only); a public key, não — não é segredo.
  await page.locator('#page-root [data-edit]').click();
  await expect(page.locator('input[name="access_token"]')).toHaveValue('');
  await expect(page.locator('input[name="chave_api_asaas"]')).toHaveValue('');
  await expect(page.locator('input[name="public_key"]')).toHaveValue('MP-PUBLICA-E2E');
  await expect(page.locator('select[name="api_pagamento"]')).toHaveValue('Mercado Pago');

  expect(erros).toEqual([]);
});
