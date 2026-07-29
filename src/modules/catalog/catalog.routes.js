const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { createRepository } = require('./catalog.repository');

const common = { nome: z.string().trim().min(2).max(50), ativo: z.enum(['Sim', 'Não']).optional() };
const resources = {
  suppliers: {
    schema: z.object({ ...common, telefone: z.string().max(50), email: z.union([z.string().email().max(50), z.literal('')]).optional(), endereco: z.string().max(100).optional(), pix: z.string().max(50).optional(), numero: z.string().max(10).optional(), bairro: z.string().max(50).optional(), cidade: z.string().max(50).optional(), estado: z.string().max(50).optional(), cep: z.string().max(20).optional(), cnpj: z.string().max(20).optional(), complemento: z.string().max(255).optional(), tipo_chave: z.string().max(100).optional() }),
    repository: createRepository({ table: 'fornecedores', fields: ['nome', 'telefone', 'email', 'endereco', 'pix', 'data', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'cnpj', 'complemento', 'tipo_chave'], defaults: { data: () => new Date().toISOString().slice(0, 10) } })
  },
  products: {
    schema: z.object({ ...common, codigo: z.string().max(50), valor_compra: z.number().nonnegative(), valor_venda: z.number().nonnegative(), estoque: z.number().int(), nivel_estoque: z.number().int().nonnegative(), categoria: z.number().int().nonnegative(), fornecedor: z.number().int().nonnegative(), descricao: z.string().max(255).optional(), tem_estoque: z.enum(['Sim', 'Não']).optional(), mostrar_site: z.enum(['Sim', 'Não']).optional() }),
    repository: createRepository({ table: 'produtos', fields: ['codigo', 'nome', 'valor_compra', 'valor_venda', 'estoque', 'foto', 'ativo', 'nivel_estoque', 'categoria', 'fornecedor', 'descricao', 'tem_estoque', 'mostrar_site'], defaults: { foto: 'sem-foto.jpg', ativo: 'Sim', tem_estoque: 'Sim', mostrar_site: 'Não' } })
  },
  services: {
    schema: z.object({ ...common, valor: z.number().nonnegative(), comissao: z.number().int().nonnegative().optional(), dias: z.number().int().nonnegative(), mostrar_site: z.enum(['Sim', 'Não']).optional(), descricao: z.string().max(5000).optional() }),
    repository: createRepository({ table: 'servicos', fields: ['nome', 'valor', 'comissao', 'dias', 'ativo', 'mostrar_site', 'descricao'], defaults: { ativo: 'Sim', comissao: 0, mostrar_site: 'Não' } })
  }
};
const idSchema = z.coerce.number().int().positive();

router.use(authenticate);
router.param('resource', (req, res, next, value) => { if (!resources[value]) return res.status(404).json({ error: 'Recurso não encontrado.' }); req.resource = resources[value]; next(); });
router.get('/:resource', async (req, res, next) => { try { res.json(await req.resource.repository.list(Number(req.auth.companyId))); } catch (error) { next(error); } });
router.post('/:resource', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => { try { const id = await req.resource.repository.create(req.resource.schema.parse(req.body), Number(req.auth.companyId)); res.status(201).json({ id }); } catch (error) { next(error); } });
router.patch('/:resource/:id', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => { try { await req.resource.repository.update(idSchema.parse(req.params.id), req.resource.schema.partial().parse(req.body), Number(req.auth.companyId)); res.status(204).end(); } catch (error) { next(error); } });

module.exports = router;
