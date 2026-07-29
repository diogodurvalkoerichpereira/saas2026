const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAsaasConfig } = require('../src/integrations/asaas.client');
const { sendMessage } = require('../src/integrations/whatsapp.client');

test('Asaas falha de forma segura quando a chave não está configurada', () => {
  assert.throws(requireAsaasConfig, (error) => error.status === 503);
});

test('WhatsApp falha sem expor token quando não configurado', async () => {
  await assert.rejects(() => sendMessage({ phone: '5500000000000', message: 'teste' }), (error) => error.status === 503 && !error.message.includes('token'));
});
