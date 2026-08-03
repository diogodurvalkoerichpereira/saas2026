const { test, expect } = require('@playwright/test');

// Página pública de planos: lista os planos ativos, destaca o popular e abre o modal de assinatura.
test('a vitrine de planos lista os planos e abre a assinatura', async ({ page }) => {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('/planos.html');

  const cards = page.locator('.plan-card');
  await expect(cards.first()).toBeVisible();
  // Só os planos ativos (o "Plano Demonstração" foi desativado) — os 6 reais, incluindo os de
  // entrada Micro e Fiscal.
  await expect(cards).toHaveCount(6);
  expect(await page.locator('.plan-name').allTextContents())
    .toEqual(['Micro', 'Essencial', 'Fiscal', 'Profissional', 'Avançado', 'Enterprise']);
  // O destaque é o plano que libera mais módulos — Enterprise, e não o que tem mais linhas escritas.
  await expect(page.locator('.plan-ribbon')).toHaveText('Mais completo');
  await expect(page.locator('.plan-card.popular .plan-name')).toHaveText('Enterprise');
  // Enterprise mostra "ilimitado" no lugar de número.
  await expect(page.locator('.plan-card', { hasText: 'Enterprise' })).toContainText('ilimitados');

  // Abrir a assinatura leva o plano escolhido para o resumo do modal.
  await page.locator('.plan-card.popular [data-plan]').click();
  await expect(page.locator('#sub-modal')).toBeVisible();
  await expect(page.locator('#sub-plan-name')).toHaveText('Enterprise');
  await expect(page.locator('#sub-form input[name="nome"]')).toBeVisible();

  expect(erros).toEqual([]);
});
