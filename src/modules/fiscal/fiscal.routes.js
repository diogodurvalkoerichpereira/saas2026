'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { audit } = require('../../services/audit.service');
const { getFiscalConfig, publicFiscalConfig, upsertFiscalConfig, saveCertificate, getDocument, listDocuments, emitNfseFromSale, emitNfeFromSale } = require('./fiscal.service');

const idSchema = z.coerce.number().int().positive();
const configSchema = z.object({
  ambiente: z.enum(['homologacao', 'producao']).default('homologacao'),
  emiteNfse: z.enum(['Sim', 'Nao']).default('Sim'),
  emiteNfe: z.enum(['Sim', 'Nao']).default('Nao'),
  regimeEspecial: z.string().trim().max(30).optional(),
  incentivoFiscal: z.enum(['Sim', 'Nao']).default('Nao'),
  emitente: z.object({
    cnpj: z.string().trim().max(18).optional(),
    razaoSocial: z.string().trim().max(150).optional(),
    inscricaoEstadual: z.string().trim().max(20).optional(),
    inscricaoMunicipal: z.string().trim().max(20).optional(),
    codigoIbge: z.string().trim().regex(/^\d{7}$/).optional(),
    regimeTributario: z.string().trim().max(30).optional(),
    cnae: z.string().trim().max(10).optional()
  }).optional()
});

router.use(authenticate, permit('vendas'));

// GET /config junta a configuração fiscal (sem segredos) com os dados fiscais do emitente
// (tabela empresas), para preencher o formulário da aba Configuração.
router.get('/config', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const companyId = Number(req.auth.companyId);
    const config = publicFiscalConfig(await getFiscalConfig(companyId));
    const [[empresa]] = await pool.execute(
      'SELECT cnpj, razao_social, inscricao_estadual, inscricao_municipal, codigo_ibge, regime_tributario, cnae FROM empresas WHERE id = ? LIMIT 1',
      [companyId]
    );
    res.json({ config, emitente: empresa || {} });
  } catch (error) { next(error); }
});

router.put('/config', authorize('Administrador'), async (req, res, next) => {
  try {
    const data = configSchema.parse(req.body);
    await upsertFiscalConfig(Number(req.auth.companyId), Number(req.auth.sub), data);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'configurar', entity: 'fiscal', entityId: 0 });
    res.json(publicFiscalConfig(await getFiscalConfig(Number(req.auth.companyId))));
  } catch (error) { next(error); }
});

// Upload do certificado A1 (.pfx) em corpo binário. A senha vem no header e é cifrada no
// service; nunca é logada nem persistida em texto.
router.post('/certificate', authorize('Administrador'), express.raw({ type: 'application/octet-stream', limit: '4mb' }), async (req, res, next) => {
  try {
    let senha = String(req.headers['x-cert-password'] || '');
    try { senha = decodeURIComponent(senha); } catch {}
    let nome = String(req.headers['x-file-name'] || 'certificado.pfx');
    try { nome = decodeURIComponent(nome); } catch {}
    const result = await saveCertificate(Number(req.auth.companyId), req.body, senha, nome, Number(req.auth.sub));
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'cadastrar_certificado', entity: 'fiscal', entityId: 0, details: { validade: result.validade } });
    res.status(201).json(result);
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
