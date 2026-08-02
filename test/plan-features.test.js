'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CORE, PREMIUM, isCore, effectiveResources } = require('../src/config/features');
const { feature } = require('../src/middlewares/feature');

// --- helpers de mock ---
const mkRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};
// Banco falso: devolve linha quando a empresa tem o recurso pedido.
const fakeDb = (empresaTemChaves = []) => ({
  execute: async (_sql, params) => {
    const empresa = params[0];
    const pedidas = params.slice(1);
    const tem = empresa && pedidas.some((c) => empresaTemChaves.includes(c));
    return [tem ? [{ '?column?': 1 }] : []];
  }
});

test('núcleo é mínimo e não se sobrepõe ao que o plano controla', () => {
  for (const chave of CORE) assert.equal(PREMIUM.has(chave), false, `${chave} não pode ser núcleo e do plano`);
  // Só o mínimo para entrar e poder fazer upgrade.
  assert.deepEqual([...CORE].sort(), ['assinatura', 'dashboard']);
  // Tudo o mais é decidido pelo plano — inclusive o que antes era "núcleo".
  assert.equal(isCore('financeiro'), false);
  assert.equal(isCore('clientes'), false);
  assert.equal(isCore('marketing'), false);
  assert.equal(isCore('dashboard'), true);
});

test('recursos efetivos sempre incluem o núcleo mínimo', () => {
  const eff = effectiveResources(['marketing']);
  assert.equal(eff.has('marketing'), true);
  assert.equal(eff.has('dashboard'), true); // núcleo entra mesmo sem estar na lista
  assert.equal(eff.has('financeiro'), false); // não veio do plano: não entra
});

test('feature() libera o núcleo mínimo sem consultar o banco', async () => {
  let consultou = false;
  const db = { execute: async () => { consultou = true; return [[]]; } };
  const mw = feature('dashboard'); // núcleo
  const res = mkRes();
  let chamouNext = false;
  await mw({ auth: { role: 'Gerente', companyId: 5 }, db }, res, () => { chamouNext = true; });
  assert.equal(chamouNext, true);
  assert.equal(consultou, false);
});

test('feature() bloqueia recurso premium ausente com 403', async () => {
  const mw = feature('marketing');
  const req = { auth: { role: 'Gerente', companyId: 5 } };
  req.execute = undefined;
  const res = mkRes();
  // injeta db pelo pool: usamos o middleware real, mas com um pool mockado via require cache
  // Aqui testamos a decisão passando o db no req não é suportado; então validamos via pool mock:
  const orig = require('../src/config/database').pool.execute;
  require('../src/config/database').pool.execute = fakeDb([]).execute;
  try {
    let chamouNext = false;
    await mw(req, res, () => { chamouNext = true; });
    assert.equal(chamouNext, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'RECURSO_NAO_INCLUIDO');
  } finally { require('../src/config/database').pool.execute = orig; }
});

test('feature() libera recurso premium presente', async () => {
  const mw = feature('marketing');
  const res = mkRes();
  const orig = require('../src/config/database').pool.execute;
  require('../src/config/database').pool.execute = fakeDb(['marketing']).execute;
  try {
    let chamouNext = false;
    await mw({ auth: { role: 'Gerente', companyId: 5 } }, res, () => { chamouNext = true; });
    assert.equal(chamouNext, true);
    assert.equal(res.statusCode, null);
  } finally { require('../src/config/database').pool.execute = orig; }
});

test('só o painel do sistema (empresa 0) ignora o plano', async () => {
  const mw = feature('marketing');
  // Empresa 0 (painel SaaS) passa sem consultar recurso.
  const res0 = mkRes();
  let passou0 = false;
  await mw({ auth: { role: 'Administrador', companyId: 0 } }, res0, () => { passou0 = true; });
  assert.equal(passou0, true);
});

test('o Administrador da EMPRESA também é limitado pelo plano', async () => {
  const mw = feature('marketing');
  const res = mkRes();
  const orig = require('../src/config/database').pool.execute;
  require('../src/config/database').pool.execute = fakeDb([]).execute; // empresa sem o recurso
  try {
    let chamouNext = false;
    await mw({ auth: { role: 'Administrador', companyId: 5 } }, res, () => { chamouNext = true; });
    assert.equal(chamouNext, false, 'admin da empresa não pode furar o plano');
    assert.equal(res.statusCode, 403);
  } finally { require('../src/config/database').pool.execute = orig; }
});
