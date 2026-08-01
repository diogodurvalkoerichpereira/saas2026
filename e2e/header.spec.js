const { test, expect } = require('@playwright/test');

// Todos os perfis do sistema, para conferir o cabeçalho em cada um.
const perfis = [
  { email: 'teste.local@saas2026.local', nivel: 'Administrador' },
  { email: 'gerente.local@saas2026.local', nivel: 'Gerente' },
  { email: 'comum.local@saas2026.local', nivel: 'Comum' },
  { email: 'tecnico.local@saas2026.local', nivel: 'Técnico' },
  { email: 'tesoureiro.local@saas2026.local', nivel: 'Tesoureiro' },
  { email: 'financeiro.local@saas2026.local', nivel: 'Financeiro' }
];

async function login(page, email) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await page.getByLabel('Senha').fill('Teste@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
}

for (const perfil of perfis) {
  test(`cabeçalho completo e funcional no perfil ${perfil.nivel}`, async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await login(page, perfil.email);

    const topbar = page.locator('.topbar');
    // Saudação, título e ações precisam estar presentes em todo perfil.
    await expect(page.locator('#topbar-greeting')).not.toHaveText('');
    await expect(page.locator('#page-title')).toBeVisible();
    await expect(topbar.locator('#theme-toggle')).toBeVisible();
    await expect(topbar.locator('#change-password')).toBeVisible();
    await expect(topbar.locator('#logout')).toBeVisible();

    // Atalho de Configurações no cabeçalho (como o legado tinha no navbar) deve levar à tela.
    const config = topbar.locator('#topbar-settings');
    await expect(config).toBeVisible();
    await config.click();
    await expect(page.locator('#page-root').getByRole('heading', { name: 'Configurações da empresa' })).toBeVisible();
    // E a escolha de provedor de WhatsApp precisa estar lá.
    await page.locator('#page-root [data-edit]').click();
    await expect(page.locator('select[name="api_whatsapp"]')).toBeVisible();
    const opcoes = await page.locator('select[name="api_whatsapp"] option').allTextContents();
    expect(opcoes).toEqual(['Não enviar', 'Menuia', 'WordMensagens', 'NewTek']);

    expect(erros).toEqual([]);
  });
}
