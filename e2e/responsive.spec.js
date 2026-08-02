const { test, expect } = require('@playwright/test');
async function login(page){await page.goto('/');await page.getByRole('textbox',{name:'E-mail'}).fill('teste.local@saas2026.local');await page.getByLabel('Senha').fill('Teste@2026');await page.getByRole('button',{name:'Entrar no sistema'}).click();await page.getByRole('heading',{name:'Visão geral'}).waitFor();}

test('login e menu do usuário funcionam no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await login(page);
  // O menu do usuário deve abrir e mostrar os TRÊS itens com texto (bug corrigido).
  await page.locator('[data-profile-toggle]').click();
  const menu = page.locator('#nav-profile .profile-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('#topbar-settings')).toHaveText(/Configurações/);
  await expect(menu.locator('#change-password')).toHaveText(/Alterar senha/);
  await expect(menu.locator('#logout')).toHaveText(/Sair/);
});

test('as páginas principais não geram rolagem horizontal no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await login(page);
  for (const rota of ['dashboard', 'products', 'sales', 'marketing', 'settings', 'finance', 'users']) {
    await page.goto(`/#/${rota}`);
    await page.locator('#page-root').waitFor();
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `rota ${rota} tem rolagem horizontal (${overflow}px)`).toBeLessThanOrEqual(1);
  }
});
