const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { feature } = require('../../middlewares/feature');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');

const id = z.coerce.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reason = z.string().trim().min(3).max(255);
const yesNo = z.enum(['Sim', 'Não']);

router.use(authenticate);

async function cashBalance(cashId, companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT c.id, c.valor_abertura,
            COALESCE((SELECT SUM(r.subtotal) FROM receber r WHERE r.caixa = c.id AND r.empresa = c.empresa AND r.pago = 'Sim' AND r.node_status = 'ativo'), 0) AS recebimentos,
            COALESCE((SELECT SUM(p.subtotal) FROM pagar p WHERE p.caixa = c.id AND p.empresa = c.empresa AND p.pago = 'Sim' AND p.node_status = 'ativo'), 0) AS pagamentos,
            COALESCE((SELECT SUM(s.valor) FROM sangrias s WHERE s.caixa = c.id), 0) AS retiradas
       FROM caixas c WHERE c.id = ? AND c.empresa = ? LIMIT 1`,
    [cashId, companyId]
  );
  if (!rows[0]) throw Object.assign(new Error('Caixa não encontrado.'), { status: 404 });
  const row = rows[0];
  return {
    ...row,
    saldo_esperado: Number(row.valor_abertura) + Number(row.recebimentos) - Number(row.pagamentos) - Number(row.retiradas)
  };
}

router.get('/cash', permit('caixas'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.operador, c.data_abertura, c.data_fechamento, c.valor_abertura, c.valor_fechamento,
              c.quebra, c.obs, c.sangrias, c.empresa, u.nome AS operador_nome,
              CASE WHEN c.data_fechamento IS NULL THEN 'Aberto' ELSE 'Fechado' END AS status
         FROM caixas c LEFT JOIN usuarios u ON u.id = c.operador AND u.empresa = c.empresa
        WHERE c.empresa = ? ORDER BY c.data_abertura DESC, c.id DESC`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['operador_nome', 'obs'], statusField: 'status', dateField: 'data_abertura', defaultSort: 'data_abertura' }));
  } catch (error) { next(error); }
});
router.get('/cash/:id', permit('caixas'), async (req, res, next) => {
  try {
    const cashId = id.parse(req.params.id);
    const [cashRows] = await pool.execute(
      `SELECT c.*, u.nome AS operador_nome, ua.nome AS usuario_abertura_nome, uf.nome AS usuario_fechamento_nome
         FROM caixas c
         LEFT JOIN usuarios u ON u.id = c.operador AND u.empresa = c.empresa
         LEFT JOIN usuarios ua ON ua.id = c.usuario_abertura AND ua.empresa = c.empresa
         LEFT JOIN usuarios uf ON uf.id = c.usuario_fechamento AND uf.empresa = c.empresa
        WHERE c.id = ? AND c.empresa = ?`,
      [cashId, Number(req.auth.companyId)]
    );
    if (!cashRows[0]) throw Object.assign(new Error('Caixa não encontrado.'), { status: 404 });
    const [withdrawals] = await pool.execute(
      `SELECT s.id, s.usuario, s.valor, s.data, s.hora, u.nome AS usuario_nome
         FROM sangrias s LEFT JOIN usuarios u ON u.id = s.usuario
        WHERE s.caixa = ? ORDER BY s.data, s.hora, s.id`,
      [cashId]
    );
    res.json({ ...normalizeRecord(cashRows[0]), balance: await cashBalance(cashId, Number(req.auth.companyId)), withdrawals: withdrawals.map(normalizeRecord) });
  } catch (error) { next(error); }
});
router.post('/cash', permit('caixas'), authorize('Administrador', 'Gerente', 'Tesoureiro'), async (req, res, next) => {
  try {
    const data = z.object({
      operatorId: z.number().int().positive(),
      openingValue: z.number().nonnegative(),
      notes: z.string().trim().max(255).optional()
    }).parse(req.body);
    const [operator] = await pool.execute('SELECT id FROM usuarios WHERE id = ? AND empresa = ? AND ativo = \'Sim\'', [data.operatorId, Number(req.auth.companyId)]);
    if (!operator[0]) throw Object.assign(new Error('Operador não encontrado.'), { status: 404 });
    const [open] = await pool.execute('SELECT id FROM caixas WHERE operador = ? AND empresa = ? AND data_fechamento IS NULL LIMIT 1', [data.operatorId, Number(req.auth.companyId)]);
    if (open[0]) throw Object.assign(new Error('Este operador já possui um caixa aberto.'), { status: 409 });
    const [result] = await pool.execute(
      `INSERT INTO caixas
        (operador, data_abertura, valor_abertura, usuario_abertura, obs, sangrias, empresa)
       VALUES (?, CURRENT_DATE, ?, ?, ?, 0, ?)`,
      [data.operatorId, data.openingValue, Number(req.auth.sub), data.notes ?? '', Number(req.auth.companyId)]
    );
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'abrir', entity: 'caixas', entityId: result.insertId, details: { openingValue: data.openingValue } });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.post('/cash/:id/withdrawals', permit('caixas'), authorize('Administrador', 'Gerente', 'Tesoureiro'), async (req, res, next) => {
  try {
    const cashId = id.parse(req.params.id);
    const data = z.object({ value: z.number().positive(), reason }).parse(req.body);
    const [cash] = await pool.execute('SELECT id FROM caixas WHERE id = ? AND empresa = ? AND data_fechamento IS NULL', [cashId, Number(req.auth.companyId)]);
    if (!cash[0]) throw Object.assign(new Error('O caixa não existe ou já foi fechado.'), { status: 409 });
    const balance = await cashBalance(cashId, Number(req.auth.companyId));
    if (data.value > balance.saldo_esperado) throw Object.assign(new Error('A retirada é maior que o saldo esperado do caixa.'), { status: 409 });
    const [result] = await pool.execute(
      'INSERT INTO sangrias (usuario, valor, data, hora, caixa) VALUES (?, ?, CURRENT_DATE, LOCALTIME, ?)',
      [Number(req.auth.sub), data.value, cashId]
    );
    await pool.execute('UPDATE caixas SET sangrias = COALESCE(sangrias, 0) + ? WHERE id = ? AND empresa = ?', [data.value, cashId, Number(req.auth.companyId)]);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'sangria', entity: 'caixas', entityId: cashId, reason: data.reason, details: { withdrawalId: result.insertId, value: data.value } });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.post('/cash/:id/close', permit('caixas'), authorize('Administrador', 'Gerente', 'Tesoureiro'), async (req, res, next) => {
  try {
    const cashId = id.parse(req.params.id);
    const data = z.object({ closingValue: z.number().nonnegative(), notes: z.string().trim().max(255).optional() }).parse(req.body);
    const balance = await cashBalance(cashId, Number(req.auth.companyId));
    const [result] = await pool.execute(
      `UPDATE caixas SET data_fechamento = CURRENT_DATE, valor_fechamento = ?, quebra = ?,
                         usuario_fechamento = ?, obs = CONCAT_WS(' | ', NULLIF(obs, ''), NULLIF(?::text, ''))
        WHERE id = ? AND empresa = ? AND data_fechamento IS NULL`,
      [data.closingValue, data.closingValue - balance.saldo_esperado, Number(req.auth.sub), data.notes ?? '', cashId, Number(req.auth.companyId)]
    );
    if (!result.affectedRows) throw Object.assign(new Error('O caixa já foi fechado.'), { status: 409 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'fechar', entity: 'caixas', entityId: cashId, details: { expected: balance.saldo_esperado, informed: data.closingValue } });
    res.json({ expected: balance.saldo_esperado, informed: data.closingValue, difference: data.closingValue - balance.saldo_esperado });
  } catch (error) { next(error); }
});

const purchaseSchema = z.object({
  supplierId: z.number().int().positive(),
  paymentMethodId: z.number().int().nonnegative().optional(),
  dueDate: date,
  paid: yesNo.optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    unitCost: z.number().positive()
  })).min(1).max(200)
});

