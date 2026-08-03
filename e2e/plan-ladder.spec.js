const { test, expect, request } = require('@playwright/test');

// A escada de planos precisa ser MONOTÔNICA: quanto mais caro o plano, mais recursos ele entrega.
//
// Isso não é estética — o upgrade lista os planos por valor e chama de "upgrade" todo plano mais
// caro que o atual. Se um plano caro deixasse de fora um recurso que um mais barato tem, o cliente
// pagaria mais para PERDER capacidade, e o sistema ofereceria isso como melhoria. O teste falha na
// hora em que alguém desmarcar um recurso no painel e criar esse degrau.

// A escada cobre todo plano CONFIGURADO, publicado ou não. Um plano ainda inativo é um produto
// prestes a entrar na vitrine — é justamente antes de publicar que o degrau precisa ser pego. Só
// fica de fora quem não tem nenhum recurso marcado, que não é um produto, é um rascunho.
async function montarEscada(ctx, headers) {
  const { items: planos } = await (await ctx.get('/api/admin/plans?pageSize=100', { headers })).json();
  const escada = [];
  for (const plano of planos.sort((a, b) => Number(a.valor) - Number(b.valor))) {
    const { items } = await (await ctx.get(`/api/admin/plans/${plano.id}/resources`, { headers })).json();
    const recursos = new Set(items.filter((r) => r.selecionado === 'Sim').map((r) => r.chave));
    if (recursos.size) escada.push({ plano, recursos });
  }
  return escada;
}

test('nenhum plano mais caro entrega menos que um mais barato', async () => {
  const ctx = await request.newContext();
  const token = (await (await ctx.post('/api/auth/login', { data: { email: 'sas.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  const headers = { authorization: `Bearer ${token}` };

  const escada = await montarEscada(ctx, headers);
  expect(escada.length, 'precisa de pelo menos dois planos configurados para haver escada').toBeGreaterThan(1);

  let anterior = escada[0];
  for (const degrau of escada.slice(1)) {
    const perdidos = [...anterior.recursos].filter((chave) => !degrau.recursos.has(chave));
    expect(
      perdidos,
      `"${degrau.plano.nome}" (R$ ${degrau.plano.valor}) custa mais que "${anterior.plano.nome}" (R$ ${anterior.plano.valor}) mas não inclui: ${perdidos.join(', ')}`
    ).toEqual([]);
    anterior = degrau;
  }
  await ctx.dispose();
});

test('emissão fiscal está em todos os planos acima do primeiro que a oferece', async () => {
  const ctx = await request.newContext();
  const token = (await (await ctx.post('/api/auth/login', { data: { email: 'sas.local@saas2026.local', password: 'Teste@2026' } })).json()).token;
  const headers = { authorization: `Bearer ${token}` };

  const escada = await montarEscada(ctx, headers);
  // Depois do primeiro plano com `fiscal`, nenhum plano acima pode estar sem ele: a nota fiscal não
  // pode sumir num plano mais caro. É exatamente o degrau que motivou a criação do plano Fiscal.
  const primeiro = escada.findIndex((d) => d.recursos.has('fiscal'));
  if (primeiro >= 0) {
    const semFiscalAcima = escada.slice(primeiro + 1).filter((d) => !d.recursos.has('fiscal')).map((d) => d.plano.nome);
    expect(
      semFiscalAcima,
      `a partir de "${escada[primeiro].plano.nome}" todo plano precisa manter a emissão fiscal`
    ).toEqual([]);
  }
  await ctx.dispose();
});
