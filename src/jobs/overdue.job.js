const { pool } = require('../config/database');

async function findOverdueReceivables({ sas = false } = {}, db = pool) {
  const table = sas ? 'receber_sas' : 'receber';
  const [rows] = await db.execute(`SELECT id, empresa, cliente, descricao, subtotal, vencimento FROM ${table} WHERE (pago IS NULL OR pago <> 'Sim') AND vencimento < CURRENT_DATE AND alerta = 'Sim' ORDER BY empresa, vencimento`);
  return rows;
}

module.exports = { findOverdueReceivables };
