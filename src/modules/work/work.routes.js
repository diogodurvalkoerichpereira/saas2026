const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { listWork, updateStatus } = require('./work.service');

const typeSchema = z.enum(['quotes', 'orders']);
const idSchema = z.coerce.number().int().positive();
router.use(authenticate);
router.get('/:type', async (req, res, next) => { try { res.json(await listWork(typeSchema.parse(req.params.type), Number(req.auth.companyId), req.query.status)); } catch (error) { next(error); } });
router.patch('/:type/:id/status', authorize('Administrador', 'Gerente', 'Comum', 'Técnico'), async (req, res, next) => {
  try { const status = z.string().trim().min(2).max(20).parse(req.body.status); await updateStatus(typeSchema.parse(req.params.type), idSchema.parse(req.params.id), status, Number(req.auth.companyId)); res.status(204).end(); } catch (error) { next(error); }
});
module.exports = router;
