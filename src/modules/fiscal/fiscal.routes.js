'use strict';

const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { audit } = require('../../services/audit.service');
const { getFiscalConfig, upsertFiscalConfig, getDocument, listDocuments, emitNfseFromSale, emitNfeFromSale } = require('./fiscal.service');

const idSchema = z.coerce.number().int().positive();
const configSchema = z.object({
  ambiente: z.enum(['homologacao', 'producao']).default('homologacao'),
  emiteNfse: z.enum(['Sim', 'Nao']).default('Sim'),
  emiteNfe: z.enum(['Sim', 'Nao']).default('Nao'),
  certificadoRef: z.string().trim().max(255).optional(),
  certificadoSenhaRef: z.string().trim().max(100).optional(),
  certificadoValidade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  regimeEspecial: z.string().trim().max(30).optional(),
  incentivoFiscal: z.enum(['Sim', 'Nao']).default('Nao')
});

router.use(authenticate, permit('vendas'));

router.get('/config', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    res.json(await getFiscalConfig(Number(req.auth.companyId)));
  } catch (error) { next(error); }
});

router.put('/config', authorize('Administrador'), async (req, res, next) => {
  try {
    const data = configSchema.parse(req.body);
    const config = await upsertFiscalConfig(Number(req.auth.companyId), Number(req.auth.sub), data);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'configurar', entity: 'fiscal', entityId: config?.id || 0 });
    res.json(config);
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    res.json({ items: await listDocuments(Number(req.auth.companyId)) });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getDocument(idSchema.parse(req.params.id), Number(req.auth.companyId)));
  } catch (error) { next(error); }
});

router.post('/nfse/from-sale/:saleId', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const saleId = idSchema.parse(req.params.saleId);
    const doc = await emitNfseFromSale({ saleId, companyId: Number(req.auth.companyId), userId: Number(req.auth.sub) });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'emitir_nfse', entity: 'venda', entityId: saleId, details: { documentoId: doc.id, status: doc.status } });
    res.status(201).json(doc);
  } catch (error) { next(error); }
});

router.post('/nfe/from-sale/:saleId', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const saleId = idSchema.parse(req.params.saleId);
    const doc = await emitNfeFromSale({ saleId, companyId: Number(req.auth.companyId), userId: Number(req.auth.sub) });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'emitir_nfe', entity: 'venda', entityId: saleId, details: { documentoId: doc.id, status: doc.status } });
    res.status(201).json(doc);
  } catch (error) { next(error); }
});

module.exports = router;
