const { pool } = require('../../config/database');

const money = (value) => Math.round(Number(value) * 100);

async function listSales(companyId, restrictToUserId, db = pool) {
  const ownerFilter = restrictToUserId ? ' AND r.usuario_lanc = ?' : '';
  const params = restrictToUserId ? [companyId, restrictToUserId] : [companyId];
  const [rows] = await db.execute(
    `SELECT r.id, r.cliente, r.valor, r.subtotal, r.total_venda, r.valor_custo, r.vencimento, r.data_lanc, r.data_pgto,
            r.pago, r.forma_pgto, r.node_status, r.node_cancel_reason, r.empresa,
            (SELECT nome FROM clientes c WHERE c.id = r.cliente AND c.empresa = r.empresa LIMIT 1) AS cliente_nome,
            (SELECT nome FROM formas_pgto f WHERE f.id = r.forma_pgto AND f.empresa = r.empresa LIMIT 1) AS forma_pgto_nome
       FROM receber r
      WHERE r.empresa = ? AND r.referencia = 'Venda'${ownerFilter}
      ORDER BY r.data_lanc DESC, r.id DESC`,
    params
  );
  return rows;
}

async function getSale(id, companyId, db = pool) {
  const [sales] = await db.execute(
    `SELECT r.id, r.cliente, r.valor, r.subtotal, r.total_venda, r.valor_custo, r.vencimento, r.data_lanc, r.data_pgto,
            r.pago, r.forma_pgto, r.node_status, r.node_cancel_reason, r.empresa,
            (SELECT nome FROM clientes c WHERE c.id = r.cliente AND c.empresa = r.empresa LIMIT 1) AS cliente_nome
       FROM receber r WHERE r.id = ? AND r.empresa = ? AND r.referencia = 'Venda' LIMIT 1`,
    [id, companyId]
  );
  if (!sales[0]) throw Object.assign(new Error('Venda não encontrada.'), { status: 404 });
  const [items] = await db.execute(
    `SELECT i.id, i.produto, i.valor, i.quantidade, i.total, i.tipo,
            CASE WHEN i.tipo = 'servico'
                 THEN (SELECT nome FROM servicos s WHERE s.id = i.produto AND s.empresa = i.empresa LIMIT 1)
                 ELSE (SELECT nome FROM produtos p WHERE p.id = i.produto AND p.empresa = i.empresa LIMIT 1)
            END AS produto_nome
       FROM itens_venda i WHERE i.id_venda = ? AND i.empresa = ? ORDER BY i.id`,
    [id, companyId]
  );
  return { ...sales[0], items };
}

