const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { listEntries, settleEntry } = require('./finance.service');

const typeSchema = z.enum(['payables', 'receivables']);
const idSchema = z.coerce.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filtersSchema = z.object({ paid: z.enum(['Sim', 'Não']).optional(), from: dateSchema.optional(), to: dateSchema.optional() });

router.use(authenticate, authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'));
router.get('/:type', async (req, res, next) => { try { res.json(await listEntries(typeSchema.parse(req.params.type), Number(req.auth.companyId), filtersSchema.parse(req.query))); } catch (error) { next(error); } });
router.post('/:type/:id/settle', async (req, res, next) => {
  try {
    const paymentDate = dateSchema.parse(req.body.paymentDate);
    await settleEntry(typeSchema.parse(req.params.type), idSchema.parse(req.params.id), Number(req.auth.companyId), Number(req.auth.sub), paymentDate);
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
