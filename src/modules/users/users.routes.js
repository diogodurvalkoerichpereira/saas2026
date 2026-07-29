const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { listUsers, listPermissions, replacePermissions } = require('./users.service');

const userIdSchema = z.coerce.number().int().positive();
const permissionsSchema = z.object({ permissionIds: z.array(z.number().int().positive()).max(200) });

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    res.json(await listUsers(Number(req.auth.companyId || 0)));
  } catch (error) { next(error); }
});

router.get('/:id/permissions', async (req, res, next) => {
  try {
    const userId = userIdSchema.parse(req.params.id);
    res.json(await listPermissions(userId, Number(req.auth.companyId || 0)));
  } catch (error) { next(error); }
});

router.put('/:id/permissions', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const userId = userIdSchema.parse(req.params.id);
    const { permissionIds } = permissionsSchema.parse(req.body);
    await replacePermissions(userId, permissionIds, Number(req.auth.companyId || 0));
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
