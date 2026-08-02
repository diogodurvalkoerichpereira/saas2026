const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { pool } = require('../../config/database');
const { assertWithinPlanLimit } = require('../../services/plan-limits');
const { listClients, getClient, createClient, updateClient, setClientActive } = require('./clients.service');

const clientSchema = z.object({
  nome: z.string().trim().min(2).max(50), cpf: z.string().max(25).optional(), telefone: z.string().max(20).optional(),
  email: z.union([z.string().email().max(50), z.literal('')]).optional(), endereco: z.string().max(100).optional(), numero: z.string().max(10).optional(),
  bairro: z.string().max(50).optional(), cidade: z.string().max(50).optional(), estado: z.string().max(50).optional(), cep: z.string().max(20).optional(),
  tipo_pessoa: z.enum(['Física', 'Jurídica']).optional(), data_nasc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), complemento: z.string().max(100).optional(),
  marketing: z.enum(['Sim', 'Não']).optional(), ativo: z.enum(['Sim', 'Não']).optional(),
  password: z.string().min(8).max(72).optional()
});
const idSchema = z.coerce.number().int().positive();

router.use(authenticate, permit('clientes'));
router.get('/', async (req, res, next) => {
  try {
    const restrictToUserId = req.auth.mostrarRegistros === false ? Number(req.auth.sub) : null;
    const rows = await listClients(Number(req.auth.companyId), restrictToUserId);
    res.json(listResponse(rows, req.query, { searchFields: ['nome', 'cpf', 'telefone', 'email', 'cidade'], defaultSort: 'nome' }));
  } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try { res.json(normalizeRecord(await getClient(idSchema.parse(req.params.id), Number(req.auth.companyId)))); } catch (error) { next(error); }
});
router.post('/', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    await assertWithinPlanLimit({ companyId: Number(req.auth.companyId), kind: 'clientes' });
    const id = await createClient(clientSchema.parse(req.body), Number(req.auth.companyId), Number(req.auth.sub));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'cliente', entityId: id });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});
router.patch('/:id', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const data = clientSchema.partial().parse(req.body);
    await updateClient(id, data, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: 'cliente', entityId: id, details: Object.keys(data).filter((field) => field !== 'password') });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    await setClientActive(id, false, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'inativar', entity: 'cliente', entityId: id, reason: req.body?.reason || null });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/:id/restore', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    await assertWithinPlanLimit({ companyId: Number(req.auth.companyId), kind: 'clientes' });
    await setClientActive(id, true, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'reativar', entity: 'cliente', entityId: id });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
