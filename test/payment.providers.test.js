'use strict';

process.env.FISCAL_ENCRYPTION_KEY = 'chave-de-teste-suficientemente-longa-para-o-cofre';

const test = require('node:test');
const assert = require('node:assert/strict');
const { providerOptions, isDisabled } = require('../src/integrations/payment.providers');
const { getPayment, resolvePaymentConfig } = require('../src/integrations/payments.client');
const { encrypt, decryptMaybe } = require('../src/lib/secrets');

// Banco falso devolvendo a linha de `config` que o teste quiser.
const fakeDb = (row) => ({ execute: async () => [row ? [row] : []] });

test('as opções de pagamento espelham as do legado', () => {
  assert.deepEqual(providerOptions.map((option) => option.value), ['', 'Mercado Pago', 'Asaas']);
});

test('sem provedor escolhido a integração fica desligada', () => {
  assert.equal(isDisabled(''), true);
  assert.equal(isDisabled(null), true);
  assert.equal(isDisabled('Provedor Pirata'), true);
  assert.equal(isDisabled('Asaas'), false);
  assert.equal(isDisabled('Mercado Pago'), false);
});

test('cada empresa resolve o seu provedor e a sua credencial, decifrada', async () => {
  const config = await resolvePaymentConfig({
    companyId: 9,
    db: fakeDb({ api_pagamento: 'Asaas', chave_api_asaas: encrypt('CHAVE-ASAAS'), access_token: null, public_key: 'PUB' })
  });
  assert.equal(config.name, 'Asaas');
  assert.equal(config.secret, 'CHAVE-ASAAS');
});

test('Mercado Pago usa access_token e expõe a public_key', async () => {
  const config = await resolvePaymentConfig({
    companyId: 9,
    db: fakeDb({ api_pagamento: 'Mercado Pago', access_token: encrypt('MP-SECRETO'), chave_api_asaas: null, public_key: 'MP-PUBLICA' })
  });
  assert.equal(config.name, 'Mercado Pago');
  assert.equal(config.secret, 'MP-SECRETO');
  assert.equal(config.publicKey, 'MP-PUBLICA');
});

test('provedor escolhido sem credencial falha sem vazar a chave', async () => {
  await assert.rejects(
    () => getPayment('123', { companyId: 5, db: fakeDb({ api_pagamento: 'Asaas', chave_api_asaas: null }) }),
    (error) => error.status === 503 && !/chave|token/i.test(error.message)
  );
});

// Cada API responde num vocabulário próprio; o resto do app só vê o formato normalizado.
test('as duas APIs são chamadas no formato certo e normalizadas', async () => {
  const chamadas = [];
  const originalFetch = globalThis.fetch;
  const respostas = {
    asaas: { id: 'pay_1', status: 'RECEIVED', value: 150.5, billingType: 'PIX' },
    mp: { id: 99, status: 'approved', transaction_amount: 80.25, payment_type_id: 'bank_transfer', payment_method_id: 'pix' }
  };
  globalThis.fetch = async (url, options) => {
    chamadas.push({ url, headers: options.headers });
    const body = String(url).includes('asaas') ? respostas.asaas : respostas.mp;
    return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
  };
  try {
    const asaas = await getPayment('pay_1', {
      companyId: 1, db: fakeDb({ api_pagamento: 'Asaas', chave_api_asaas: encrypt('K-ASAAS') })
    });
    assert.equal(asaas.provider, 'Asaas');
    assert.equal(asaas.paid, true);
    assert.equal(asaas.amount, 150.5);
    assert.equal(asaas.method, 'PIX');
    // Asaas autentica por cabeçalho access_token, não por Bearer.
    assert.equal(chamadas[0].headers.access_token, 'K-ASAAS');
    assert.match(chamadas[0].url, /api\.asaas\.com\/v3\/payments\/pay_1/);

    const mp = await getPayment('99', {
      companyId: 1, db: fakeDb({ api_pagamento: 'Mercado Pago', access_token: encrypt('K-MP') })
    });
    assert.equal(mp.provider, 'Mercado Pago');
    assert.equal(mp.paid, true);
    assert.equal(mp.amount, 80.25);
    assert.equal(mp.method, 'Pix'); // bank_transfer traduzido, como no legado
    assert.equal(chamadas[1].headers.authorization, 'Bearer K-MP');
    assert.match(chamadas[1].url, /api\.mercadopago\.com\/v1\/payments\/99/);
  } finally { globalThis.fetch = originalFetch; }
});

test('pagamento não aprovado não é marcado como pago', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'pending' }), text: async () => '{}' });
  try {
    const mp = await getPayment('1', { companyId: 1, db: fakeDb({ api_pagamento: 'Mercado Pago', access_token: encrypt('K') }) });
    assert.equal(mp.paid, false);
  } finally { globalThis.fetch = originalFetch; }
});

// Segredos gravados antes da cifra existir precisam continuar legíveis durante a transição.
test('decryptMaybe devolve texto puro legado sem quebrar', () => {
  assert.equal(decryptMaybe('chave-em-texto-puro-antiga'), 'chave-em-texto-puro-antiga');
  assert.equal(decryptMaybe(encrypt('cifrada')), 'cifrada');
  assert.equal(decryptMaybe(null), '');
  assert.equal(decryptMaybe(''), '');
});
