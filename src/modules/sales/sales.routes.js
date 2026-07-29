const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { createSale } = require('./sales.service');

const schema = z.object({ clientId: z.number().int().positive(), paymentMethodId: z.number().int().nonnegative(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), paid: z.boolean(), items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1).max(100) });
router.post('/', authenticate, authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try { const sale = await createSale({ ...schema.parse(req.body), userId: Number(req.auth.sub), companyId: Number(req.auth.companyId) }); res.status(201).json(sale); } catch (error) { next(error); }
});
module.exports = router;
