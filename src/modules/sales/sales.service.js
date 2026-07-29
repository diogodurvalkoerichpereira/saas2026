const { pool } = require('../../config/database');

const money = (value) => Math.round(Number(value) * 100);

async function createSale({ clientId, paymentMethodId, dueDate, paid, items, userId, companyId }, db = pool) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const lines = [];
    let totalCents = 0;
    let costCents = 0;
    for (const item of items) {
      const [products] = await connection.execute('SELECT id, valor_venda, valor_compra, estoque, tem_estoque FROM produtos WHERE id = ? AND empresa = ? AND ativo = \'Sim\' FOR UPDATE', [item.productId, companyId]);
      const product = products[0];
      if (!product) throw Object.assign(new Error('Produto indisponível.'), { status: 404 });
      if (product.tem_estoque === 'Sim' && Number(product.estoque) < item.quantity) throw Object.assign(new Error('Estoque insuficiente.'), { status: 409 });
      const unitCents = money(product.valor_venda);
      totalCents += unitCents * item.quantity;
      costCents += money(product.valor_compra) * item.quantity;
      lines.push({ ...item, unitCents });
    }
    const total = (totalCents / 100).toFixed(2);
    const cost = (costCents / 100).toFixed(2);
    const [sale] = await connection.execute(
      `INSERT INTO receber (descricao, cliente, valor, vencimento, data_pgto, data_lanc, forma_pgto, arquivo, referencia, subtotal, usuario_lanc, usuario_pgto, pago, hora, empresa, total_venda, valor_custo)
       VALUES ('Nova Venda', ?, ?, ?, ?, CURRENT_DATE, ?, 'sem-foto.png', 'Venda', ?, ?, ?, ?, CURRENT_TIME, ?, ?, ?)`,
      [clientId, total, dueDate, paid ? dueDate : null, paymentMethodId, total, userId, paid ? userId : 0, paid ? 'Sim' : 'Não', companyId, total, cost]
    );
    for (const line of lines) {
      const lineTotal = ((line.unitCents * line.quantity) / 100).toFixed(2);
      await connection.execute('INSERT INTO itens_venda (produto, valor, quantidade, total, id_venda, funcionario, empresa, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [line.productId, (line.unitCents / 100).toFixed(2), line.quantity, lineTotal, sale.insertId, userId, companyId, 'produto']);
      await connection.execute("UPDATE produtos SET estoque = estoque - ?, vendas = COALESCE(vendas, 0) + ? WHERE id = ? AND empresa = ? AND tem_estoque = 'Sim'", [line.quantity, line.quantity, line.productId, companyId]);
    }
    await connection.commit();
    return { id: sale.insertId, total };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { createSale, money };