router.get('/purchases', permit('compras'), feature('compras'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.fornecedor, p.data, p.vencimento, p.total, p.pago, p.status, p.observacoes,
              p.payable_id, p.criado_em, p.empresa, f.nome AS fornecedor_nome, u.nome AS usuario_nome,
              fp.nome AS forma_pgto_nome
         FROM node_purchases p
         JOIN fornecedores f ON f.id = p.fornecedor AND f.empresa = p.empresa
         JOIN usuarios u ON u.id = p.usuario AND u.empresa = p.empresa
         LEFT JOIN formas_pgto fp ON fp.id = p.forma_pgto AND fp.empresa = p.empresa
        WHERE p.empresa = ? ORDER BY p.data DESC, p.id DESC`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['fornecedor_nome', 'observacoes', 'forma_pgto_nome'], statusField: 'status', dateField: 'data', defaultSort: 'data' }));
  } catch (error) { next(error); }
});
router.get('/purchases/:id', permit('compras'), feature('compras'), async (req, res, next) => {
  try {
    const purchaseId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT p.*, f.nome AS fornecedor_nome, u.nome AS usuario_nome, fp.nome AS forma_pgto_nome
         FROM node_purchases p
         JOIN fornecedores f ON f.id = p.fornecedor AND f.empresa = p.empresa
         JOIN usuarios u ON u.id = p.usuario AND u.empresa = p.empresa
         LEFT JOIN formas_pgto fp ON fp.id = p.forma_pgto AND fp.empresa = p.empresa
        WHERE p.id = ? AND p.empresa = ?`,
      [purchaseId, Number(req.auth.companyId)]
    );
    if (!rows[0]) throw Object.assign(new Error('Compra não encontrada.'), { status: 404 });
    const [items] = await pool.execute(
      `SELECT i.id, i.produto, i.quantidade, i.valor_unitario, i.total, p.nome AS produto_nome, p.codigo
         FROM node_purchase_items i JOIN produtos p ON p.id = i.produto
        WHERE i.compra = ? ORDER BY i.id`,
      [purchaseId]
    );
    res.json({ ...normalizeRecord(rows[0]), items });
  } catch (error) { next(error); }
});
router.post('/purchases', permit('compras'), feature('compras'), authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const data = purchaseSchema.parse(req.body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [supplier] = await connection.execute('SELECT id FROM fornecedores WHERE id = ? AND empresa = ?', [data.supplierId, Number(req.auth.companyId)]);
      if (!supplier[0]) throw Object.assign(new Error('Fornecedor não encontrado.'), { status: 404 });
      const resolved = [];
      for (const item of data.items) {
        const [products] = await connection.execute('SELECT id, nome, tem_estoque FROM produtos WHERE id = ? AND empresa = ? AND ativo = \'Sim\' FOR UPDATE', [item.productId, Number(req.auth.companyId)]);
        if (!products[0]) throw Object.assign(new Error('Produto não encontrado ou inativo.'), { status: 404 });
        resolved.push({ ...item, total: item.quantity * item.unitCost, controlsStock: products[0].tem_estoque !== 'Não' });
      }
      const total = resolved.reduce((sum, item) => sum + item.total, 0);
      const paid = data.paid ?? 'Não';
      const [payable] = await connection.execute(
        `INSERT INTO pagar
          (descricao, fornecedor, funcionario, valor, vencimento, data_pgto, data_lanc, forma_pgto, frequencia,
           obs, referencia, subtotal, usuario_lanc, usuario_pgto, pago, empresa, node_status)
         VALUES (?, ?, 0, ?, ?, ?, CURRENT_DATE, ?, 0, ?, 'Compra', ?, ?, ?, ?, ?, 'ativo')`,
        [`Compra de mercadorias`, data.supplierId, total, data.dueDate, paid === 'Sim' ? data.dueDate : null, data.paymentMethodId ?? 0, data.notes ?? '', total, Number(req.auth.sub), paid === 'Sim' ? Number(req.auth.sub) : 0, paid, Number(req.auth.companyId)]
      );
      const [purchase] = await connection.execute(
        `INSERT INTO node_purchases
          (empresa, fornecedor, usuario, forma_pgto, data, vencimento, total, pago, status, observacoes, payable_id, criado_em)
         VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, 'ativo', ?, ?, CURRENT_TIMESTAMP)`,
        [Number(req.auth.companyId), data.supplierId, Number(req.auth.sub), data.paymentMethodId ?? 0, data.dueDate, total, paid, data.notes ?? '', payable.insertId]
      );
      for (const item of resolved) {
        await connection.execute(
          'INSERT INTO node_purchase_items (compra, produto, quantidade, valor_unitario, total) VALUES (?, ?, ?, ?, ?)',
          [purchase.insertId, item.productId, item.quantity, item.unitCost, item.total]
        );
        if (item.controlsStock) {
          await connection.execute('UPDATE produtos SET estoque = estoque + ?, valor_compra = ? WHERE id = ? AND empresa = ?', [item.quantity, item.unitCost, item.productId, Number(req.auth.companyId)]);
          await connection.execute('INSERT INTO entradas (produto, quantidade, motivo, usuario, data, empresa) VALUES (?, ?, ?, ?, CURRENT_DATE, ?)', [item.productId, item.quantity, `Compra #${purchase.insertId}`, Number(req.auth.sub), Number(req.auth.companyId)]);
        }
      }
      await audit(connection, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'compras', entityId: purchase.insertId, details: { items: resolved.length, total } });
      await connection.commit();
      res.status(201).json({ id: purchase.insertId, payableId: payable.insertId, total });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (error) { next(error); }
});
router.delete('/purchases/:id', permit('compras'), feature('compras'), authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const purchaseId = id.parse(req.params.id);
    const { reason: cancellationReason } = z.object({ reason }).parse(req.body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [purchases] = await connection.execute('SELECT * FROM node_purchases WHERE id = ? AND empresa = ? AND status = \'ativo\' FOR UPDATE', [purchaseId, Number(req.auth.companyId)]);
      if (!purchases[0]) throw Object.assign(new Error('Compra não encontrada ou já cancelada.'), { status: 409 });
      const purchase = purchases[0];
      const [payable] = await connection.execute('SELECT pago, node_status FROM pagar WHERE id = ? AND empresa = ? FOR UPDATE', [purchase.payable_id, Number(req.auth.companyId)]);
      if (payable[0]?.pago === 'Sim') throw Object.assign(new Error('Reabra a conta paga antes de cancelar a compra.'), { status: 409 });
      const [items] = await connection.execute('SELECT * FROM node_purchase_items WHERE compra = ?', [purchaseId]);
      for (const item of items) {
        const [products] = await connection.execute('SELECT estoque, tem_estoque FROM produtos WHERE id = ? AND empresa = ? FOR UPDATE', [item.produto, Number(req.auth.companyId)]);
        if (products[0]?.tem_estoque !== 'Não' && Number(products[0]?.estoque) < Number(item.quantidade)) throw Object.assign(new Error('Não há estoque suficiente para estornar todos os itens desta compra.'), { status: 409 });
      }
      for (const item of items) {
        const [products] = await connection.execute('SELECT tem_estoque FROM produtos WHERE id = ? AND empresa = ?', [item.produto, Number(req.auth.companyId)]);
        if (products[0]?.tem_estoque !== 'Não') {
          await connection.execute('UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND empresa = ?', [item.quantidade, item.produto, Number(req.auth.companyId)]);
          await connection.execute('INSERT INTO saidas (produto, quantidade, motivo, usuario, data, empresa) VALUES (?, ?, ?, ?, CURRENT_DATE, ?)', [item.produto, item.quantidade, `Estorno compra #${purchaseId}`, Number(req.auth.sub), Number(req.auth.companyId)]);
        }
      }
      await connection.execute(`UPDATE pagar SET node_status = 'cancelado', node_cancel_reason = ?, node_cancelled_at = CURRENT_TIMESTAMP, node_cancelled_by = ? WHERE id = ? AND empresa = ?`, [cancellationReason, Number(req.auth.sub), purchase.payable_id, Number(req.auth.companyId)]);
      await connection.execute(`UPDATE node_purchases SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP, cancelado_por = ?, motivo_cancelamento = ? WHERE id = ? AND empresa = ?`, [Number(req.auth.sub), cancellationReason, purchaseId, Number(req.auth.companyId)]);
      await audit(connection, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'cancelar', entity: 'compras', entityId: purchaseId, reason: cancellationReason });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
    res.status(204).end();
  } catch (error) { next(error); }
});

