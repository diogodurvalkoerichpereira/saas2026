const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { listMovements, moveStock } = require('./inventory.service');

const movementSchema = z.object({ type: z.enum(['entrada', 'saida']), productId: z.number().int().positive(), quantity: z.number().int().positive(), reason: z.string().trim().min(2).max(100) });
router.use(authenticate);
router.get('/movements', async (req, res, next) => { try { res.json(await listMovements(Number(req.auth.companyId))); } catch (error) { next(error); } });
router.post('/movements', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try { await moveStock({ ...movementSchema.parse(req.body), userId: Number(req.auth.sub), companyId: Number(req.auth.companyId) }); res.status(204).end(); } catch (error) { next(error); }
});
module.exports = router;
