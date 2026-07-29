const { pool } = require('../../config/database');

function tableFor(type, companyId) {
  if (!['payables', 'receivables'].includes(type)) throw Object.assign(new Error('Tipo financeiro inválido.'), { status: 400 });
  const base = type === 'payables' ? 'pagar' : 'receber';
  return companyId > 0 ? base : `${base}_sas`;
}

function personProjection(type, table) {
  if (type === 'payables') return `(SELECT nome FROM fornecedores f WHERE f.id = ${table}.fornecedor AND f.empresa = ${table}.empresa LIMIT 1) AS pessoa_nome`;
  return `(SELECT nome FROM clientes c WHERE c.id = ${table}.cliente AND c.empresa = ${table}.empresa LIMIT 1) AS pessoa_nome`;
}

function paymentProjection(table) {
  return `(SELECT nome FROM formas_pgto fp WHERE fp.id = ${table}.forma_pgto AND fp.empresa = ${table}.empresa LIMIT 1) AS forma_pgto_nome`;
}

async function listPaymentMethods(companyId, db = pool) {
  const [rows] = await db.execute('SELECT id, nome, empresa FROM formas_pgto WHERE empresa = ? ORDER BY nome', [companyId]);
  return rows;
}

async function listEntries(type, companyId, filters = {}, db = pool) {
  const table = tableFor(type, companyId);
  const where = ['empresa = ?'];
  const params = [companyId];
  if (filters.paid) { where.push('pago = ?'); params.push(filters.paid); }
  if (filters.from) { where.push('vencimento >= ?'); params.push(filters.from); }
  if (filters.to) { where.push('vencimento <= ?'); params.push(filters.to); }
  const [rows] = await db.execute(
    `SELECT id, descricao, ${type === 'payables' ? 'fornecedor' : 'cliente'}, valor, vencimento, data_pgto, pago, subtotal,
            referencia, forma_pgto, obs, empresa, node_status, node_cancel_reason, ${personProjection(type, table)}, ${paymentProjection(table)}
       FROM ${table} WHERE ${where.join(' AND ')} ORDER BY vencimento, id`,
    params
  );
  return rows;
}

async function getEntry(type, id, companyId, db = pool) {
  const table = tableFor(type, companyId);
  const [rows] = await db.execute(
    `SELECT id, descricao, ${type === 'payables' ? 'fornecedor' : 'cliente'}, valor, vencimento, data_pgto, pago, subtotal,
            referencia, forma_pgto, obs, empresa, node_status, node_cancel_reason, ${personProjection(type, table)}, ${paymentProjection(table)}
       FROM ${table} WHERE id = ? AND empresa = ? LIMIT 1`,
    [id, companyId]
  );
  if (!rows[0]) throw Object.assign(new Error('Lançamento não encontrado.'), { status: 404 });
  return rows[0];
}

async function createEntry(type, data, companyId, userId, db = pool) {
  const table = tableFor(type, companyId);
  const paid = data.pago ?? 'Não';
  if (type === 'payables') {
    const [result] = await db.execute(
      `INSERT INTO ${table}
        (descricao, fornecedor, funcionario, valor, vencimento, data_pgto, data_lanc, forma_pgto, frequencia, obs, referencia, subtotal, usuario_lanc, usuario_pgto, pago, empresa, node_status)
       VALUES (?, ?, 0, ?, ?, ?, CURRENT_DATE, ?, 0, ?, 'Conta', ?, ?, ?, ?, ?, 'ativo')`,
      [data.descricao, data.fornecedor ?? 0, data.valor, data.vencimento, paid === 'Sim' ? data.vencimento : null, data.forma_pgto ?? 0, data.obs ?? '', data.valor, userId, paid === 'Sim' ? userId : 0, paid, companyId]
    );
    return result.insertId;
  }
  const [result] = await db.execute(
    `INSERT INTO ${table}
      (descricao, cliente, valor, vencimento, data_pgto, data_lanc, forma_pgto, obs, referencia, subtotal, usuario_lanc, usuario_pgto, pago, empresa, node_status)
     VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, 'Conta', ?, ?, ?, ?, ?, 'ativo')`,
    [data.descricao, data.cliente ?? 0, data.valor, data.vencimento, paid === 'Sim' ? data.vencimento : null, data.forma_pgto ?? 0, data.obs ?? '', data.valor, userId, paid === 'Sim' ? userId : 0, paid, companyId]
  );
  return result.insertId;
}

async function updateEntry(type, id, data, companyId, db = pool) {
  const table = tableFor(type, companyId);
  const allowed = ['descricao', 'valor', 'vencimento', 'forma_pgto', 'obs', type === 'payables' ? 'fornecedor' : 'cliente'];
  const changed = allowed.filter((field) => data[field] !== undefined);
  if (!changed.length) return;
  const [result] = await db.execute(
    `UPDATE ${table} SET ${changed.map((field) => `${field} = ?`).join(', ')}, subtotal = ${data.valor !== undefined ? '?' : 'subtotal'}
      WHERE id = ? AND empresa = ? AND (pago IS NULL OR pago <> 'Sim') AND node_status = 'ativo'`,
    [...changed.map((field) => data[field]), ...(data.valor !== undefined ? [data.valor] : []), id, companyId]
  );
  if (!result.affectedRows) throw Object.assign(new Error('Somente lançamentos ativos e não pagos podem ser editados.'), { status: 409 });
}

async function settleEntry(type, id, companyId, userId, paymentDate, db = pool) {
  const table = tableFor(type, companyId);
  const [result] = await db.execute(`UPDATE ${table} SET pago = 'Sim', data_pgto = ?, usuario_pgto = ? WHERE id = ? AND empresa = ? AND node_status = 'ativo' AND (pago IS NULL OR pago <> 'Sim')`, [paymentDate, userId, id, companyId]);
  if (!result.affectedRows) throw Object.assign(new Error('Lançamento não encontrado, cancelado ou já baixado.'), { status: 409 });
}

async function reopenEntry(type, id, companyId, db = pool) {
  const table = tableFor(type, companyId);
  const [result] = await db.execute(`UPDATE ${table} SET pago = 'Não', data_pgto = NULL, usuario_pgto = 0 WHERE id = ? AND empresa = ? AND node_status = 'ativo' AND pago = 'Sim'`, [id, companyId]);
  if (!result.affectedRows) throw Object.assign(new Error('Somente lançamentos pagos e ativos podem ser reabertos.'), { status: 409 });
}

async function cancelEntry(type, id, companyId, userId, reason, db = pool) {
  const table = tableFor(type, companyId);
  const [result] = await db.execute(
    `UPDATE ${table} SET node_status = 'cancelado', node_cancel_reason = ?, node_cancelled_at = CURRENT_TIMESTAMP, node_cancelled_by = ?
      WHERE id = ? AND empresa = ? AND node_status = 'ativo' AND (pago IS NULL OR pago <> 'Sim')`,
    [reason, userId, id, companyId]
  );
  if (!result.affectedRows) throw Object.assign(new Error('Reabra o lançamento pago antes de cancelá-lo.'), { status: 409 });
}

module.exports = { tableFor, listPaymentMethods, listEntries, getEntry, createEntry, updateEntry, settleEntry, reopenEntry, cancelEntry };