const recurringSchema = z.object({
  clientId: z.number().int().positive(),
  value: z.number().positive(),
  dueDate: date,
  frequencyId: z.number().int().positive(),
  installments: z.number().int().min(0).max(600).optional(),
  description: z.string().trim().min(2).max(50),
  notes: z.string().trim().max(255).optional(),
  interest: z.number().nonnegative().optional(),
  fine: z.number().nonnegative().optional()
});

router.get('/recurring', permit('cobrancas'), feature('cobrancas_recorrentes'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.cliente, c.valor, c.juros, c.multa, c.data, c.data_venc, c.frequencia,
              c.descricao, c.parcelas, c.obs, c.node_status, c.empresa, cl.nome AS cliente_nome,
              f.frequencia AS frequencia_nome, f.dias AS frequencia_dias
         FROM cobrancas c
         JOIN clientes cl ON cl.id = c.cliente AND cl.empresa = c.empresa
         LEFT JOIN frequencias f ON f.id = c.frequencia AND f.empresa = c.empresa
        WHERE c.empresa = ? ORDER BY c.data_venc, c.id`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['descricao', 'cliente_nome', 'frequencia_nome'], statusField: 'node_status', dateField: 'data_venc', defaultSort: 'data_venc' }));
  } catch (error) { next(error); }
});
router.post('/recurring', permit('cobrancas'), feature('cobrancas_recorrentes'), authorize('Administrador', 'Gerente', 'Financeiro'), async (req, res, next) => {
  try {
    const data = recurringSchema.parse(req.body);
    const [client] = await pool.execute('SELECT id FROM clientes WHERE id = ? AND empresa = ? AND ativo = \'Sim\'', [data.clientId, Number(req.auth.companyId)]);
    if (!client[0]) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
    const [frequency] = await pool.execute('SELECT id FROM frequencias WHERE id = ? AND empresa = ? AND dias > 0', [data.frequencyId, Number(req.auth.companyId)]);
    if (!frequency[0]) throw Object.assign(new Error('Frequência não encontrada.'), { status: 404 });
    const [result] = await pool.execute(
      `INSERT INTO cobrancas
        (cliente, valor, juros, multa, data, usuario, obs, data_venc, frequencia, valor_parcela,
         descricao, parcelas, empresa, node_status)
       VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')`,
      [data.clientId, data.value, data.interest ?? 0, data.fine ?? 0, Number(req.auth.sub), data.notes ?? '', data.dueDate, String(data.frequencyId), data.value, data.description, data.installments ?? 0, Number(req.auth.companyId)]
    );
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'cobrancas', entityId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.patch('/recurring/:id', permit('cobrancas'), feature('cobrancas_recorrentes'), authorize('Administrador', 'Gerente', 'Financeiro'), async (req, res, next) => {
  try {
    const recurringId = id.parse(req.params.id);
    const data = recurringSchema.partial().parse(req.body);
    const map = { clientId: 'cliente', value: 'valor', dueDate: 'data_venc', frequencyId: 'frequencia', installments: 'parcelas', description: 'descricao', notes: 'obs', interest: 'juros', fine: 'multa' };
    const fields = Object.keys(map).filter((field) => data[field] !== undefined);
    if (!fields.length) return res.status(204).end();
    const [result] = await pool.execute(
      `UPDATE cobrancas SET ${fields.map((field) => `${map[field]} = ?`).join(', ')} WHERE id = ? AND empresa = ? AND node_status = 'ativo'`,
      [...fields.map((field) => data[field]), recurringId, Number(req.auth.companyId)]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Cobrança recorrente não encontrada ou inativa.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: 'cobrancas', entityId: recurringId, details: fields });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/recurring/:id', permit('cobrancas'), feature('cobrancas_recorrentes'), authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const recurringId = id.parse(req.params.id);
    const data = z.object({ reason }).parse(req.body);
    const [result] = await pool.execute(`UPDATE cobrancas SET node_status = 'cancelado' WHERE id = ? AND empresa = ? AND node_status = 'ativo'`, [recurringId, Number(req.auth.companyId)]);
    if (!result.affectedRows) throw Object.assign(new Error('Cobrança recorrente não encontrada ou já cancelada.'), { status: 409 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'cancelar', entity: 'cobrancas', entityId: recurringId, reason: data.reason });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/recurring/:id/generate', permit('cobrancas'), feature('cobrancas_recorrentes'), authorize('Administrador', 'Gerente', 'Financeiro'), async (req, res, next) => {
  try {
    const recurringId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT c.*, f.dias FROM cobrancas c
       JOIN frequencias f ON f.id = c.frequencia AND f.empresa = c.empresa
       WHERE c.id = ? AND c.empresa = ? AND c.node_status = 'ativo'`,
      [recurringId, Number(req.auth.companyId)]
    );
    if (!rows[0]) throw Object.assign(new Error('Cobrança recorrente não encontrada.'), { status: 404 });
    const recurring = rows[0];
    const [last] = await pool.execute('SELECT vencimento FROM node_recurring_generated WHERE cobranca = ? AND empresa = ? ORDER BY vencimento DESC LIMIT 1', [recurringId, Number(req.auth.companyId)]);
    const baseDate = new Date(`${String(last[0]?.vencimento || recurring.data_venc).slice(0, 10)}T12:00:00`);
    if (last[0]) baseDate.setDate(baseDate.getDate() + Number(recurring.dias));
    const dueDate = baseDate.toISOString().slice(0, 10);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [entry] = await connection.execute(
        `INSERT INTO receber
          (descricao, cliente, valor, vencimento, data_lanc, forma_pgto, obs, referencia, subtotal,
           usuario_lanc, usuario_pgto, pago, empresa, node_status)
         VALUES (?, ?, ?, ?, CURRENT_DATE, 0, ?, 'Cobrança recorrente', ?, ?, 0, 'Não', ?, 'ativo')`,
        [recurring.descricao, recurring.cliente, recurring.valor_parcela || recurring.valor, dueDate, recurring.obs || '', recurring.valor_parcela || recurring.valor, Number(req.auth.sub), Number(req.auth.companyId)]
      );
      await connection.execute('INSERT INTO node_recurring_generated (empresa, cobranca, recebivel, vencimento, criado_em) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)', [Number(req.auth.companyId), recurringId, entry.insertId, dueDate]);
      await audit(connection, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'gerar', entity: 'cobrancas', entityId: recurringId, details: { receivableId: entry.insertId, dueDate } });
      await connection.commit();
      res.status(201).json({ receivableId: entry.insertId, dueDate });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (error) { next(error); }
});

const contractSchema = z.object({
  clientId: z.number().int().positive(),
  templateId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(3).max(150),
  content: z.string().trim().max(100000).optional(),
  status: z.enum(['Rascunho', 'Ativo', 'Encerrado', 'Cancelado']).optional(),
  startDate: date.nullable().optional(),
  endDate: date.nullable().optional(),
  value: z.number().nonnegative().nullable().optional()
});

function renderContract(text, { client, company }) {
  const values = {
    '{{cliente.nome}}': client.nome || '',
    '{{cliente.cpf}}': client.cpf || '',
    '{{cliente.endereco}}': [client.endereco, client.numero, client.cidade, client.estado].filter(Boolean).join(', '),
    '{{empresa.nome}}': company.nome || '',
    '{{data}}': new Intl.DateTimeFormat('pt-BR').format(new Date())
  };
  return Object.entries(values).reduce((output, [key, value]) => output.split(key).join(value), text);
}

router.get('/contracts', permit('listar_contratos', 'rel_contratos'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.cliente, c.modelo_id, c.titulo, c.status, c.inicio, c.fim, c.valor,
              c.criado_em, c.atualizado_em, c.empresa, cl.nome AS cliente_nome, t.modelo AS modelo_nome
         FROM node_contracts c
         JOIN clientes cl ON cl.id = c.cliente AND cl.empresa = c.empresa
         LEFT JOIN contratos t ON t.id = c.modelo_id AND t.empresa = c.empresa
        WHERE c.empresa = ? ORDER BY c.criado_em DESC, c.id DESC`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['titulo', 'cliente_nome', 'modelo_nome'], statusField: 'status', defaultSort: 'criado_em' }));
  } catch (error) { next(error); }
});
router.get('/contracts/:id', permit('listar_contratos', 'rel_contratos'), async (req, res, next) => {
  try {
    const contractId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT c.*, cl.nome AS cliente_nome, t.modelo AS modelo_nome, u.nome AS criado_por_nome
         FROM node_contracts c
         JOIN clientes cl ON cl.id = c.cliente AND cl.empresa = c.empresa
         LEFT JOIN contratos t ON t.id = c.modelo_id AND t.empresa = c.empresa
         LEFT JOIN usuarios u ON u.id = c.criado_por AND u.empresa = c.empresa
        WHERE c.id = ? AND c.empresa = ?`,
      [contractId, Number(req.auth.companyId)]
    );
    if (!rows[0]) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
    res.json(normalizeRecord(rows[0]));
  } catch (error) { next(error); }
});
router.post('/contracts', permit('rel_contratos'), authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const data = contractSchema.parse(req.body);
    const [clients] = await pool.execute('SELECT nome, cpf, endereco, numero, cidade, estado FROM clientes WHERE id = ? AND empresa = ?', [data.clientId, Number(req.auth.companyId)]);
    if (!clients[0]) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
    const [companies] = await pool.execute('SELECT nome FROM empresas WHERE id = ?', [Number(req.auth.companyId)]);
    let content = data.content || '';
    if (data.templateId) {
      const [templates] = await pool.execute('SELECT texto FROM contratos WHERE id = ? AND empresa = ?', [data.templateId, Number(req.auth.companyId)]);
      if (!templates[0]) throw Object.assign(new Error('Modelo de contrato não encontrado.'), { status: 404 });
      content = data.content || templates[0].texto;
    }
    if (content.length < 10) throw Object.assign(new Error('Informe o conteúdo ou escolha um modelo de contrato.'), { status: 400 });
    content = renderContract(content, { client: clients[0], company: companies[0] || {} });
    const [result] = await pool.execute(
      `INSERT INTO node_contracts
        (empresa, cliente, modelo_id, titulo, conteudo, status, inicio, fim, valor, criado_por, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [Number(req.auth.companyId), data.clientId, data.templateId ?? null, data.title, content, data.status ?? 'Rascunho', data.startDate ?? null, data.endDate ?? null, data.value ?? null, Number(req.auth.sub)]
    );
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'contratos_gerados', entityId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.patch('/contracts/:id', permit('rel_contratos'), authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const contractId = id.parse(req.params.id);
    const data = contractSchema.partial().parse(req.body);
    const map = { clientId: 'cliente', templateId: 'modelo_id', title: 'titulo', content: 'conteudo', status: 'status', startDate: 'inicio', endDate: 'fim', value: 'valor' };
    const fields = Object.keys(map).filter((field) => data[field] !== undefined);
    if (!fields.length) return res.status(204).end();
    const [result] = await pool.execute(
      `UPDATE node_contracts SET ${fields.map((field) => `${map[field]} = ?`).join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND empresa = ?`,
      [...fields.map((field) => data[field]), contractId, Number(req.auth.companyId)]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: 'contratos_gerados', entityId: contractId, details: fields });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/commissions', permit('comissoes', 'minhas_comissoes'), async (req, res, next) => {
  try {
    const onlyOwn = req.auth.role !== 'Administrador' && req.auth.role !== 'Gerente';
    const params = [Number(req.auth.companyId)];
    const ownFilter = onlyOwn ? ' AND iv.funcionario = ?' : '';
    if (onlyOwn) params.push(Number(req.auth.sub));
    const [rows] = await pool.execute(
      `SELECT iv.id, iv.id_venda, iv.funcionario, iv.total, iv.tipo, r.data_lanc AS data,
              r.pago, r.node_status, iv.comissao_paga, u.nome AS funcionario_nome, COALESCE(u.comissao, 0) AS percentual,
              ROUND(iv.total * COALESCE(u.comissao, 0) / 100, 2) AS comissao
         FROM itens_venda iv
         JOIN receber r ON r.id = iv.id_venda AND r.empresa = iv.empresa
         JOIN usuarios u ON u.id = iv.funcionario AND u.empresa = iv.empresa
        WHERE iv.empresa = ?${ownFilter}
        ORDER BY r.data_lanc DESC, iv.id DESC`,
      params
    );
    res.json(listResponse(rows, req.query, { searchFields: ['funcionario_nome', 'tipo'], statusField: 'pago', dateField: 'data', defaultSort: 'data' }));
  } catch (error) { next(error); }
});
router.patch('/commissions/:id/pay', permit('comissoes'), authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const itemId = z.coerce.number().int().positive().parse(req.params.id);
    const paid = z.object({ pago: z.enum(['Sim', 'Não']).default('Sim') }).parse(req.body).pago;
    const [result] = await pool.execute(
      "UPDATE itens_venda SET comissao_paga = ?, comissao_paga_em = ?, comissao_paga_por = ? WHERE id = ? AND empresa = ?",
      [paid, paid === 'Sim' ? new Date() : null, paid === 'Sim' ? Number(req.auth.sub) : null, itemId, Number(req.auth.companyId)]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Item de comissão não encontrado.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'pagar_comissao', entity: 'comissao', entityId: itemId, details: { pago: paid } });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
