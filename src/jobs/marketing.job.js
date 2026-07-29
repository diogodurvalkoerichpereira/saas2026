const { pool } = require('../config/database');
const { env } = require('../config/env');
const { sendMessage } = require('../integrations/whatsapp.client');

function publicError(error) {
  const text = String(error?.message || 'Falha no envio').replace(/Bearer\s+\S+/gi, 'Bearer [oculto]');
  return text.slice(0, 500);
}

async function processDueDispatches({ companyId, limit = env.marketing.batchSize, db = pool } = {}) {
  if (!env.marketing.dispatchEnabled) return { enabled: false, processed: 0, sent: 0, failed: 0 };
  const connection = typeof db.getConnection === 'function' ? await db.getConnection() : db;
  const ownsConnection = connection !== db;
  const result = { enabled: true, processed: 0, sent: 0, failed: 0 };
  try {
    const tenantFilter = companyId ? ' AND empresa = ?' : '';
    const params = companyId ? [companyId, limit] : [limit];
    const [rows] = await connection.execute(
      `SELECT id, campanha, cliente, telefone, mensagem, empresa
         FROM node_marketing_dispatch
        WHERE status = 'pendente' AND agendado_para <= CURRENT_TIMESTAMP${tenantFilter}
        ORDER BY agendado_para, id
        LIMIT ?`,
      params
    );
    for (const dispatch of rows) {
      const [locked] = await connection.execute(
        `UPDATE node_marketing_dispatch
            SET status = 'processando', tentativas = tentativas + 1, atualizado_em = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'pendente'`,
        [dispatch.id]
      );
      if (!locked.affectedRows) continue;
      result.processed += 1;
      try {
        await sendMessage({ phone: dispatch.telefone, message: dispatch.mensagem });
        await connection.execute(
          `UPDATE node_marketing_dispatch
              SET status = 'enviado', enviado_em = CURRENT_TIMESTAMP, erro = NULL, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [dispatch.id]
        );
        await connection.execute('UPDATE marketing SET envios = COALESCE(envios, 0) + 1 WHERE id = ? AND empresa = ?', [dispatch.campanha, dispatch.empresa]);
        result.sent += 1;
      } catch (error) {
        await connection.execute(
          `UPDATE node_marketing_dispatch
              SET status = CASE WHEN tentativas >= ? THEN 'falhou' ELSE 'pendente' END,
                  erro = ?, agendado_para = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE),
                  atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [env.marketing.maxAttempts, publicError(error), env.marketing.retryMinutes, dispatch.id]
        );
        result.failed += 1;
      }
    }
    return result;
  } finally {
    if (ownsConnection) connection.release();
  }
}

module.exports = { processDueDispatches };
