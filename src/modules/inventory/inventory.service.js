const { pool } = require('../../config/database');

async function listMovements(companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT 'entrada' AS tipo, id, produto, quantidade, motivo, usuario, data FROM entradas WHERE empresa = ?
     UNION ALL
     SELECT 'saida' AS tipo, id, produto, quantidade, motivo, usuario, data FROM saidas WHERE empresa = ?
     ORDER BY data DESC, id DESC`, [companyId, companyId]
  );
  return rows;
}

async function moveStock({ type, productId, quantity, reason, userId, companyId }, db = pool) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [products] = await connection.execute('SELECT id, estoque, tem_estoque FROM produtos WHERE id = ? AND empresa = ? FOR UPDATE', [productId, companyId]);
    const product = products[0];
    if (!product) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });
    const delta = type === 'entrada' ? quantity : -quantity;
    if (product.tem_estoque === 'Sim' && Number(product.estoque) + delta < 0) throw Object.assign(new Error('Estoque insuficiente.'), { status: 409 });
    await connection.execute('UPDATE produtos SET estoque = estoque + ? WHERE id = ? AND empresa = ?', [delta, productId, companyId]);
    const table = type === 'entrada' ? 'entradas' : 'saidas';
    await connection.execute(`INSERT INTO ${table} (produto, quantidade, motivo, usuario, data, empresa) VALUES (?, ?, ?, ?, CURRENT_DATE, ?)`, [productId, quantity, reason, userId, companyId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { listMovements, moveStock };
