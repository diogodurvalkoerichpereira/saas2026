const { pool } = require('../../config/database');

async function financialSummary(companyId, db = pool) {
  const receivablesTable = companyId > 0 ? 'receber' : 'receber_sas';
  const payablesTable = companyId > 0 ? 'pagar' : 'pagar_sas';
  const [receivables] = await db.execute(`SELECT COALESCE(SUM(CASE WHEN pago = 'Sim' THEN subtotal ELSE 0 END), 0) recebido, COALESCE(SUM(CASE WHEN pago IS NULL OR pago <> 'Sim' THEN subtotal ELSE 0 END), 0) a_receber FROM ${receivablesTable} WHERE empresa = ?`, [companyId]);
  const [payables] = await db.execute(`SELECT COALESCE(SUM(CASE WHEN pago = 'Sim' THEN subtotal ELSE 0 END), 0) pago, COALESCE(SUM(CASE WHEN pago IS NULL OR pago <> 'Sim' THEN subtotal ELSE 0 END), 0) a_pagar FROM ${payablesTable} WHERE empresa = ?`, [companyId]);
  return { ...receivables[0], ...payables[0] };
}

async function operationalSummary(companyId, db = pool) {
  const [orders] = await db.execute('SELECT status, COUNT(*) quantidade, COALESCE(SUM(valor), 0) valor FROM os WHERE empresa = ? GROUP BY status', [companyId]);
  const [stock] = await db.execute("SELECT COUNT(*) produtos, SUM(CASE WHEN tem_estoque = 'Sim' AND estoque <= nivel_estoque THEN 1 ELSE 0 END) estoque_baixo FROM produtos WHERE empresa = ? AND ativo = 'Sim'", [companyId]);
  return { orders, stock: stock[0] };
}

async function salesReport(companyId, { from, to }, db = pool) {
  const [rows] = await db.execute(
    `SELECT r.id, r.data_lanc AS data, r.total_venda AS total, r.valor_custo AS custo,
            (COALESCE(r.total_venda, r.subtotal, 0) - COALESCE(r.valor_custo, 0)) AS lucro,
            r.pago, r.node_status, c.nome AS cliente_nome, u.nome AS vendedor_nome
       FROM receber r
       LEFT JOIN clientes c ON c.id = r.cliente AND c.empresa = r.empresa
       LEFT JOIN usuarios u ON u.id = r.usuario_lanc AND u.empresa = r.empresa
      WHERE r.empresa = ? AND r.referencia = 'Venda' AND r.data_lanc BETWEEN ? AND ?
      ORDER BY r.data_lanc DESC, r.id DESC`,
    [companyId, from, to]
  );
  return rows;
}

async function cashFlowReport(companyId, { from, to }, db = pool) {
  const [rows] = await db.execute(
    `SELECT data_pgto AS data, 'Receita' AS tipo, descricao, subtotal AS valor, pago, node_status
       FROM receber WHERE empresa = ? AND pago = 'Sim' AND data_pgto BETWEEN ? AND ?
      UNION ALL
     SELECT data_pgto AS data, 'Despesa' AS tipo, descricao, -subtotal AS valor, pago, node_status
       FROM pagar WHERE empresa = ? AND pago = 'Sim' AND data_pgto BETWEEN ? AND ?
      ORDER BY data DESC`,
    [companyId, from, to, companyId, from, to]
  );
  return rows;
}

async function inventoryReport(companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT p.id, p.codigo, p.nome, p.estoque, p.nivel_estoque, p.valor_compra, p.valor_venda,
            p.tem_estoque, p.ativo, c.nome AS categoria_nome, f.nome AS fornecedor_nome,
            ROUND(COALESCE(p.estoque, 0) * COALESCE(p.valor_compra, 0), 2) AS valor_estoque,
            CASE WHEN p.tem_estoque = 'Sim' AND p.estoque <= p.nivel_estoque THEN 'Sim' ELSE 'Não' END AS estoque_baixo
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria AND c.empresa = p.empresa
       LEFT JOIN fornecedores f ON f.id = p.fornecedor AND f.empresa = p.empresa
      WHERE p.empresa = ? ORDER BY estoque_baixo DESC, p.nome`,
    [companyId]
  );
  return rows;
}

async function delinquencyReport(companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT r.id, r.descricao, r.vencimento, r.subtotal AS valor, r.pago, r.node_status,
            DATEDIFF(CURRENT_DATE, r.vencimento) AS dias_atraso, c.nome AS cliente_nome,
            c.telefone, c.email
       FROM receber r
       LEFT JOIN clientes c ON c.id = r.cliente AND c.empresa = r.empresa
      WHERE r.empresa = ? AND r.node_status = 'ativo' AND (r.pago IS NULL OR r.pago <> 'Sim')
        AND r.vencimento < CURRENT_DATE
      ORDER BY r.vencimento, r.id`,
    [companyId]
  );
  return rows;
}

