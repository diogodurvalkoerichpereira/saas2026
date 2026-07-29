const { pool } = require('../config/database');

async function findOverdueReceivables(db = pool) {
  const [rows] = await db.execute(`SELECT id, empresa, cliente, descricao, subtotal, vencimento FROM receber WHERE (pago IS NULL OR pago <> 'Sim') AND vencimento < CURRENT_DATE AND alerta = 'Sim' ORDER BY empresa, vencimento`);
  return rows;
}

module.exports = { findOverdueReceivables };
