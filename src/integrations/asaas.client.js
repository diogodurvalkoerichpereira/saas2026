const { env } = require('../config/env');
const { requestJson } = require('./http-client');

function requireAsaasConfig() {
  if (!env.integrations.asaasKey) throw Object.assign(new Error('Integração Asaas não configurada.'), { status: 503 });
}

async function getPayment(paymentId) {
  requireAsaasConfig();
  return requestJson(`${env.integrations.asaasUrl}/payments/${encodeURIComponent(paymentId)}`, { headers: { access_token: env.integrations.asaasKey } });
}

module.exports = { getPayment, requireAsaasConfig };
