const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { feature } = require('../../middlewares/feature');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const service = require('./reference.service');

const yesNo = z.enum(['Sim', 'Não']);
const name = z.string().trim().min(2).max(150);
const optionalText = (max = 255) => z.string().trim().max(max).optional();
const resources = {
  categories: {
    table: 'categorias', permission: 'categorias', fields: ['nome', 'foto', 'ativo', 'icone'],
    schema: z.object({ nome: name.max(50), foto: optionalText(100), ativo: yesNo.optional(), icone: optionalText(60) }),
    defaults: { foto: 'sem-foto.jpg', ativo: 'Sim', icone: '' }, activeField: 'ativo', orderBy: 'nome'
  },
  subcategories: {
    table: 'sub_categorias', permission: 'sub_categorias', fields: ['nome', 'ativo', 'foto'],
    schema: z.object({ nome: name.max(50), ativo: yesNo.optional(), foto: optionalText(100) }),
    defaults: { ativo: 'Sim', foto: 'sem-foto.jpg' }, activeField: 'ativo', orderBy: 'nome'
  },
  brands: {
    table: 'marcas', permission: 'marcas', fields: ['nome', 'ativo'],
    schema: z.object({ nome: name.max(50), ativo: yesNo.optional() }),
    defaults: { ativo: 'Sim' }, activeField: 'ativo', orderBy: 'nome'
  },
  equipment: {
    table: 'equipamentos', permission: 'equipamentos', fields: ['nome', 'ativo'],
    schema: z.object({ nome: name.max(50), ativo: yesNo.optional() }),
    defaults: { ativo: 'Sim' }, activeField: 'ativo', orderBy: 'nome'
  },
  models: {
    table: 'modelos', permission: 'modelos', fields: ['nome', 'ativo', 'marca', 'equipamento'],
    schema: z.object({ nome: name.max(50), ativo: yesNo.optional(), marca: optionalText(100), equipamento: optionalText(100) }),
    defaults: { ativo: 'Sim', marca: '', equipamento: '' }, activeField: 'ativo', orderBy: 'nome'
  },
  'payment-methods': {
    table: 'formas_pgto', permission: 'formas_pgto', fields: ['nome', 'taxa'],
    schema: z.object({ nome: name.max(50), taxa: z.number().int().min(0).max(100).optional() }),
    defaults: { taxa: 0 }, orderBy: 'nome'
  },
  positions: {
    table: 'cargos', permission: 'cargos', fields: ['nome'],
    schema: z.object({ nome: name.max(50) }), orderBy: 'nome'
  },
  frequencies: {
    table: 'frequencias', permission: 'frequencias', fields: ['frequencia', 'dias'],
    schema: z.object({ frequencia: name.max(25), dias: z.number().int().min(0).max(3650) }), orderBy: 'dias, frequencia'
  },
  'account-plans': {
    table: 'plano_contas', permission: 'plano_contas', fields: ['nome'],
    schema: z.object({ nome: name }), orderBy: 'nome'
  },
  coupons: {
    table: 'cupons', permission: 'cupom', feature: 'cupons', fields: ['codigo', 'valor', 'data', 'quantidade', 'valor_minimo', 'tipo'],
    schema: z.object({
      codigo: z.string().trim().min(2).max(50), valor: z.number().nonnegative(),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      quantidade: z.number().int().min(0).optional(), valor_minimo: z.number().nonnegative().optional(),
      tipo: z.enum(['Valor', 'Percentual'])
    }),
    defaults: { data: null, quantidade: 0, valor_minimo: 0, tipo: 'Valor' }, orderBy: 'id DESC'
  },
  'contract-templates': {
    table: 'contratos', permission: 'modelos_contratos', feature: 'contratos', fields: ['modelo', 'texto', 'mostrar_modelos'],
    schema: z.object({ modelo: name.max(50), texto: z.string().trim().min(10).max(50000), mostrar_modelos: yesNo.optional() }),
    defaults: { mostrar_modelos: 'Sim' }, orderBy: 'modelo'
  }
};

const idSchema = z.coerce.number().int().positive();

router.use(authenticate);
router.param('resource', (req, res, next, value) => {
  if (!resources[value]) return res.status(404).json({ error: 'Cadastro não encontrado.' });
  req.resourceConfig = resources[value];
  next();
});
router.use('/:resource', (req, res, next) => permit(req.resourceConfig.permission)(req, res, next));
// Cadastros premium (cupons, modelos de contrato) também respeitam o recurso do plano.
router.use('/:resource', (req, res, next) => {
  if (!req.resourceConfig.feature) return next();
  return feature(req.resourceConfig.feature)(req, res, next);
});

router.get('/:resource', async (req, res, next) => {
  try {
    const rows = await service.list(req.resourceConfig, Number(req.auth.companyId));
    res.json(listResponse(rows, req.query, {
      searchFields: ['nome', 'modelo', 'frequencia', 'codigo', 'marca', 'equipamento'],
      defaultSort: req.resourceConfig.orderBy?.split(/[ ,]/)[0] || 'id'
    }));
  } catch (error) { next(error); }
});
router.get('/:resource/:id', async (req, res, next) => {
  try { res.json(normalizeRecord(await service.get(req.resourceConfig, idSchema.parse(req.params.id), Number(req.auth.companyId)))); } catch (error) { next(error); }
});
router.post('/:resource', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const id = await service.create(req.resourceConfig, req.resourceConfig.schema.parse(req.body), Number(req.auth.companyId), Number(req.auth.sub));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: req.params.resource, entityId: id });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});
router.patch('/:resource/:id', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const data = req.resourceConfig.schema.partial().parse(req.body);
    await service.update(req.resourceConfig, id, data, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: req.params.resource, entityId: id, details: Object.keys(data) });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/:resource/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    await service.remove(req.resourceConfig, id, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: req.resourceConfig.activeField ? 'inativar' : 'excluir', entity: req.params.resource, entityId: id, reason: req.body?.reason || null });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/:resource/:id/restore', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    await service.restore(req.resourceConfig, id, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'reativar', entity: req.params.resource, entityId: id });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