async function createSale({ clientId, paymentMethodId, dueDate, paid, items, desconto = 0, tipo_desconto = 'Valor', obs = '', userId, companyId }, db = pool) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const lines = [];
    let totalCents = 0;
    let costCents = 0;
    for (const item of items) {
      if (item.type === 'servico') {
        const [services] = await connection.execute("SELECT id, valor FROM servicos WHERE id = ? AND empresa = ? AND ativo = 'Sim'", [item.id, companyId]);
        const service = services[0];
        if (!service) throw Object.assign(new Error('Serviço indisponível.'), { status: 404 });
        const unitCents = money(service.valor);
        totalCents += unitCents * item.quantity;
        lines.push({ type: 'servico', id: item.id, quantity: item.quantity, unitCents });
        continue;
      }
      const [products] = await connection.execute('SELECT id, valor_venda, valor_compra, estoque, tem_estoque FROM produtos WHERE id = ? AND empresa = ? AND ativo = \'Sim\' FOR UPDATE', [item.id, companyId]);
      const product = products[0];
      if (!product) throw Object.assign(new Error('Produto indisponível.'), { status: 404 });
      if (product.tem_estoque === 'Sim' && Number(product.estoque) < item.quantity) throw Object.assign(new Error('Estoque insuficiente.'), { status: 409 });
      const unitCents = money(product.valor_venda);
      totalCents += unitCents * item.quantity;
      costCents += money(product.valor_compra) * item.quantity;
      lines.push({ type: 'produto', id: item.id, quantity: item.quantity, unitCents });
    }
    const grossCents = totalCents;
    let discountCents = tipo_desconto === 'Percentual'
      ? Math.round((grossCents * Number(desconto || 0)) / 100)
      : money(Number(desconto || 0));
    if (!Number.isFinite(discountCents) || discountCents < 0) discountCents = 0;
    if (discountCents > grossCents) discountCents = grossCents;
    const netCents = grossCents - discountCents;
    const total = (netCents / 100).toFixed(2);
    const gross = (grossCents / 100).toFixed(2);
    const discount = (discountCents / 100).toFixed(2);
    const cost = (costCents / 100).toFixed(2);
    // Vincula a venda ao caixa aberto do operador, para ela entrar no saldo/fechamento do caixa
    // (espelha vendas.php do legado). Sem caixa aberto, a venda ainda é registrada (caixa = NULL).
    const [openCash] = await connection.execute(
      'SELECT id FROM caixas WHERE operador = ? AND data_fechamento IS NULL AND empresa = ? ORDER BY id DESC LIMIT 1',
      [userId, companyId]
    );
    const cashId = openCash[0] ? openCash[0].id : null;
    const [sale] = await connection.execute(
      `INSERT INTO receber (descricao, cliente, valor, vencimento, data_pgto, data_lanc, forma_pgto, arquivo, referencia, subtotal, desconto, obs, usuario_lanc, usuario_pgto, pago, hora, empresa, total_venda, valor_custo, caixa)
       VALUES ('Nova Venda', ?, ?, ?, ?, CURRENT_DATE, ?, 'sem-foto.png', 'Venda', ?, ?, ?, ?, ?, ?, LOCALTIME, ?, ?, ?, ?)`,
      [clientId, total, dueDate, paid ? dueDate : null, paymentMethodId, gross, discount, obs ?? '', userId, paid ? userId : 0, paid ? 'Sim' : 'Não', companyId, gross, cost, cashId]
    );
    for (const line of lines) {
      const lineTotal = ((line.unitCents * line.quantity) / 100).toFixed(2);
      await connection.execute('INSERT INTO itens_venda (produto, valor, quantidade, total, id_venda, funcionario, empresa, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [line.id, (line.unitCents / 100).toFixed(2), line.quantity, lineTotal, sale.insertId, userId, companyId, line.type]);
      if (line.type === 'produto') {
        await connection.execute("UPDATE produtos SET estoque = CASE WHEN tem_estoque = 'Sim' THEN estoque - ? ELSE estoque END, vendas = COALESCE(vendas, 0) + ? WHERE id = ? AND empresa = ?", [line.quantity, line.quantity, line.id, companyId]);
      }
    }
    await connection.commit();
    return { id: sale.insertId, total };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

async function cancelSale(id, companyId, userId, reason, db = pool) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [sales] = await connection.execute("SELECT id, node_status FROM receber WHERE id = ? AND empresa = ? AND referencia = 'Venda' FOR UPDATE", [id, companyId]);
    if (!sales[0] || sales[0].node_status === 'cancelado') throw Object.assign(new Error('Venda não encontrada ou já cancelada.'), { status: 409 });
    const [items] = await connection.execute("SELECT produto, quantidade FROM itens_venda WHERE id_venda = ? AND empresa = ? AND tipo = 'produto'", [id, companyId]);
    for (const item of items) {
      await connection.execute(
        "UPDATE produtos SET estoque = CASE WHEN tem_estoque = 'Sim' THEN estoque + ? ELSE estoque END, vendas = GREATEST(COALESCE(vendas, 0) - ?, 0) WHERE id = ? AND empresa = ?",
        [item.quantidade, item.quantidade, item.produto, companyId]
      );
    }
    await connection.execute(
      "UPDATE receber SET node_status = 'cancelado', cancelada = 'Sim', node_cancel_reason = ?, node_cancelled_at = CURRENT_TIMESTAMP, node_cancelled_by = ? WHERE id = ? AND empresa = ?",
      [reason, userId, id, companyId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { listSales, getSale, createSale, cancelSale, money };
