const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { env } = require('../../config/env');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { processDueDispatches } = require('../../jobs/marketing.job');

const id = z.coerce.number().int().positive();
const yesNo = z.enum(['Sim', 'Não']);
const campaignSchema = z.object({
  titulo: z.string().trim().min(3).max(100),
  mensagem: z.string().trim().min(1).max(5000),
  mensagem2: z.string().trim().max(5000).optional(),
  data_envio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  forma_envio: z.enum(['Todos', 'Clientes', 'Grupo', 'Selecionados']).optional(),
  dispositivo: z.string().trim().max(35).optional()
});
const groupSchema = z.object({ nome: z.string().trim().min(2).max(100), ativo: yesNo.optional() });
const queueSchema = z.object({
  clientIds: z.array(z.number().int().positive()).max(5000).optional(),
  groupIds: z.array(z.number().int().positive()).max(500).optional(),
  scheduledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/),
  confirmConsent: z.literal(true)
});
const membersSchema = z.object({ clientIds: z.array(z.number().int().positive()).max(5000) });

function phone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

router.use(authenticate, permit('marketing', 'grupos_disparos', 'dispositivos'));

router.get('/status', (_req, res) => {
  res.json({
    configured: Boolean(env.integrations.whatsappUrl && env.integrations.whatsappToken),
    dispatchEnabled: env.marketing.dispatchEnabled,
    provider: env.integrations.whatsappUrl ? 'Configurado por ambiente' : 'Não configurado'
  });
});

