'use strict';

const { pool } = require('../config/database');
const { decryptMaybe } = require('../lib/secrets');

// Colunas de `config` que guardam segredo cifrado em repouso. `public_key` fica de fora de
// propósito: a chave pública do Mercado Pago é feita para aparecer no navegador.
const SECRET_COLUMNS = ['token_whatsapp', 'chave_api_asaas', 'access_token'];

// Carrega a configuração de integrações da empresa, já decifrada. Uma consulta só, porque
// WhatsApp e pagamento moram na mesma linha de `config`.
async function loadIntegrations(companyId, db = pool) {
  // Compara com null/undefined em vez de usar `!companyId`: a empresa 0 é o próprio SaaS, e a
  // configuração dela é justamente a que abre a cobrança da assinatura. Com o teste de falsidade,
  // `loadIntegrations(0)` devolvia null e o checkout nunca achava provedor nenhum.
  if (companyId === null || companyId === undefined || companyId === '') return null;
  if (!Number.isFinite(Number(companyId))) return null;
  const [rows] = await db.execute(
    `SELECT api_whatsapp, token_whatsapp, instancia_whatsapp,
            api_pagamento, chave_api_asaas, access_token, public_key, dados_pagamento
       FROM config WHERE empresa = ? ORDER BY id DESC LIMIT 1`,
    [Number(companyId)]
  );
  const row = rows[0];
  if (!row) return null;
  const decoded = { ...row };
  for (const column of SECRET_COLUMNS) decoded[column] = decryptMaybe(row[column]);
  return decoded;
}

module.exports = { loadIntegrations, SECRET_COLUMNS };
