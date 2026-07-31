const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { configFor, listWork, getWork, createWork, updateWork, updateStatus } = require('./work.service');

const typeSchema = z.enum(['quotes', 'orders']);
const idSchema = z.coerce.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const workItemSchema = z.object({
  kind: z.enum(['product', 'service']),
  itemId: z.number().int().positive(),
  quantity: z.number().int().positive()
});
const workSchema = z.object({
  cliente: z.number().int().positive(),
  data: dateSchema.optional(),
  data_entrega: dateSchema,
  dias_validade: z.number().int().nonnegative().optional(),
  valor: z.number().nonnegative().optional(),
  desconto: z.number().nonnegative().optional(),
  tipo_desconto: z.string().max(20).optional(),
  subtotal: z.number().nonnegative().optional(),
  obs: z.string().max(255).optional(),
  status: z.string().trim().min(2).max(30),
  total_produtos: z.number().nonnegative().optional(),
  total_servicos: z.number().nonnegative().optional(),
  frete: z.number().nonnegative().optional(),
  tecnico: z.number().int().nonnegative().optional(),
  equipamento: z.string().max(255).optional(),
  marca: z.string().max(255).optional(),
  modelo: z.string().max(255).optional(),
  defeito: z.string().max(1000).optional(),
  condicoes: z.string().max(2000).optional(),
  acessorios: z.string().max(1000).optional(),
  laudo: z.string().max(2000).optional(),
  senha_ap: z.string().max(50).optional(),
  mao_obra: z.number().nonnegative().optional(),
  vall: z.number().nonnegative().optional(),
  val_entrada: z.number().nonnegative().optional(),
  dias_garantia: z.string().max(50).optional(),
  forma_pgto: z.string().max(20).optional(),
  orcamento: z.number().int().nonnegative().optional(),
  pago: z.enum(['Sim', 'Não']).optional(),
  items: z.array(workItemSchema).max(100).optional()
});

router.use(authenticate, permit('orcamentos', 'os'));
router.get('/:type', async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    configFor(type);
    const restrictToUserId = req.auth.mostrarRegistros === false ? Number(req.auth.sub) : null;
    const rows = await listWork(type, Number(req.auth.companyId), req.query.status, restrictToUserId);
    res.json(listResponse(rows, req.query, { searchFields: ['cliente_nome', 'funcionario_nome', 'tecnico_nome', 'equipamento', 'marca', 'modelo', 'defeito'], statusField: 'status', dateField: 'data', defaultSort: 'id' }));
  } catch (error) { next(error); }
});
router.get('/:type/:id', async (req, res, next) => {
  try {
    const work = await getWork(typeSchema.parse(req.params.type), idSchema.parse(req.params.id), Number(req.auth.companyId));
    res.json({ ...normalizeRecord(work), items: work.items.map(normalizeRecord) });
  } catch (error) { next(error); }
});
router.post('/:type', authorize('Administrador', 'Gerente', 'Comum', 'Técnico'), async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const data = workSchema.parse({ ...req.body, data: req.body.data || new Date().toISOString().slice(0, 10) });
    const id = await createWork(type, data, Number(req.auth.companyId), Number(req.auth.sub));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: type, entityId: id });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});
router.patch('/:type/:id', authorize('Administrador', 'Gerente', 'Comum', 'Técnico'), async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    const data = workSchema.partial().parse(req.body);
    await updateWork(type, id, data, Number(req.auth.companyId), Number(req.auth.sub));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: type, entityId: id, details: Object.keys(data) });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.patch('/:type/:id/status', authorize('Administrador', 'Gerente', 'Comum', 'Técnico'), async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    const status = z.string().trim().min(2).max(30).parse(req.body.status);
    await updateStatus(type, id, status, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'status', entity: type, entityId: id, details: { status } });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/:type/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const type = typeSchema.parse(req.params.type);
    const id = idSchema.parse(req.params.id);
    const status = type === 'orders' ? 'Cancelada' : 'Cancelado';
    await updateStatus(type, id, status, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'cancelar', entity: type, entityId: id, reason: req.body?.reason || null });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
