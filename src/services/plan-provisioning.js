'use strict';

const { pool } = require('../config/database');
const { CORE } = require('../config/features');

// Ao definir/trocar o plano de uma empresa, sincroniza clientes_recursos: o núcleo (sempre) +
// os recursos premium do plano. Substitui o conjunto anterior. Sem plano, a empresa fica só com
// o núcleo — nunca sem sistema. Roda em transação quando possível.
async function provisionCompanyResources({ companyId, planId, db = pool }) {
  const owns = typeof db.getConnection === 'function';
  const conn = owns ? await db.getConnection() : db;
  try {
    if (owns) await conn.beginTransaction();
    await conn.execute('DELETE FROM clientes_recursos WHERE empresa = ?', [companyId]);
    // Núcleo sempre entra; recursos premium só se houver plano que os inclua (planos_recursos).
    // Ramifica em JS para não passar parâmetro nu ao pg (evita "could not determine data type").
    const coreList = [...CORE];
    const corePlaceholders = coreList.map(() => '?').join(', ');
    if (planId) {
      await conn.execute(
        `INSERT INTO clientes_recursos (empresa, recurso)
           SELECT ?, r.id FROM recursos r
            WHERE r.chave IN (${corePlaceholders})
               OR r.id IN (SELECT recurso FROM planos_recursos WHERE plano = ?)`,
        [companyId, ...coreList, planId]
      );
    } else {
      await conn.execute(
        `INSERT INTO clientes_recursos (empresa, recurso)
           SELECT ?, r.id FROM recursos r WHERE r.chave IN (${corePlaceholders})`,
        [companyId, ...coreList]
      );
    }
    if (owns) await conn.commit();
  } catch (error) {
    if (owns) await conn.rollback();
    throw error;
  } finally {
    if (owns) conn.release();
  }
}

module.exports = { provisionCompanyResources };
