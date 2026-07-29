const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
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

router.use(authenticate, authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'));
router.get('/payment-methods', async (req, res, next) => {
  try {
    const rows = await listPaymentMethods(Number(req.auth.companyId));
    res.json(listResponse(rows, req.query, { searchFields: ['nome'], defaultSort: 'nome' }));
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
    const paymentDate = dateSchema.parse(req.body.paymentDate);
    await settleEntry(type, id, Number(req.auth.companyId), Number(req.auth.sub), paymentDate);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'baixar', entity: type, entityId: id });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/:type/:id/reopen', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    await reopenEntry(type, id, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'reabrir', entity: type, entityId: id, reason: reasonSchema.parse(req.body).reason });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/:type/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    const { reason } = reasonSchema.parse(req.body);
    await cancelEntry(type, id, Number(req.auth.companyId), Number(req.auth.sub), reason);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'cancelar', entity: type, entityId: id, reason });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
