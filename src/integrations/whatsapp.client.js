const { pool } = require('../config/database');
const { env } = require('../config/env');
const { requestJson } = require('./http-client');
const { loadIntegrations } = require('../services/company-integrations');
const { providers, isDisabled } = require('./whatsapp.providers');

// Configuração POR EMPRESA (config.api_whatsapp / token_whatsapp / instancia_whatsapp), como no
// legado. Sem empresa ou sem provedor escolhido, cai no provedor genérico por ambiente, que é o
// comportamento que existia antes de a escolha por empresa ser suportada.
async function resolveConfig({ companyId, db = pool }) {
  if (companyId) {
    // O token vem decifrado daqui — no banco ele fica cifrado em repouso.
    const row = await loadIntegrations(companyId, db);
    if (row && row.api_whatsapp) {
      return { provider: row.api_whatsapp, token: row.token_whatsapp || '', instance: row.instancia_whatsapp || '' };
    }
  }
  const { whatsappUrl, whatsappToken, whatsappInstanceId } = env.integrations;
  return { provider: whatsappUrl ? 'env' : '', token: whatsappToken || '', instance: whatsappInstanceId || '', url: whatsappUrl };
}

async function sendMessage({ phone, message, companyId, db = pool }) {
  const config = await resolveConfig({ companyId, db });
  if (isDisabled(config.provider)) {
    throw Object.assign(new Error('Integração WhatsApp não configurada.'), { status: 503 });
  }
  if (config.provider === 'env') {
    // Provedor genérico configurado por variável de ambiente (formato próprio deste projeto).
    if (!config.token) throw Object.assign(new Error('Integração WhatsApp não configurada.'), { status: 503 });
    return requestJson(`${config.url.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}` },
      body: { instanceId: config.instance, phone, message }
    });
  }
  const provider = providers[config.provider];
  if (!provider) throw Object.assign(new Error('Provedor de WhatsApp desconhecido.'), { status: 503 });
  if (!config.token) throw Object.assign(new Error('Integração WhatsApp não configurada.'), { status: 503 });
  return provider.send({ token: config.token, instance: config.instance, phone, message });
}

module.exports = { sendMessage, resolveConfig };