router.get('/campaigns', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT m.id, m.data, m.data_envio, m.envios, m.titulo, m.mensagem, m.mensagem2,
              m.forma_envio, m.dispositivo, m.total_disparos, m.empresa,
              (SELECT COUNT(*) FROM node_marketing_dispatch d WHERE d.campanha = m.id AND d.empresa = m.empresa AND d.status = 'pendente') AS pendentes,
              (SELECT COUNT(*) FROM node_marketing_dispatch d WHERE d.campanha = m.id AND d.empresa = m.empresa AND d.status = 'falhou') AS falhas
         FROM marketing m WHERE m.empresa = ? ORDER BY m.data DESC, m.id DESC`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['titulo', 'mensagem', 'forma_envio'], dateField: 'data', defaultSort: 'data' }));
  } catch (error) { next(error); }
});
router.get('/campaigns/:id', async (req, res, next) => {
  try {
    const campaignId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT id, data, data_envio, envios, titulo, mensagem, mensagem2, arquivo, audio,
              forma_envio, documento, dispositivo, total_disparos, empresa
         FROM marketing WHERE id = ? AND empresa = ?`,
      [campaignId, Number(req.auth.companyId)]
    );
    if (!rows[0]) throw Object.assign(new Error('Campanha não encontrada.'), { status: 404 });
    res.json(normalizeRecord(rows[0]));
  } catch (error) { next(error); }
});
router.post('/campaigns', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const data = campaignSchema.parse(req.body);
    const [result] = await pool.execute(
      `INSERT INTO marketing
        (data, data_envio, envios, titulo, mensagem2, mensagem, arquivo, audio, forma_envio,
         documento, ultimo_registro, empresa, dispositivo, total_disparos)
       VALUES (CURRENT_DATE, ?, 0, ?, ?, ?, NULL, NULL, ?, NULL, 0, ?, ?, 0)`,
      [data.data_envio ?? null, data.titulo, data.mensagem2 ?? '', data.mensagem, data.forma_envio ?? 'Clientes', Number(req.auth.companyId), data.dispositivo ?? '']
    );
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'marketing', entityId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.patch('/campaigns/:id', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const campaignId = id.parse(req.params.id);
    const data = campaignSchema.partial().parse(req.body);
    const fields = ['titulo', 'mensagem', 'mensagem2', 'data_envio', 'forma_envio', 'dispositivo'].filter((field) => data[field] !== undefined);
    if (!fields.length) return res.status(204).end();
    const [result] = await pool.execute(
      `UPDATE marketing SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`,
      [...fields.map((field) => data[field]), campaignId, Number(req.auth.companyId)]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Campanha não encontrada.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: 'marketing', entityId: campaignId, details: fields });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/campaigns/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const campaignId = id.parse(req.params.id);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute('DELETE FROM marketing WHERE id = ? AND empresa = ?', [campaignId, Number(req.auth.companyId)]);
      if (!result.affectedRows) throw Object.assign(new Error('Campanha não encontrada.'), { status: 404 });
      await connection.execute(`UPDATE node_marketing_dispatch SET status = 'cancelado', atualizado_em = CURRENT_TIMESTAMP WHERE campanha = ? AND empresa = ? AND status IN ('pendente', 'processando')`, [campaignId, Number(req.auth.companyId)]);
      await audit(connection, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'excluir', entity: 'marketing', entityId: campaignId, reason: req.body?.reason || null });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post('/campaigns/:id/queue', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const campaignId = id.parse(req.params.id);
    const data = queueSchema.parse(req.body);
    const [campaigns] = await pool.execute('SELECT id, mensagem FROM marketing WHERE id = ? AND empresa = ?', [campaignId, Number(req.auth.companyId)]);
    if (!campaigns[0]) throw Object.assign(new Error('Campanha não encontrada.'), { status: 404 });
    const requested = [...new Set(data.clientIds || [])];
    if (data.groupIds?.length) {
      const [members] = await pool.query(
        `SELECT DISTINCT gc.cliente FROM grupos_clientes gc
          JOIN grupos_disparos g ON g.id = gc.grupo AND g.empresa = gc.empresa
         WHERE gc.empresa = ? AND g.ativo = 'Sim' AND gc.grupo IN (?)`,
        [Number(req.auth.companyId), data.groupIds]
      );
      requested.push(...members.map((row) => Number(row.cliente)));
    }
    const uniqueIds = [...new Set(requested)];
    const contactFilter = uniqueIds.length ? ' AND id IN (?)' : '';
    const params = uniqueIds.length ? [Number(req.auth.companyId), uniqueIds] : [Number(req.auth.companyId)];
    const [clients] = await pool.query(
      `SELECT id, nome, telefone FROM clientes
        WHERE empresa = ? AND ativo = 'Sim' AND marketing = 'Sim'${contactFilter}
        ORDER BY id`,
      params
    );
    const contacts = clients.map((client) => ({ ...client, normalizedPhone: phone(client.telefone) })).filter((client) => client.normalizedPhone);
    if (!contacts.length) throw Object.assign(new Error('Nenhum cliente elegível: é necessário cadastro ativo, telefone válido e consentimento de marketing.'), { status: 409 });
    const scheduledAt = data.scheduledAt.replace('T', ' ').padEnd(19, ':00').slice(0, 19);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let inserted = 0;
      for (const contact of contacts) {
        const [result] = await connection.execute(
          `INSERT INTO node_marketing_dispatch
            (campanha, cliente, nome, telefone, mensagem, empresa, status, tentativas, agendado_para, consentimento_confirmado, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, 'pendente', 0, ?, 'Sim', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (campanha, cliente, agendado_para) DO NOTHING`,
          [campaignId, contact.id, contact.nome, contact.normalizedPhone, campaigns[0].mensagem, Number(req.auth.companyId), scheduledAt]
        );
        inserted += result.affectedRows;
      }
      await connection.execute('UPDATE marketing SET data_envio = ?::date, total_disparos = ? WHERE id = ? AND empresa = ?', [scheduledAt, inserted, campaignId, Number(req.auth.companyId)]);
      await audit(connection, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'agendar', entity: 'marketing', entityId: campaignId, details: { recipients: inserted, scheduledAt } });
      await connection.commit();
      res.status(201).json({ queued: inserted, eligible: contacts.length, dispatchEnabled: env.marketing.dispatchEnabled });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (error) { next(error); }
});
router.get('/campaigns/:id/dispatches', async (req, res, next) => {
  try {
    const campaignId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT id, campanha, cliente, nome, telefone, status, tentativas, agendado_para, enviado_em, erro, criado_em, atualizado_em
         FROM node_marketing_dispatch WHERE campanha = ? AND empresa = ? ORDER BY criado_em DESC, id DESC`,
      [campaignId, Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['nome', 'telefone', 'status', 'erro'], statusField: 'status', defaultSort: 'criado_em' }));
  } catch (error) { next(error); }
});
router.post('/run-due', authorize('Administrador'), async (req, res, next) => {
  try { res.json(await processDueDispatches({ companyId: Number(req.auth.companyId) })); } catch (error) { next(error); }
});

router.get('/groups', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT g.id, g.nome, g.ativo, g.empresa,
              (SELECT COUNT(*) FROM grupos_clientes gc WHERE gc.grupo = g.id AND gc.empresa = g.empresa) AS clientes
         FROM grupos_disparos g WHERE g.empresa = ? ORDER BY g.nome`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['nome'], defaultSort: 'nome' }));
  } catch (error) { next(error); }
});
router.post('/groups', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const data = groupSchema.parse(req.body);
    const [result] = await pool.execute('INSERT INTO grupos_disparos (empresa, ativo, nome) VALUES (?, ?, ?)', [Number(req.auth.companyId), data.ativo ?? 'Sim', data.nome]);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'grupos_disparos', entityId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.patch('/groups/:id', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const groupId = id.parse(req.params.id);
    const data = groupSchema.partial().parse(req.body);
    const fields = ['nome', 'ativo'].filter((field) => data[field] !== undefined);
    if (!fields.length) return res.status(204).end();
    const [result] = await pool.execute(`UPDATE grupos_disparos SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`, [...fields.map((field) => data[field]), groupId, Number(req.auth.companyId)]);
    if (!result.affectedRows) throw Object.assign(new Error('Grupo não encontrado.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: 'grupos_disparos', entityId: groupId, details: fields });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.get('/groups/:id/clients', async (req, res, next) => {
  try {
    const groupId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT c.id, c.nome, c.telefone, c.email, c.marketing, c.ativo
         FROM grupos_clientes gc JOIN clientes c ON c.id = gc.cliente AND c.empresa = gc.empresa
        WHERE gc.grupo = ? AND gc.empresa = ? ORDER BY c.nome`,
      [groupId, Number(req.auth.companyId)]
    );
    res.json({ items: rows.map(normalizeRecord) });
  } catch (error) { next(error); }
});
router.put('/groups/:id/clients', authorize('Administrador', 'Gerente', 'Comum'), async (req, res, next) => {
  try {
    const groupId = id.parse(req.params.id);
    const data = membersSchema.parse(req.body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [group] = await connection.execute('SELECT id FROM grupos_disparos WHERE id = ? AND empresa = ?', [groupId, Number(req.auth.companyId)]);
      if (!group[0]) throw Object.assign(new Error('Grupo não encontrado.'), { status: 404 });
      await connection.execute('DELETE FROM grupos_clientes WHERE grupo = ? AND empresa = ?', [groupId, Number(req.auth.companyId)]);
      for (const clientId of [...new Set(data.clientIds)]) {
        const [client] = await connection.execute('SELECT id FROM clientes WHERE id = ? AND empresa = ?', [clientId, Number(req.auth.companyId)]);
        if (client[0]) await connection.execute('INSERT INTO grupos_clientes (empresa, grupo, cliente) VALUES (?, ?, ?)', [Number(req.auth.companyId), groupId, clientId]);
      }
      await audit(connection, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'atualizar_clientes', entity: 'grupos_disparos', entityId: groupId, details: { count: data.clientIds.length } });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/devices', permit('dispositivos', 'marketing'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, telefone, status, status_api, horario, empresa
         FROM dispositivos WHERE empresa = ? ORDER BY id DESC`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['telefone', 'status', 'status_api'], statusField: 'status_api', defaultSort: 'id' }));
  } catch (error) { next(error); }
});

module.exports = router;
