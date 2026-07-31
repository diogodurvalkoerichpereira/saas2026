const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { createRepository } = require('./catalog.repository');

const common = { nome: z.string().trim().min(2).max(50), ativo: z.enum(['Sim', 'Não']).optional() };
const resources = {
  suppliers: {
    schema: z.object({ ...common, telefone: z.string().max(50), email: z.union([z.string().email().max(50), z.literal('')]).optional(), endereco: z.string().max(100).optional(), pix: z.string().max(50).optional(), numero: z.string().max(10).optional(), bairro: z.string().max(50).optional(), cidade: z.string().max(50).optional(), estado: z.string().max(50).optional(), cep: z.string().max(20).optional(), cnpj: z.string().max(20).optional(), complemento: z.string().max(255).optional(), tipo_chave: z.string().max(100).optional() }),
    repository: createRepository({ table: 'fornecedores', fields: ['nome', 'telefone', 'email', 'endereco', 'pix', 'data', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'cnpj', 'complemento', 'tipo_chave', 'ativo'], defaults: { data: () => new Date().toISOString().slice(0, 10), ativo: 'Sim' } })
  },
  products: {
    schema: z.object({ ...common, codigo: z.string().max(50), valor_compra: z.number().nonnegative(), valor_venda: z.number().nonnegative(), valor_promocional: z.number().nonnegative().optional(), estoque: z.number().int(), nivel_estoque: z.number().int().nonnegative(), categoria: z.number().int().nonnegative(), sub_categoria: z.string().max(50).optional(), fornecedor: z.number().int().nonnegative(), descricao: z.string().max(255).optional(), tem_estoque: z.enum(['Sim', 'Não']).optional(), mostrar_site: z.enum(['Sim', 'Não']).optional(), tipo_fiscal: z.enum(['mercadoria', 'servico']).optional(), ncm: z.string().max(8).optional(), cest: z.string().max(7).optional(), cfop: z.string().max(4).optional(), origem: z.string().max(1).optional(), cst_csosn: z.string().max(4).optional(), unidade_fiscal: z.string().max(6).optional(), aliq_icms: z.number().nonnegative().optional(), aliq_pis: z.number().nonnegative().optional(), aliq_cofins: z.number().nonnegative().optional(), codigo_lc116: z.string().max(10).optional(), codigo_tributacao_municipio: z.string().max(20).optional(), aliquota_iss: z.number().nonnegative().optional() }),
    repository: createRepository({
      table: 'produtos',
      fields: ['codigo', 'nome', 'valor_compra', 'valor_venda', 'valor_promocional', 'estoque', 'foto', 'ativo', 'nivel_estoque', 'categoria', 'sub_categoria', 'fornecedor', 'descricao', 'tem_estoque', 'mostrar_site', 'tipo_fiscal', 'ncm', 'cest', 'cfop', 'origem', 'cst_csosn', 'unidade_fiscal', 'aliq_icms', 'aliq_pis', 'aliq_cofins', 'codigo_lc116', 'codigo_tributacao_municipio', 'aliquota_iss'],
      defaults: { foto: 'sem-foto.jpg', ativo: 'Sim', tem_estoque: 'Sim', mostrar_site: 'Não', valor_promocional: 0, sub_categoria: '', tipo_fiscal: 'mercadoria' },
      selectExtras: '(SELECT nome FROM fornecedores f WHERE f.id = produtos.fornecedor AND f.empresa = produtos.empresa LIMIT 1) AS fornecedor_nome, (SELECT nome FROM categorias c WHERE c.id = produtos.categoria AND c.empresa = produtos.empresa LIMIT 1) AS categoria_nome'
    })
  },
  services: {
    schema: z.object({ ...common, valor: z.number().nonnegative(), comissao: z.number().int().nonnegative().optional(), dias: z.number().int().nonnegative(), mostrar_site: z.enum(['Sim', 'Não']).optional(), descricao: z.string().max(5000).optional() }),
    repository: createRepository({ table: 'servicos', fields: ['nome', 'valor', 'comissao', 'dias', 'ativo', 'mostrar_site', 'descricao'], defaults: { ativo: 'Sim', comissao: 0, mostrar_site: 'Não' } })
  }
};
const idSchema = z.coerce.number().int().positive();

router.use(authenticate, permit('fornecedores', 'produtos', 'servicos'));
router.param('resource', (req, res, next, value) => {
  if (!resources[value]) return res.status(404).json({ error: 'Recurso não encontrado.' });
  req.resource = resources[value];
  next();
});
router.get('/:resource', async (req, res, next) => {
  try {
    const rows = await req.resource.repository.list(Number(req.auth.companyId));
    res.json(listResponse(rows, req.query, { searchFields: ['nome', 'codigo', 'email', 'telefone', 'cnpj', 'descricao'], defaultSort: 'nome' }));
  } catch (error) { next(error); }
});
router.get('/:resource/:id', async (req, res, next) => {
  try { res.json(normalizeRecord(await req.resource.repository.get(idSchema.parse(req.params.id), Number(req.auth.companyId)))); } catch (error) { next(error); }
});
router.post('/:resource', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const id = await req.resource.repository.create(req.resource.schema.parse(req.body), Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: req.params.resource, entityId: id });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});
router.patch('/:resource/:id', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const data = req.resource.schema.partial().parse(req.body);
    await req.resource.repository.update(id, data, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: req.params.resource, entityId: id, details: Object.keys(data) });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/:resource/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    await req.resource.repository.setActive(id, false, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'inativar', entity: req.params.resource, entityId: id, reason: req.body?.reason || null });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/:resource/:id/restore', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    await req.resource.repository.setActive(id, true, Number(req.auth.companyId));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'reativar', entity: req.params.resource, entityId: id });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
