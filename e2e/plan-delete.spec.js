const { test, expect, request } = require('@playwright/test');

// Exclusão de plano no painel do SaaS. O legado apagava direto (sas/paginas/planos/excluir.php) e
// deixava `empresas.plano` apontando para um plano inexistente — a empresa seguia cobrada, mas sem
// nome de plano, sem limites e sem conseguir fazer upgrade. Aqui a exclusão é recusada enquanto
// alguém depender do plano; estes testes são a garantia dessa regra.

async function saas() {
  const ctx = await request.newContext();
  const token = (await (await ctx.post('/api/auth/login', { data: { email: 'sas.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  return { ctx, headers: { authorization: `Bearer ${token}` } };
}

const acharPlano = async (ctx, headers, nome) =>
  (await (await ctx.get('/api/admin/plans?pageSize=100', { headers })).json()).items.find((p) => p.nome === nome);

// Estes testes põem a empresa 1 num plano descartável. Se um deles falhar no meio, a empresa fica
// presa nesse plano e os testes seguintes (e os outros arquivos) herdam o estado errado — então a
// volta para o Enterprise acontece depois de CADA teste, dando certo ou não.
test.afterEach(async () => {
  const { ctx, headers } = await saas();
  try {
    const enterprise = await acharPlano(ctx, headers, 'Enterprise');
    if (enterprise) await ctx.patch('/api/admin/companies/1', { headers, data: { plano: enterprise.id } });
  } catch { /* não mascara a falha do teste */ }
  await ctx.dispose();
});

test('plano sem ninguém é excluído junto com recursos e características', async () => {
  const { ctx, headers } = await saas();
  const nome = `Descartável ${Date.now()}`;
  const criado = await (await ctx.post('/api/admin/plans', { headers, data: { nome, valor: 10, ativo: 'Não' } })).json();
  const disponiveis = await (await ctx.get(`/api/admin/plans/${criado.id}/resources`, { headers })).json();
  await ctx.put(`/api/admin/plans/${criado.id}/resources`, {
    headers, data: { resourceIds: disponiveis.items.slice(0, 2).map((r) => r.id), items: ['Item de teste'] }
  });

  expect((await ctx.delete(`/api/admin/plans/${criado.id}`, { headers })).status()).toBe(204);
  // Sumiu da listagem e o GET dos recursos não acha mais nada preso a ele.
  expect(await acharPlano(ctx, headers, nome)).toBeUndefined();
  const sobras = await (await ctx.get(`/api/admin/plans/${criado.id}/resources`, { headers })).json();
  expect(sobras.itens, 'as características do plano vão junto').toEqual([]);
  expect(sobras.items.filter((r) => r.selecionado === 'Sim'), 'os recursos do plano vão junto').toEqual([]);

  // Excluir de novo é 404, não 204 silencioso.
  expect((await ctx.delete(`/api/admin/plans/${criado.id}`, { headers })).status()).toBe(404);
  await ctx.dispose();
});

test('plano assinado por uma empresa não pode ser excluído', async () => {
  const { ctx, headers } = await saas();
  const nome = `Em uso ${Date.now()}`;
  const criado = await (await ctx.post('/api/admin/plans', { headers, data: { nome, valor: 15, ativo: 'Não' } })).json();
  const original = (await (await ctx.get('/api/admin/companies/1', { headers })).json()).plano;
  await ctx.patch('/api/admin/companies/1', { headers, data: { plano: criado.id } });

  const recusa = await ctx.delete(`/api/admin/plans/${criado.id}`, { headers });
  expect(recusa.status()).toBe(409);
  const corpo = await recusa.json();
  expect(corpo.error, 'a recusa precisa dizer o que está preso e o que fazer').toContain('empresa');
  expect(corpo.error).toContain('inativo');
  // E o plano continua lá — recusa não pode ter apagado nada pela metade.
  expect(await acharPlano(ctx, headers, nome)).toBeTruthy();

  // Tirando a empresa de cima, a exclusão passa.
  await ctx.patch('/api/admin/companies/1', { headers, data: { plano: original } });
  expect((await ctx.delete(`/api/admin/plans/${criado.id}`, { headers })).status()).toBe(204);
  await ctx.dispose();
});

test('plano com downgrade agendado também é protegido', async () => {
  const { ctx, headers } = await saas();
  const criado = await (await ctx.post('/api/admin/plans', { headers, data: { nome: `Agendado ${Date.now()}`, valor: 5, ativo: 'Sim' } })).json();
  const original = (await (await ctx.get('/api/admin/companies/1', { headers })).json()).plano;

  // Lojista agenda a descida para este plano (mais barato que o atual).
  const tenant = (await (await ctx.post('/api/auth/login', { data: { email: 'teste.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  const th = { authorization: `Bearer ${tenant}` };
  const pedido = await ctx.post('/api/content/subscription/upgrade', { headers: th, data: { planId: criado.id } });
  expect(pedido.status(), 'o agendamento do downgrade precisa ser aceito').toBeLessThan(300);

  const recusa = await ctx.delete(`/api/admin/plans/${criado.id}`, { headers });
  expect(recusa.status()).toBe(409);
  expect((await recusa.json()).error).toContain('downgrade agendado');

  // Limpeza: cancela o agendamento e exclui.
  await ctx.delete('/api/content/subscription/upgrade', { headers: th }).catch(() => {});
  await ctx.patch('/api/admin/companies/1', { headers, data: { plano: original } });
  await ctx.delete(`/api/admin/plans/${criado.id}`, { headers });
  await ctx.dispose();
});
