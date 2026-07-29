const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');

const id = z.coerce.number().int().positive();
const transitions = {
  'Aguardando pagamento': ['Pago', 'Cancelado'],
  Pago: ['Em preparação', 'Concluído', 'Cancelado'],
  'Em preparação': ['Concluído', 'Cancelado'],
  Concluído: [],
  Cancelado: []
};

router.use(authenticate, permit('vendas'), authorize('Administrador', 'Gerente', 'Comum'));

router.get('/orders', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT o.id, o.cliente, o.recebivel, o.subtotal, o.desconto, o.total, o.cupom, o.status,
              o.observacoes, o.criado_em, o.atualizado_em, c.nome AS cliente_nome,
              c.email AS cliente_email, c.telefone AS cliente_telefone, r.pago, r.data_pgto
         FROM node_store_orders o
         JOIN clientes c ON c.id = o.cliente AND c.empresa = o.empresa
         JOIN receber r ON r.id = o.recebivel AND r.empresa = o.empresa
        WHERE o.empresa = ? ORDER BY o.criado_em DESC, o.id DESC`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['cliente_nome', 'cliente_email', 'cliente_telefone', 'cupom', 'status'], statusField: 'status', dateField: 'criado_em', defaultSort: 'criado_em' }));
  } catch (error) { next(error); }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const orderId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT o.*, c.nome AS cliente_nome, c.email AS cliente_email, c.telefone AS cliente_telefone,
              r.pago, r.data_pgto, r.node_status
         FROM node_store_orders o
         JOIN clientes c ON c.id = o.cliente AND c.empresa = o.empresa
         JOIN receber r ON r.id = o.recebivel AND r.empresa = o.empresa
        WHERE o.id = ? AND o.empresa = ?`,
      [orderId, Number(req.auth.companyId)]
    );
    if (!rows[0]) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });
    const [items] = await pool.execute('SELECT id, tipo, item_id, nome, quantidade, valor_unitario, total FROM node_store_order_items WHERE pedido = ? ORDER BY id', [orderId]);
    res.json({ ...normalizeRecord(rows[0]), items: items.map(normalizeRecord) });
  } catch (error) { next(error); }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const orderId = id.parse(req.params.id);
    const { status } = z.object({ status: z.enum(Object.keys(transitions)) }).parse(req.body);
    const [orders] = await pool.execute('SELECT status, pago FROM node_store_orders o JOIN receber r ON r.id = o.recebivel AND r.empresa = o.empresa WHERE o.id = ? AND o.empresa = ?', [orderId, Number(req.auth.companyId)]);
    const current = orders[0];
    if (!current) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });
    if (!transitions[current.status]?.includes(status)) throw Object.assign(new Error(`Transição de ${current.status} para ${status} não permitida.`), { status: 409 });
    if (status === 'Pago' && current.pago !== 'Sim') throw Object.assign(new Error('Baixe o recebível no financeiro antes de marcar o pedido como pago.'), { status: 409 });
    if (status === 'Cancelado') throw Object.assign(new Error('Use a ação de cancelamento para restaurar estoque e financeiro.'), { status: 409 });
    await pool.execute('UPDATE node_store_orders SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND empresa = ?', [status, orderId, Number(req.auth.companyId)]);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'status', entity: 'pedido_loja', entityId: orderId, details: { from: current.status, to: status } });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete('/orders/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const orderId = id.parse(req.params.id);
    const { reason } = z.object({ reason: z.string().trim().min(3).max(255) }).parse(req.body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute(
        `SELECT o.status, o.recebivel, r.pago FROM node_store_orders o
         JOIN receber r ON r.id = o.recebivel AND r.empresa = o.empresa
         WHERE o.id = ? AND o.empresa = ? FOR UPDATE`,
        [orderId, Number(req.auth.companyId)]
      );
      const order = orders[0];
      if (!order || order.status === 'Cancelado') throw Object.assign(new Error('Pedido não encontrado ou já cancelado.'), { status: 409 });
      if (order.pago === 'Sim') throw Object.assign(new Error('Reabra o recebível pago antes de cancelar o pedido.'), { status: 409 });
      const [items] = await connection.execute(`SELECT tipo, item_id, quantidade FROM node_store_order_items WHERE pedido = ?`, [orderId]);
      for (const item of items) {
        if (item.tipo !== 'product') continue;
        await connection.execute(
          `UPDATE produtos SET estoque = CASE WHEN tem_estoque <> 'Não' THEN estoque + ? ELSE estoque END,
                  vendas = GREATEST(COALESCE(vendas, 0) - ?, 0)
            WHERE id = ? AND empresa = ?`,
          [item.quantidade, item.quantidade, item.item_id, Number(req.auth.companyId)]
        );
        await connection.execute('INSERT INTO entradas (produto, quantidade, motivo, usuario, data, empresa) VALUES (?, ?, ?, ?, CURRENT_DATE, ?)', [item.item_id, item.quantidade, `Cancelamento pedido loja #${orderId}`, Number(req.auth.sub), Number(req.auth.companyId)]);
      }
      await connection.execute(
        `UPDATE receber SET node_status = 'cancelado', cancelada = 'Sim', node_cancel_reason = ?,
                node_cancelled_at = CURRENT_TIMESTAMP, node_cancelled_by = ?
          WHERE id = ? AND empresa = ?`,
        [reason, Number(req.auth.sub), order.recebivel, Number(req.auth.companyId)]
      );
      await connection.execute(`UPDATE node_store_orders SET status = 'Cancelado', observacoes = CONCAT(COALESCE(observacoes, ''), ?), atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND empresa = ?`, [`\nCancelamento: ${reason}`, orderId, Number(req.auth.companyId)]);
      await audit(connection, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'cancelar', entity: 'pedido_loja', entityId: orderId, reason });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
