const { test, expect } = require('@playwright/test');
const { Client } = require('pg');

const testClientName = `Cliente Browser ${Date.now()}`;

async function login(page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('teste.local@saas2026.local');
  await page.getByLabel('Senha').fill('Teste@2026');
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
}

test('login e todas as guias abrem o módulo correto', async ({ page }) => {
  await login(page);
  const routes = [
    ['dashboard', 'Dashboard'],
    ['clients', 'Clientes'],
    ['users', 'Usuários'],
    ['suppliers', 'Fornecedores'],
    ['products', 'Produtos'],
    ['services', 'Serviços'],
    ['inventory', 'Estoque'],
    ['sales', 'Vendas / PDV'],
    ['quotes', 'Orçamentos'],
    ['orders', 'Ordens de serviço'],
    ['online-orders', 'Pedidos online'],
    ['finance', 'Financeiro'],
    ['categories', 'Categorias'],
    ['subcategories', 'Subcategorias'],
    ['brands', 'Marcas'],
    ['equipment', 'Equipamentos'],
    ['models', 'Modelos'],
    ['payment-methods', 'Formas de pagamento'],
    ['positions', 'Cargos'],
    ['frequencies', 'Frequências'],
    ['account-plans', 'Plano de contas'],
    ['coupons', 'Cupons'],
    ['contract-templates', 'Modelos de contrato'],
    ['notes', 'Anotações'],
    ['tasks', 'Tarefas'],
    ['tickets', 'Chamados'],
    ['marketing', 'WhatsApp e campanhas'],
    ['cash', 'Caixas'],
    ['purchases', 'Compras'],
    ['recurring', 'Cobranças recorrentes'],
    ['contracts', 'Contratos'],
    ['commissions', 'Comissões'],
    ['hr', 'Recursos humanos'],
    ['settings', 'Configurações'],
    ['subscription', 'Assinatura'],
    ['site', 'Dados do site'],
    ['tutorials', 'Tutoriais'],
    ['reports', 'Relatórios']
  ];
  for (const [route, heading] of routes) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('#page-title')).toHaveText(heading);
    await expect(page.locator('main h2').first()).toBeVisible();
    await expect(page.getByText('Não foi possível abrir este módulo.')).toHaveCount(0);
  }
});

test('cadastro, edição e inativação de cliente funcionam pela interface', async ({ page }) => {
  await login(page);
  await page.locator('[data-route="clients"]').click();
  await page.getByRole('button', { name: 'Novo cliente' }).click();
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
  await login(page);
  const forms = [
    ['products', 'Novo produto', 'Novo produto'],
    ['inventory', 'Movimentar estoque', 'Movimentar estoque'],
    ['sales', 'Nova venda', 'Nova venda'],
    ['orders', 'Nova ordem de serviço', 'Nova ordem de serviço'],
    ['quotes', 'Novo orçamento', 'Novo orçamento'],
    ['finance', 'Novo lançamento', 'Novo lançamento']
  ];
  for (const [route, button, dialogTitle] of forms) {
    await page.locator(`[data-route="${route}"]`).click();
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: dialogTitle })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  }
});

test('menu, tabela e modal permanecem utilizáveis no celular', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir ou fechar menu' }).click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);
  await page.locator('[data-route="clients"]').click();
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
  await expect(page.locator('.table-wrap')).toBeVisible();
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
});

test('portal do cliente autentica e abre todos os dados isolados', async ({ page }) => {
  await page.goto('/portal.html');
  await page.getByRole('button', { name: 'Entrar no portal' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  const tabs = [
    ['orders', 'Ordens de serviço'],
    ['quotes', 'Orçamentos'],
    ['contracts', 'Contratos'],
    ['billing', 'Financeiro'],
    ['profile', 'Meu cadastro']
  ];
  for (const [route, heading] of tabs) {
    await page.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('#portal-root h2')).toHaveText(heading);
  }
});

test('administração SaaS autentica e abre os módulos globais', async ({ page }) => {
  await page.goto('/admin.html');
  await page.getByRole('button', { name: 'Entrar na administração' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  const tabs = [
    ['companies', 'Empresas'],
    ['plans', 'Planos'],
    ['resources', 'Recursos'],
    ['alerts', 'Alertas'],
    ['billing', 'Mensalidades']
  ];
  for (const [route, heading] of tabs) {
    await page.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('#admin-root h2')).toHaveText(heading);
  }
});

test('loja pública carrega catálogo e carrinho sem pagamento externo', async ({ page }) => {
  await page.goto('/store.html?company=1');
  await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).first().click();
  await expect(page.getByRole('heading', { name: 'Seu carrinho' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar pedido' })).toBeVisible();
});

test.afterAll(async () => {
  // Guarda de segurança: só limpa no banco de teste local, nunca em outro destino.
  if (process.env.DATABASE_PORT !== '5433' || !['127.0.0.1', 'localhost'].includes(process.env.DATABASE_HOST)) return;
  const connection = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
  });
  await connection.connect();
  const { rows } = await connection.query('SELECT id FROM clientes WHERE nome = $1 AND empresa = 1', [testClientName]);
  for (const row of rows) {
    await connection.query("DELETE FROM node_audit_log WHERE entidade = 'cliente' AND entidade_id = $1 AND empresa = 1", [row.id]);
    await connection.query('DELETE FROM clientes WHERE id = $1 AND empresa = 1', [row.id]);
  }
  await connection.end();
});
