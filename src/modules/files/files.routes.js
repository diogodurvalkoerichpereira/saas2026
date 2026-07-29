const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { audit } = require('../../services/audit.service');

const uploadRoot = path.resolve(__dirname, '..', '..', '..', 'uploads');
const id = z.coerce.number().int().positive();
const entities = {
  clients: { table: 'clientes', permissions: ['clientes'] },
  suppliers: { table: 'fornecedores', permissions: ['fornecedores'] },
  purchases: { table: 'node_purchases', permissions: ['compras'] },
  contracts: { table: 'node_contracts', permissions: ['listar_contratos', 'rel_contratos'] },
  orders: { table: 'os', permissions: ['os'] },
  quotes: { table: 'orcamentos', permissions: ['orcamentos'] },
  tickets: { table: 'chamados', permissions: ['chamados'] },
  campaigns: { table: 'marketing', permissions: ['marketing'] }
};
const allowedMimeTypes = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
  'text/csv', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg', 'audio/ogg', 'audio/wav'
]);
const extensions = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'text/plain': '.txt', 'text/csv': '.csv', 'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav'
};

function config(req, res, next) {
  if (!entities[req.params.entity]) return res.status(404).json({ error: 'Tipo de anexo não suportado.' });
  req.entityConfig = entities[req.params.entity];
  next();
}

async function assertEntity(req, entityId, db = pool) {
  if (req.auth.role !== 'Administrador') {
    const [permissions] = await db.query(
      `SELECT 1 FROM usuarios_permissoes up
       JOIN acessos a ON a.id = up.permissao
       WHERE up.usuario = ? AND a.chave IN (?) LIMIT 1`,
      [Number(req.auth.sub), req.entityConfig.permissions]
    );
    if (!permissions[0]) throw Object.assign(new Error('Você não possui permissão para os anexos deste módulo.'), { status: 403 });
  }
  const [rows] = await db.execute(`SELECT id FROM ${req.entityConfig.table} WHERE id = ? AND empresa = ?`, [entityId, Number(req.auth.companyId)]);
  if (!rows[0]) throw Object.assign(new Error('Registro relacionado não encontrado.'), { status: 404 });
}

router.use(authenticate);
router.param('entity', config);

router.get('/:entity/:entityId', async (req, res, next) => {
  try {
    const entityId = id.parse(req.params.entityId);
    await assertEntity(req, entityId);
    const [rows] = await pool.execute(
      `SELECT id, entidade, entidade_id, nome_original, mime_type, tamanho, criado_por, criado_em
         FROM node_attachments
        WHERE empresa = ? AND entidade = ? AND entidade_id = ?
        ORDER BY criado_em DESC, id DESC`,
      [Number(req.auth.companyId), req.params.entity, entityId]
    );
    res.json({ items: rows });
  } catch (error) { next(error); }
});
router.post(
  '/:entity/:entityId',
  authorize('Administrador', 'Gerente', 'Comum', 'Técnico'),
  express.raw({ type: 'application/octet-stream', limit: '8mb' }),
  async (req, res, next) => {
    try {
      const entityId = id.parse(req.params.entityId);
      await assertEntity(req, entityId);
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw Object.assign(new Error('O arquivo está vazio.'), { status: 400 });
      const mimeType = String(req.headers['x-file-type'] || '').toLowerCase();
      if (!allowedMimeTypes.has(mimeType)) throw Object.assign(new Error('Tipo de arquivo não permitido.'), { status: 415 });
      let decodedName = String(req.headers['x-file-name'] || `arquivo${extensions[mimeType]}`);
      try { decodedName = decodeURIComponent(decodedName); } catch {}
      const originalName = path.basename(decodedName).slice(0, 180);
      const companyFolder = path.join(uploadRoot, String(Number(req.auth.companyId)));
      await fs.mkdir(companyFolder, { recursive: true });
      const storedName = `${randomUUID()}${extensions[mimeType]}`;
      const absolutePath = path.join(companyFolder, storedName);
      await fs.writeFile(absolutePath, req.body, { flag: 'wx' });
      try {
        const [result] = await pool.execute(
          `INSERT INTO node_attachments
            (empresa, entidade, entidade_id, nome_original, nome_armazenado, mime_type, tamanho, criado_por, criado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [Number(req.auth.companyId), req.params.entity, entityId, originalName, storedName, mimeType, req.body.length, Number(req.auth.sub)]
        );
        await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'anexar', entity: req.params.entity, entityId, details: { attachmentId: result.insertId, mimeType, size: req.body.length } });
        res.status(201).json({ id: result.insertId, name: originalName });
      } catch (error) {
        await fs.unlink(absolutePath).catch(() => {});
        throw error;
      }
    } catch (error) { next(error); }
  }
);
router.get('/:entity/:entityId/:attachmentId/download', async (req, res, next) => {
  try {
    const entityId = id.parse(req.params.entityId);
    const attachmentId = id.parse(req.params.attachmentId);
    await assertEntity(req, entityId);
    const [rows] = await pool.execute(
      `SELECT nome_original, nome_armazenado, mime_type
         FROM node_attachments
        WHERE id = ? AND empresa = ? AND entidade = ? AND entidade_id = ?`,
      [attachmentId, Number(req.auth.companyId), req.params.entity, entityId]
    );
    if (!rows[0]) throw Object.assign(new Error('Anexo não encontrado.'), { status: 404 });
    const absolutePath = path.join(uploadRoot, String(Number(req.auth.companyId)), rows[0].nome_armazenado);
    res.type(rows[0].mime_type);
    res.download(absolutePath, rows[0].nome_original);
  } catch (error) { next(error); }
});
router.delete('/:entity/:entityId/:attachmentId', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const entityId = id.parse(req.params.entityId);
    const attachmentId = id.parse(req.params.attachmentId);
    await assertEntity(req, entityId);
    const [rows] = await pool.execute(
      `SELECT nome_armazenado FROM node_attachments
        WHERE id = ? AND empresa = ? AND entidade = ? AND entidade_id = ?`,
      [attachmentId, Number(req.auth.companyId), req.params.entity, entityId]
    );
    if (!rows[0]) throw Object.assign(new Error('Anexo não encontrado.'), { status: 404 });
    await pool.execute('DELETE FROM node_attachments WHERE id = ? AND empresa = ?', [attachmentId, Number(req.auth.companyId)]);
    const absolutePath = path.join(uploadRoot, String(Number(req.auth.companyId)), rows[0].nome_armazenado);
    await fs.unlink(absolutePath).catch(() => {});
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'excluir_anexo', entity: req.params.entity, entityId, reason: req.body?.reason || null, details: { attachmentId } });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
