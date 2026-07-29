const { env } = require('../config/env');
const { requestJson } = require('./http-client');

async function sendMessage({ phone, message }) {
  const { whatsappUrl, whatsappToken, whatsappInstanceId } = env.integrations;
  if (!whatsappUrl || !whatsappToken) throw Object.assign(new Error('Integração WhatsApp não configurada.'), { status: 503 });
  return requestJson(`${whatsappUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST', headers: { authorization: `Bearer ${whatsappToken}` }, body: { instanceId: whatsappInstanceId, phone, message }
  });
}

module.exports = { sendMessage };