async function cashReport(companyId, { from, to }, db = pool) {
  const [rows] = await db.execute(
    `SELECT c.id, c.data_abertura, c.data_fechamento, c.valor_abertura, c.valor_fechamento, c.quebra,
            c.sangrias, c.obs, u.nome AS operador_nome
       FROM caixas c LEFT JOIN usuarios u ON u.id = c.operador AND u.empresa = c.empresa
      WHERE c.empresa = ? AND c.data_abertura BETWEEN ? AND ?
      ORDER BY c.data_abertura DESC, c.id DESC`,
    [companyId, from, to]
  );
  return rows;
}

async function topProductsReport(companyId, { from, to }, db = pool) {
  const [rows] = await db.execute(
    `SELECT p.id, p.codigo, p.nome, SUM(i.quantidade) AS quantidade_vendida, SUM(i.total) AS valor_total
       FROM itens_venda i
       JOIN produtos p ON p.id = i.produto AND p.empresa = i.empresa
       JOIN receber r ON r.id = i.id_venda AND r.empresa = i.empresa
      WHERE i.empresa = ? AND i.tipo = 'produto' AND r.referencia = 'Venda' AND r.data_lanc BETWEEN ? AND ?
      GROUP BY p.id, p.codigo, p.nome
      ORDER BY quantidade_vendida DESC
      LIMIT 50`,
    [companyId, from, to]
  );
  return rows;
}

async function annualBalanceReport(companyId, year, db = pool) {
  const [income] = await db.execute(
    `SELECT MONTH(data_pgto) AS mes, COALESCE(SUM(subtotal), 0) AS total
       FROM receber WHERE empresa = ? AND pago = 'Sim' AND YEAR(data_pgto) = ?
      GROUP BY MONTH(data_pgto)`,
    [companyId, year]
  );
  const [expense] = await db.execute(
    `SELECT MONTH(data_pgto) AS mes, COALESCE(SUM(subtotal), 0) AS total
       FROM pagar WHERE empresa = ? AND pago = 'Sim' AND YEAR(data_pgto) = ?
      GROUP BY MONTH(data_pgto)`,
    [companyId, year]
  );
  const incomeByMonth = new Map(income.map((row) => [row.mes, Number(row.total)]));
  const expenseByMonth = new Map(expense.map((row) => [row.mes, Number(row.total)]));
  return Array.from({ length: 12 }, (_, index) => {
    const mes = index + 1;
    const receitas = incomeByMonth.get(mes) || 0;
    const despesas = expenseByMonth.get(mes) || 0;
    return { mes, receitas, despesas, saldo: receitas - despesas };
  });
}

async function syntheticPayablesReport(companyId, { from, to }, db = pool) {
  const [rows] = await db.execute(
    `SELECT COALESCE(referencia, 'Outros') AS categoria, COUNT(*) AS quantidade,
            COALESCE(SUM(CASE WHEN pago = 'Sim' THEN subtotal ELSE 0 END), 0) AS pago,
            COALESCE(SUM(CASE WHEN pago IS NULL OR pago <> 'Sim' THEN subtotal ELSE 0 END), 0) AS pendente
       FROM pagar
      WHERE empresa = ? AND data_lanc BETWEEN ? AND ?
      GROUP BY categoria
      ORDER BY pendente DESC, pago DESC`,
    [companyId, from, to]
  );
  return rows;
}

async function syntheticReceivablesReport(companyId, { from, to }, db = pool) {
  const [rows] = await db.execute(
    `SELECT COALESCE(referencia, 'Outros') AS categoria, COUNT(*) AS quantidade,
            COALESCE(SUM(CASE WHEN pago = 'Sim' THEN subtotal ELSE 0 END), 0) AS recebido,
            COALESCE(SUM(CASE WHEN pago IS NULL OR pago <> 'Sim' THEN subtotal ELSE 0 END), 0) AS pendente
       FROM receber
      WHERE empresa = ? AND data_lanc BETWEEN ? AND ?
      GROUP BY categoria
      ORDER BY pendente DESC, recebido DESC`,
    [companyId, from, to]
  );
  return rows;
}

module.exports = {
  financialSummary, operationalSummary, salesReport, cashFlowReport, inventoryReport, delinquencyReport, cashReport,
  topProductsReport, annualBalanceReport, syntheticPayablesReport, syntheticReceivablesReport
};
