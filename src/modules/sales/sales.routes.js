const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { listSales, getSale, createSale, cancelSale } = require('./sales.service');

const idSchema = z.coerce.number().int().positive();
const schema = z.object({ clientId: z.number().int().positive(), paymentMethodId: z.number().int().nonnegative(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), paid: z.boolean(), items: z.array(z.object({ type: z.enum(['produto', 'servico']).default('produto'), id: z.number().int().positive(), quantity: z.number().int().positive() })).min(1).max(100) });
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(255) });

router.use(authenticate, permit('vendas'));
router.get('/', async (req, res, next) => {
  try {
    const restrictToUserId = req.auth.mostrarRegistros === false ? Number(req.auth.sub) : null;
    const rows = await listSales(Number(req.auth.companyId), restrictToUserId);
    res.json(listResponse(rows, req.query, { searchFields: ['cliente_nome', 'forma_pgto_nome', 'pago'], statusField: 'node_status', dateField: 'data_lanc', defaultSort: 'id' }));
  } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const sale = await getSale(idSchema.parse(req.params.id), Number(req.auth.companyId));
    res.json({ ...normalizeRecord(sale), items: sale.items.map(normalizeRecord) });
  } catch (error) { next(error); }
});
router.post('/', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const sale = await createSale({ ...schema.parse(req.body), userId: Number(req.auth.sub), companyId: Number(req.auth.companyId) });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'venda', entityId: sale.id });
    res.status(201).json(sale);
  } catch (error) { next(error); }
});
router.delete('/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const { reason } = reasonSchema.parse(req.body);
    await cancelSale(id, Number(req.auth.companyId), Number(req.auth.sub), reason);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'cancelar', entity: 'venda', entityId: id, reason });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
