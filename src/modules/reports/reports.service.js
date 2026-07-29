const { pool } = require('../../config/database');

async function financialSummary(companyId, db = pool) {
  const [receivables] = await db.execute(`SELECT COALESCE(SUM(CASE WHEN pago = 'Sim' THEN subtotal ELSE 0 END), 0) recebido, COALESCE(SUM(CASE WHEN pago IS NULL OR pago <> 'Sim' THEN subtotal ELSE 0 END), 0) a_receber FROM receber WHERE empresa = ?`, [companyId]);
  const [payables] = await db.execute(`SELECT COALESCE(SUM(CASE WHEN pago = 'Sim' THEN subtotal ELSE 0 END), 0) pago, COALESCE(SUM(CASE WHEN pago IS NULL OR pago <> 'Sim' THEN subtotal ELSE 0 END), 0) a_pagar FROM pagar WHERE empresa = ?`, [companyId]);
  return { ...receivables[0], ...payables[0] };
}

async function operationalSummary(companyId, db = pool) {
  const [orders] = await db.execute('SELECT status, COUNT(*) quantidade, COALESCE(SUM(valor), 0) valor FROM os WHERE empresa = ? GROUP BY status', [companyId]);
  const [stock] = await db.execute("SELECT COUNT(*) produtos, SUM(CASE WHEN tem_estoque = 'Sim' AND estoque <= nivel_estoque THEN 1 ELSE 0 END) estoque_baixo FROM produtos WHERE empresa = ? AND ativo = 'Sim'", [companyId]);
  return { orders, stock: stock[0] };
}

module.exports = { financialSummary, operationalSummary };
