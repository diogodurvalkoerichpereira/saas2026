const { pool } = require('../../config/database');

function tableFor(type, companyId) {
  if (!['payables', 'receivables'].includes(type)) throw Object.assign(new Error('Tipo financeiro inválido.'), { status: 400 });
  const base = type === 'payables' ? 'pagar' : 'receber';
  return companyId > 0 ? base : `${base}_sas`;
}

async function listEntries(type, companyId, filters = {}, db = pool) {
  const table = tableFor(type, companyId);
  const where = ['empresa = ?'];
  const params = [companyId];
  if (filters.paid) { where.push('pago = ?'); params.push(filters.paid); }
  if (filters.from) { where.push('vencimento >= ?'); params.push(filters.from); }
  if (filters.to) { where.push('vencimento <= ?'); params.push(filters.to); }
  const [rows] = await db.execute(`SELECT id, descricao, valor, vencimento, data_pgto, pago, subtotal, referencia, empresa FROM ${table} WHERE ${where.join(' AND ')} ORDER BY vencimento, id`, params);
  return rows;
}

async function settleEntry(type, id, companyId, userId, paymentDate, db = pool) {
  const table = tableFor(type, companyId);
  const [result] = await db.execute(`UPDATE ${table} SET pago = 'Sim', data_pgto = ?, usuario_pgto = ? WHERE id = ? AND empresa = ? AND (pago IS NULL OR pago <> 'Sim')`, [paymentDate, userId, id, companyId]);
  if (!result.affectedRows) throw Object.assign(new Error('Lançamento não encontrado ou já baixado.'), { status: 409 });
}

module.exports = { tableFor, listEntries, settleEntry };
