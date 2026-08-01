'use strict';

const { env } = require('../config/env');
const { pool } = require('../config/database');
const { loadIntegrations } = require('../services/company-integrations');
const { providers, isDisabled } = require('./payment.providers');

const notConfigured = () => Object.assign(new Error('Integração de pagamento não configurada.'), { status: 503 });

function requireAsaasConfig() {
  if (!env.integrations.asaasKey) throw notConfigured();
}

// Resolve o provedor de pagamento DA EMPRESA (config.api_pagamento), com as credenciais dela.
// Sem escolha por empresa, cai na chave de ambiente (Asaas), que era o comportamento anterior.
async function resolvePaymentConfig({ companyId, db = pool } = {}) {
  const config = await loadIntegrations(companyId, db);
  if (config && !isDisabled(config.api_pagamento)) {
    const provider = providers[config.api_pagamento];
    return {
      name: config.api_pagamento,
      provider,
      secret: config[provider.secretField] || '',
      publicKey: config.public_key || ''
    };
  }
  if (env.integrations.asaasKey) {
    return { name: 'Asaas', provider: providers.Asaas, secret: env.integrations.asaasKey, publicKey: '' };
  }
  return null;
}

// Consulta a situação de um pagamento no provedor da empresa, em formato normalizado
// (espelha consultar_pagamento.php do legado, que só cobria o Mercado Pago).
async function getPayment(paymentId, { companyId, db = pool } = {}) {
  const config = await resolvePaymentConfig({ companyId, db });
  if (!config || !config.secret) throw notConfigured();
  return config.provider.getPayment({ secret: config.secret, paymentId });
}

module.exports = { getPayment, requireAsaasConfig, resolvePaymentConfig };
