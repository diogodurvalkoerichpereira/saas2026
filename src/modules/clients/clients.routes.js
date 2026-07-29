const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { listClients, createClient, updateClient } = require('./clients.service');

const clientSchema = z.object({
  nome: z.string().trim().min(2).max(50), cpf: z.string().max(25).optional(), telefone: z.string().max(20).optional(),
  email: z.union([z.string().email().max(50), z.literal('')]).optional(), endereco: z.string().max(100).optional(), numero: z.string().max(10).optional(),
  bairro: z.string().max(50).optional(), cidade: z.string().max(50).optional(), estado: z.string().max(50).optional(), cep: z.string().max(20).optional(),
  tipo_pessoa: z.enum(['Física', 'Jurídica']).optional(), data_nasc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), complemento: z.string().max(100).optional(),
  marketing: z.enum(['Sim', 'Não']).optional(), ativo: z.enum(['Sim', 'Não']).optional()
});
const idSchema = z.coerce.number().int().positive();

router.use(authenticate);
router.get('/', async (req, res, next) => { try { res.json(await listClients(Number(req.auth.companyId))); } catch (error) { next(error); } });
router.post('/', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try { const id = await createClient(clientSchema.parse(req.body), Number(req.auth.companyId), Number(req.auth.sub)); res.status(201).json({ id }); } catch (error) { next(error); }
});
router.patch('/:id', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try { await updateClient(idSchema.parse(req.params.id), clientSchema.partial().parse(req.body), Number(req.auth.companyId)); res.status(204).end(); } catch (error) { next(error); }
});

module.exports = router;
