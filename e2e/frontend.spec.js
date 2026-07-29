const { test, expect } = require('@playwright/test');
const mysql = require('mysql2/promise');

const testClientName = `Cliente Browser ${Date.now()}`;

async function login(page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('teste.local@saas2026.local');
  await page.getByLabel('Senha').fill('Teste@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('login e todas as guias abrem o módulo correto', async ({ page }) => {
  const routes = [
    ['dashboard', 'Visão geral'],
    ['clients', 'Clientes'],
    ['users', 'Usuários'],
    ['suppliers', 'Fornecedores'],
    ['products', 'Produtos'],
    ['services', 'Serviços'],
    ['inventory', 'Estoque'],
    ['sales', 'Vendas / PDV'],
    ['quotes', 'Orçamentos'],
    ['orders', 'Ordens de serviço'],
    ['finance', 'Financeiro']
  ];
  for (const [route, heading] of routes) {
    await page.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('main h2')).toHaveText(heading);
  }
});

test('cadastro, edição e inativação de cliente funcionam pela interface', async ({ page }) => {
  await page.locator('[data-route="clients"]').click();
  await page.getByRole('button', { name: '+ Novo cliente' }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill(testClientName);
  await page.getByRole('textbox', { name: 'Cidade', exact: true }).fill('Cidade Browser');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();

  const row = page.getByRole('row', { name: new RegExp(testClientName) });
  await expect(row).toContainText('Sim');
  await row.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('textbox', { name: 'Telefone', exact: true }).fill('(00) 97777-0000');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(row).toContainText('(00) 97777-0000');

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Inativar' }).click();
  await expect(row).toContainText('Não');
  await expect(row.getByRole('button', { name: 'Reativar' })).toBeVisible();
});

test('formulários operacionais principais abrem sem erro', async ({ page }) => {
  const forms = [
    ['products', '+ Novo produto', 'Novo produto'],
    ['inventory', '+ Movimentar estoque', 'Movimentar estoque'],
    ['sales', '+ Nova venda', 'Nova venda'],
    ['orders', '+ Nova ordem de serviço', 'Nova ordem de serviço'],
    ['quotes', '+ Novo orçamento', 'Novo orçamento'],
    ['finance', '+ Novo lançamento', 'Novo lançamento']
  ];
  for (const [route, button, dialogTitle] of forms) {
    await page.locator(`[data-route="${route}"]`).click();
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: dialogTitle })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  }
});

test('menu, tabela e modal permanecem utilizáveis no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir ou fechar menu' }).click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);
  await page.locator('[data-route="clients"]').click();
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
  await expect(page.locator('.table-wrap')).toBeVisible();
  await page.getByRole('button', { name: '+ Novo cliente' }).click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
});

test.afterAll(async () => {
  if (process.env.DATABASE_PORT !== '3308' || !['127.0.0.1', 'localhost'].includes(process.env.DATABASE_HOST)) return;
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
  });
  const [rows] = await connection.execute('SELECT id FROM clientes WHERE nome = ? AND empresa = 1', [testClientName]);
  for (const row of rows) {
    await connection.execute("DELETE FROM node_audit_log WHERE entidade = 'cliente' AND entidade_id = ? AND empresa = 1", [row.id]);
    await connection.execute('DELETE FROM clientes WHERE id = ? AND empresa = 1', [row.id]);
  }
  await connection.end();
});
