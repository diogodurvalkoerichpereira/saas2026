const test = require('node:test');
const assert = require('node:assert/strict');
const { providerOptions, isDisabled, decodeBreaks } = require('../src/integrations/whatsapp.providers');
const { sendMessage, resolveConfig } = require('../src/integrations/whatsapp.client');

// Banco falso: devolve a linha de `config` que o teste quiser.
const fakeDb = (row) => ({ execute: async () => [row ? [row] : []] });

test('as opções de provedor espelham as do legado', () => {
  assert.deepEqual(providerOptions.map((option) => option.value), ['Não', 'menuia', 'wm', 'newtek']);
});

test('“Não” e vazio desligam o envio', () => {
  assert.equal(isDisabled('Não'), true);
  assert.equal(isDisabled(''), true);
  assert.equal(isDisabled(null), true);
  assert.equal(isDisabled('menuia'), false);
});

test('%0A vira quebra de linha, como no legado', () => {
  assert.equal(decodeBreaks('linha1%0Alinha2'), 'linha1\nlinha2');
});

test('cada empresa resolve o seu próprio provedor e credenciais', async () => {
  const config = await resolveConfig({
    companyId: 7,
    db: fakeDb({ api_whatsapp: 'newtek', token_whatsapp: 'tok-7', instancia_whatsapp: 'inst-7' })
  });
  assert.deepEqual(config, { provider: 'newtek', token: 'tok-7', instance: 'inst-7' });
});

test('empresa com provedor “Não” não envia', async () => {
  await assert.rejects(
    () => sendMessage({ phone: '5548999990000', message: 'oi', companyId: 3, db: fakeDb({ api_whatsapp: 'Não', token_whatsapp: 'x', instancia_whatsapp: 'y' }) }),
    (error) => error.status === 503
  );
});

test('empresa com provedor escolhido mas sem token falha sem vazar credencial', async () => {
  await assert.rejects(
    () => sendMessage({ phone: '5548999990000', message: 'oi', companyId: 4, db: fakeDb({ api_whatsapp: 'wm', token_whatsapp: '', instancia_whatsapp: 'inst' }) }),
    (error) => error.status === 503 && !/token/i.test(error.message)
  );
});

// Os três provedores têm endpoint, codificação e nomes de campo diferentes; o corpo enviado
// precisa casar com o do legado (painel/apis/texto.php), senão a API rejeita em silêncio.
test('cada provedor monta a requisição no formato que a sua API espera', async () => {
  const chamadas = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const contentType = options.headers['content-type'];
    const body = contentType.includes('json') ? JSON.parse(options.body) : Object.fromEntries(new URLSearchParams(options.body));
    chamadas.push({ url, contentType, body });
    return { ok: true, json: async () => ({}), text: async () => '{}' };
  };
  try {
    for (const provider of ['menuia', 'wm', 'newtek']) {
      await sendMessage({
        phone: '5548999990000', message: 'linha1%0Alinha2', companyId: 1,
        db: fakeDb({ api_whatsapp: provider, token_whatsapp: 'TOK', instancia_whatsapp: 'INST' })
      });
    }
  } finally { globalThis.fetch = originalFetch; }

  const [menuia, wm, newtek] = chamadas;

  assert.match(menuia.url, /chatbot\.menuia\.com/);
  assert.match(menuia.contentType, /x-www-form-urlencoded/);
  assert.equal(menuia.body.appkey, 'TOK');
  assert.equal(menuia.body.authkey, 'INST');
  assert.equal(menuia.body.to, '5548999990000');
  assert.equal(menuia.body.message, 'linha1\nlinha2');
  assert.equal(menuia.body.sandbox, 'false');

  assert.match(wm.url, /wordmensagens\.com\.br/);
  assert.match(wm.contentType, /x-www-form-urlencoded/);
  assert.equal(wm.body.token, 'TOK');
  assert.equal(wm.body.instance, 'INST');
  assert.equal(wm.body.to, '5548999990000');

  assert.match(newtek.url, /newteksoft\.com\.br/);
  assert.match(newtek.contentType, /json/);
  assert.equal(newtek.body.token, 'TOK');
  assert.equal(newtek.body.instancia, 'INST');
  assert.deepEqual(newtek.body.para, ['5548999990000']);
  assert.equal(newtek.body.mensagem, 'linha1\nlinha2');
});
