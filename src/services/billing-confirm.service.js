'use strict';

// Confirmação de pagamento de uma mensalidade do SaaS.
//
// Existe como serviço porque há DOIS caminhos que confirmam a mesma coisa: o administrador clicando
// em "Pagar" no painel e o webhook do provedor avisando que o dinheiro entrou. Se cada um tivesse a
// sua cópia, o upgrade de plano acabaria aplicado em só um deles — e o pago por webhook ficaria com
// a cobrança quitada e o plano antigo, calado.

const { pool } = require('../config/database');
const { audit } = require('./audit.service');
const { applyUpgrade } = require('./plan-upgrade');

/**
 * Marca a mensalidade como paga e, quando ela é a cobrança de um upgrade, troca o plano da empresa.
 *
 * `userId` é null quando quem confirmou foi o provedor (não há usuário por trás de um webhook).
 * Devolve `{ id, upgrade, jaEstavaPaga }` — `jaEstavaPaga` deixa o chamador decidir o que fazer com
 * a repetição: para o painel é erro, para o webhook é normal (provedores reenviam o mesmo aviso).
 */
async function confirmarPagamento({ billingId, userId = null, origem = 'painel', db }) {
  const connection = db || await pool.getConnection();
  const proprio = !db;
  try {
    if (proprio) await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, cliente, referencia, id_ref, pago FROM receber_sas WHERE id = ? LIMIT 1',
      [billingId]
    );
    const conta = rows[0];
    if (!conta) throw Object.assign(new Error('Cobrança não encontrada.'), { status: 404 });
    if (conta.pago === 'Sim') {
      if (proprio) await connection.commit();
      return { id: billingId, upgrade: null, jaEstavaPaga: true };
    }

    await connection.execute(
      "UPDATE receber_sas SET pago = 'Sim', data_pgto = CURRENT_DATE, usuario_pgto = ? WHERE id = ?",
      [userId, billingId]
    );

    let upgrade = null;
    if (conta.referencia === 'Upgrade' && conta.id_ref) {
      upgrade = await applyUpgrade({ companyId: Number(conta.cliente), planId: Number(conta.id_ref), db: connection });
    }
    await audit(connection, {
      companyId: 0, userId, action: 'pagar', entity: 'receber_sas', entityId: billingId,
      details: { origem, ...(upgrade ? { upgradePara: upgrade.plano.nome } : {}) }
    });
    if (proprio) await connection.commit();
    return { id: billingId, upgrade: upgrade ? upgrade.plano : null, jaEstavaPaga: false };
  } catch (error) {
    if (proprio) await connection.rollback();
    throw error;
  } finally {
    if (proprio) connection.release();
  }
}

module.exports = { confirmarPagamento };
