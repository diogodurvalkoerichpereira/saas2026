const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { listPaymentMethods, listEntries, getEntry, createEntry, updateEntry, settleEntry, reopenEntry, cancelEntry } = require('./finance.service');

const typeSchema = z.enum(['payables', 'receivables']);
const idSchema = z.coerce.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filtersSchema = z.object({ paid: z.enum(['Sim', 'Não']).optional(), from: dateSchema.optional(), to: dateSchema.optional() });
const entrySchema = z.object({
  descricao: z.string().trim().min(2).max(100),
  valor: z.number().positive(),
  vencimento: dateSchema,
  fornecedor: z.number().int().nonnegative().optional(),
  cliente: z.number().int().nonnegative().optional(),
  forma_pgto: z.number().int().nonnegative().optional(),
  obs: z.string().max(100).optional(),
  pago: z.enum(['Sim', 'Não']).optional()
});
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(255) });
const settlementSchema = z.object({
  paymentDate: dateSchema,
  cashRegisterId: z.number().int().positive().nullable().optional(),
  multa: z.number().nonnegative().optional(),
  juros: z.number().nonnegative().optional()
});

router.use(authenticate, permit('financeiro', 'receber', 'pagar'), authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'));
router.get('/payment-methods', async (req, res, next) => {
  try {
    const rows = await listPaymentMethods(Number(req.auth.companyId));
    res.json(listResponse(rows, req.query, { searchFields: ['nome'], defaultSort: 'nome' }));
  } catch (error) { next(error); }
});
router.get('/alerts', async (req, res, next) => {
  try {
    const companyId = Number(req.auth.companyId);
    const listOverdue = (table, person) => pool.execute(
      `SELECT id, descricao, valor, vencimento, ${person} AS pessoa
         FROM ${table}
        WHERE empresa = ? AND node_status = 'ativo' AND (pago IS NULL OR pago <> 'Sim') AND vencimento < CURRENT_DATE
        ORDER BY vencimento ASC LIMIT 8`, [companyId]);
    const countOverdue = (table) => pool.execute(
      `SELECT COUNT(*) AS total FROM ${table}
        WHERE empresa = ? AND node_status = 'ativo' AND (pago IS NULL OR pago <> 'Sim') AND vencimento < CURRENT_DATE`, [companyId]);
    const [[receber], [pagar], [[rc]], [[pc]]] = await Promise.all([
      listOverdue('receber', 'cliente'), listOverdue('pagar', 'fornecedor'),
      countOverdue('receber'), countOverdue('pagar')
    ]);
    res.json({
      receivables: { count: Number(rc.total), items: receber.map(normalizeRecord) },
      payables: { count: Number(pc.total), items: pagar.map(normalizeRecord) }
    });
  } catch (error) { next(error); }
});
router.get('/:type', async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const rows = await listEntries(type, Number(req.auth.companyId), filtersSchema.parse(req.query));
    res.json(listResponse(rows, req.query, { searchFields: ['descricao', 'pessoa_nome', 'referencia'], statusField: 'node_status', dateField: 'vencimento', defaultSort: 'vencimento' }));
  } catch (error) { next(error); }
});
router.get('/:type/:id', async (req, res, next) => {
  try { res.json(normalizeRecord(await getEntry(typeSchema.parse(req.params.type), idSchema.parse(req.params.id), Number(req.auth.companyId)))); } catch (error) { next(error); }
});
router.post('/:type', async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = await createEntry(type, entrySchema.parse(req.body), Number(req.auth.companyId), Number(req.auth.sub));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: type, entityId: id });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});
router.patch('/:type/:id', async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    const data = entrySchema.partial().parse(req.body);
    await updateEntry(type, id, data, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: type, entityId: id, details: Object.keys(data) });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/:type/:id/settle', async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    const settlement = settlementSchema.parse(req.body);
    await settleEntry(type, id, Number(req.auth.companyId), Number(req.auth.sub), settlement.paymentDate, pool, settlement.cashRegisterId ?? null, { multa: settlement.multa, juros: settlement.juros });
    if (type === 'receivables') {
      await pool.execute(`UPDATE node_store_orders SET status = 'Pago', atualizado_em = CURRENT_TIMESTAMP WHERE recebivel = ? AND empresa = ? AND status = 'Aguardando pagamento'`, [id, Number(req.auth.companyId)]);
    }
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'baixar', entity: type, entityId: id });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/:type/:id/reopen', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    await reopenEntry(type, id, Number(req.auth.companyId));
    if (type === 'receivables') {
      await pool.execute(`UPDATE node_store_orders SET status = 'Aguardando pagamento', atualizado_em = CURRENT_TIMESTAMP WHERE recebivel = ? AND empresa = ? AND status = 'Pago'`, [id, Number(req.auth.companyId)]);
    }
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'reabrir', entity: type, entityId: id, reason: reasonSchema.parse(req.body).reason });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/:type/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    const { reason } = reasonSchema.parse(req.body);
    if (type === 'receivables') {
      const [storeOrders] = await pool.execute(`SELECT id FROM node_store_orders WHERE recebivel = ? AND empresa = ? AND status <> 'Cancelado'`, [id, Number(req.auth.companyId)]);
      if (storeOrders[0]) throw Object.assign(new Error('Cancele este lançamento pela tela de pedidos online para restaurar o estoque.'), { status: 409 });
    }
    await cancelEntry(type, id, Number(req.auth.companyId), Number(req.auth.sub), reason);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'cancelar', entity: type, entityId: id, reason });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
