const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { pool } = require('../../config/database');
const { listMovements, moveStock } = require('./inventory.service');

const movementSchema = z.object({ type: z.enum(['entrada', 'saida']), productId: z.number().int().positive(), quantity: z.number().int().positive(), reason: z.string().trim().min(2).max(100) });
router.use(authenticate, permit('estoque', 'entradas', 'saidas', 'produtos'));
router.get('/movements', async (req, res, next) => {
  try {
    const rows = await listMovements(Number(req.auth.companyId));
    res.json(listResponse(rows, req.query, { searchFields: ['produto_nome', 'usuario_nome', 'motivo', 'tipo'], statusField: 'tipo', dateField: 'data', defaultSort: 'data' }));
  } catch (error) { next(error); }
});
router.post('/movements', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const movement = movementSchema.parse(req.body);
    await moveStock({ ...movement, userId: Number(req.auth.sub), companyId: Number(req.auth.companyId) });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: movement.type, entity: 'estoque', entityId: movement.productId, reason: movement.reason, details: { quantity: movement.quantity } });
    res.status(204).end();
  } catch (error) { next(error); }
});
module.exports = router;
