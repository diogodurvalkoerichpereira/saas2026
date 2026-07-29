const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { listUsers, getUser, createUser, updateUser, setUserActive, listPermissionOptions, listPermissions, replacePermissions } = require('./users.service');

const userIdSchema = z.coerce.number().int().positive();
const permissionsSchema = z.object({ permissionIds: z.array(z.number().int().positive()).max(200) });
const userSchema = z.object({
  nome: z.string().trim().min(2).max(50),
  email: z.string().email().max(50),
  password: z.string().min(8).max(72).optional(),
  nivel: z.enum(['Administrador', 'Gerente', 'Comum', 'Técnico', 'Tesoureiro', 'Financeiro']),
  ativo: z.enum(['Sim', 'Não']).optional(),
  telefone: z.string().max(20).optional(),
  endereco: z.string().max(150).optional(),
  acessar_painel: z.enum(['Sim', 'Não']).optional(),
  mostrar_registros: z.enum(['Sim', 'Não']).optional(),
  comissao: z.number().nonnegative().max(100).optional(),
  pix: z.string().max(100).optional(),
  tipo_chave: z.string().max(100).optional(),
  salario: z.number().nonnegative().optional(),
  valor_hora: z.number().nonnegative().optional(),
  hora_entrada: z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/).nullable().optional(),
  hora_saida: z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/).nullable().optional(),
  jornada_horas: z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/).nullable().optional()
});

router.use(authenticate, permit('usuarios'));
router.get('/permissions/options', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try { res.json(await listPermissionOptions(Number(req.auth.companyId || 0))); } catch (error) { next(error); }
});
router.get('/', async (req, res, next) => {
  try {
    const rows = await listUsers(Number(req.auth.companyId || 0));
    res.json(listResponse(rows, req.query, { searchFields: ['nome', 'email', 'nivel', 'telefone'], defaultSort: 'nome' }));
  } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try { res.json(normalizeRecord(await getUser(userIdSchema.parse(req.params.id), Number(req.auth.companyId || 0)))); } catch (error) { next(error); }
});
router.post('/', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const data = userSchema.extend({ password: z.string().min(8).max(72) }).parse(req.body);
    const id = await createUser(data, Number(req.auth.companyId || 0));
    await audit(pool, { companyId: Number(req.auth.companyId || 0), userId: Number(req.auth.sub), action: 'criar', entity: 'usuario', entityId: id });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});
router.patch('/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = userIdSchema.parse(req.params.id);
    const data = userSchema.partial().parse(req.body);
    await updateUser(id, data, Number(req.auth.companyId || 0));
    await audit(pool, { companyId: Number(req.auth.companyId || 0), userId: Number(req.auth.sub), action: 'editar', entity: 'usuario', entityId: id, details: Object.keys(data).filter((key) => key !== 'password') });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = userIdSchema.parse(req.params.id);
    await setUserActive(id, false, Number(req.auth.sub), Number(req.auth.companyId || 0));
    await audit(pool, { companyId: Number(req.auth.companyId || 0), userId: Number(req.auth.sub), action: 'inativar', entity: 'usuario', entityId: id, reason: req.body?.reason || null });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/:id/restore', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = userIdSchema.parse(req.params.id);
    await setUserActive(id, true, Number(req.auth.sub), Number(req.auth.companyId || 0));
    await audit(pool, { companyId: Number(req.auth.companyId || 0), userId: Number(req.auth.sub), action: 'reativar', entity: 'usuario', entityId: id });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.get('/:id/permissions', async (req, res, next) => {
  try { res.json(await listPermissions(userIdSchema.parse(req.params.id), Number(req.auth.companyId || 0))); } catch (error) { next(error); }
});
router.put('/:id/permissions', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = userIdSchema.parse(req.params.id);
    const { permissionIds } = permissionsSchema.parse(req.body);
    await replacePermissions(id, permissionIds, Number(req.auth.companyId || 0));
    await audit(pool, { companyId: Number(req.auth.companyId || 0), userId: Number(req.auth.sub), action: 'permissoes', entity: 'usuario', entityId: id, details: permissionIds });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
