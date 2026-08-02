const { randomUUID } = require('node:crypto');
const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { feature } = require('../../middlewares/feature');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');

const id = z.coerce.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/);
const yesNo = z.enum(['Sim', 'Não']);
const noteSchema = z.object({
  titulo: z.string().trim().min(2).max(250),
  msg: z.string().trim().min(1).max(10000),
  mostrar_home: yesNo.optional(),
  privado: yesNo.optional()
});
const taskSchema = z.object({
  targetId: z.number().int().positive(),
  data: date,
  hora: time,
  hora_mensagem: time.nullable().optional(),
  titulo: z.string().trim().min(2).max(255),
  descricao: z.string().trim().max(2000).optional(),
  prioridade: z.enum(['Baixa', 'Média', 'Alta', 'Urgente']).optional(),
  status: z.enum(['Pendente', 'Em andamento', 'Concluída', 'Cancelada']).optional(),
  recorrencia: z.number().int().min(0).optional()
});
const ticketSchema = z.object({
  titulo: z.string().trim().min(3).max(255),
  texto: z.string().trim().min(3).max(10000),
  status: z.enum(['Aberto', 'Em andamento', 'Resolvido', 'Fechado']).optional()
});
const replySchema = z.object({ texto: z.string().trim().min(1).max(10000) });

router.use(authenticate);

router.get('/notes', permit('anotacoes', 'home'), feature('anotacoes'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.id, a.titulo, a.msg, a.usuario, a.data, a.mostrar_home, a.privado, a.empresa,
              u.nome AS usuario_nome
         FROM anotacoes a
         LEFT JOIN usuarios u ON u.id = a.usuario AND u.empresa = a.empresa
        WHERE a.empresa = ? AND (a.privado <> 'Sim' OR a.usuario = ?)
        ORDER BY a.data DESC, a.id DESC`,
      [Number(req.auth.companyId), Number(req.auth.sub)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['titulo', 'msg', 'usuario_nome'], dateField: 'data', defaultSort: 'data' }));
  } catch (error) { next(error); }
});
router.post('/notes', permit('anotacoes', 'home'), feature('anotacoes'), async (req, res, next) => {
  try {
    const data = noteSchema.parse(req.body);
    const [result] = await pool.execute(
      `INSERT INTO anotacoes (titulo, msg, usuario, data, mostrar_home, privado, empresa)
       VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?)`,
      [data.titulo, data.msg, Number(req.auth.sub), data.mostrar_home ?? 'Não', data.privado ?? 'Não', Number(req.auth.companyId)]
    );
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'anotacoes', entityId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.patch('/notes/:id', permit('anotacoes', 'home'), feature('anotacoes'), async (req, res, next) => {
  try {
    const noteId = id.parse(req.params.id);
    const data = noteSchema.partial().parse(req.body);
    const [current] = await pool.execute('SELECT usuario FROM anotacoes WHERE id = ? AND empresa = ?', [noteId, Number(req.auth.companyId)]);
    if (!current[0]) throw Object.assign(new Error('Anotação não encontrada.'), { status: 404 });
    if (Number(current[0].usuario) !== Number(req.auth.sub) && req.auth.role !== 'Administrador') throw Object.assign(new Error('Somente o autor pode editar esta anotação.'), { status: 403 });
    const fields = ['titulo', 'msg', 'mostrar_home', 'privado'].filter((field) => data[field] !== undefined);
    if (fields.length) await pool.execute(`UPDATE anotacoes SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`, [...fields.map((field) => data[field]), noteId, Number(req.auth.companyId)]);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: 'anotacoes', entityId: noteId });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/notes/:id', permit('anotacoes', 'home'), feature('anotacoes'), async (req, res, next) => {
  try {
    const noteId = id.parse(req.params.id);
    const [current] = await pool.execute('SELECT usuario FROM anotacoes WHERE id = ? AND empresa = ?', [noteId, Number(req.auth.companyId)]);
    if (!current[0]) throw Object.assign(new Error('Anotação não encontrada.'), { status: 404 });
    if (Number(current[0].usuario) !== Number(req.auth.sub) && req.auth.role !== 'Administrador') throw Object.assign(new Error('Somente o autor pode excluir esta anotação.'), { status: 403 });
    await pool.execute('DELETE FROM anotacoes WHERE id = ? AND empresa = ?', [noteId, Number(req.auth.companyId)]);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'excluir', entity: 'anotacoes', entityId: noteId, reason: req.body?.reason || null });
    res.status(204).end();
  } catch (error) { next(error); }
});

function taskConfig(audience) {
  if (audience === 'clients') return { table: 'tarefas_clientes', permission: 'tarefas_clientes', targetTable: 'clientes', targetLabel: 'cliente' };
  if (audience === 'users') return { table: 'tarefas', permission: 'tarefas', targetTable: 'usuarios', targetLabel: 'responsavel' };
  throw Object.assign(new Error('Público da tarefa inválido.'), { status: 400 });
}

function taskPermission(req, res, next) {
  try {
    req.taskConfig = taskConfig(req.query.audience || 'users');
    // Permissão do perfil e, em seguida, o recurso do plano (tarefas).
    permit(req.taskConfig.permission)(req, res, (error) => (error ? next(error) : feature('tarefas')(req, res, next)));
  } catch (error) {
    next(error);
  }
}

router.get('/tasks', taskPermission, async (req, res, next) => {
  try {
    const config = req.taskConfig;
    const [rows] = await pool.execute(
      `SELECT t.id, t.usuario AS "targetId", t.usuario_lanc, t.data, t.hora, t.hora_mensagem, t.descricao,
              t.status, t.prioridade, t.titulo, t.recorrencia, t.empresa, target.nome AS target_nome,
              creator.nome AS usuario_lanc_nome
         FROM ${config.table} t
         LEFT JOIN ${config.targetTable} target ON target.id = t.usuario AND target.empresa = t.empresa
         LEFT JOIN usuarios creator ON creator.id = t.usuario_lanc AND creator.empresa = t.empresa
        WHERE t.empresa = ?
        ORDER BY t.data DESC, t.hora DESC, t.id DESC`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['titulo', 'descricao', 'target_nome', 'usuario_lanc_nome'], statusField: 'status', dateField: 'data', defaultSort: 'data' }));
  } catch (error) { next(error); }
});
router.post('/tasks', taskPermission, authorize('Administrador', 'Gerente', 'Comum', 'Técnico'), async (req, res, next) => {
  try {
    const config = req.taskConfig;
    const data = taskSchema.parse(req.body);
    const [target] = await pool.execute(`SELECT id FROM ${config.targetTable} WHERE id = ? AND empresa = ? LIMIT 1`, [data.targetId, Number(req.auth.companyId)]);
    if (!target[0]) throw Object.assign(new Error(`${config.targetLabel} não encontrado.`), { status: 404 });
    const [result] = await pool.execute(
      `INSERT INTO ${config.table}
        (usuario, usuario_lanc, data, hora, hora_mensagem, descricao, status, hash, prioridade, titulo, recorrencia, empresa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.targetId, Number(req.auth.sub), data.data, data.hora, data.hora_mensagem ?? null, data.descricao ?? '', data.status ?? 'Pendente', randomUUID(), data.prioridade ?? 'Média', data.titulo, data.recorrencia ?? 0, Number(req.auth.companyId)]
    );
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: config.table, entityId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.patch('/tasks/:id', taskPermission, authorize('Administrador', 'Gerente', 'Comum', 'Técnico'), async (req, res, next) => {
  try {
    const config = req.taskConfig;
    const taskId = id.parse(req.params.id);
    const data = taskSchema.partial().parse(req.body);
    const mapping = { targetId: 'usuario' };
    const fields = ['targetId', 'data', 'hora', 'hora_mensagem', 'descricao', 'status', 'prioridade', 'titulo', 'recorrencia'].filter((field) => data[field] !== undefined);
    if (!fields.length) return res.status(204).end();
    const [result] = await pool.execute(
      `UPDATE ${config.table} SET ${fields.map((field) => `${mapping[field] || field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`,
      [...fields.map((field) => data[field]), taskId, Number(req.auth.companyId)]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Tarefa não encontrada.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: config.table, entityId: taskId, details: fields });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.delete('/tasks/:id', taskPermission, authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const config = req.taskConfig;
    const taskId = id.parse(req.params.id);
    const [result] = await pool.execute(`DELETE FROM ${config.table} WHERE id = ? AND empresa = ?`, [taskId, Number(req.auth.companyId)]);
    if (!result.affectedRows) throw Object.assign(new Error('Tarefa não encontrada.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'excluir', entity: config.table, entityId: taskId, reason: req.body?.reason || null });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/tickets', permit('chamados'), feature('chamados'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.data, c.titulo, c.texto, c.status, c.respondido, c.empresa,
              (SELECT COUNT(*) FROM chamados_respostas cr WHERE cr.chamado = c.id AND cr.empresa = c.empresa) AS respostas
         FROM chamados c WHERE c.empresa = ? ORDER BY c.data DESC, c.id DESC`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['titulo', 'texto'], statusField: 'status', dateField: 'data', defaultSort: 'data' }));
  } catch (error) { next(error); }
});
router.get('/tickets/:id', permit('chamados'), feature('chamados'), async (req, res, next) => {
  try {
    const ticketId = id.parse(req.params.id);
    const [tickets] = await pool.execute('SELECT id, data, titulo, texto, status, respondido, empresa FROM chamados WHERE id = ? AND empresa = ?', [ticketId, Number(req.auth.companyId)]);
    if (!tickets[0]) throw Object.assign(new Error('Chamado não encontrado.'), { status: 404 });
    const [replies] = await pool.execute(
      `SELECT cr.id, cr.data, cr.hora, cr.usuario, cr.texto, u.nome AS usuario_nome
         FROM chamados_respostas cr
         LEFT JOIN usuarios u ON u.id = cr.usuario AND u.empresa = cr.empresa
        WHERE cr.chamado = ? AND cr.empresa = ? ORDER BY cr.data, cr.hora, cr.id`,
      [ticketId, Number(req.auth.companyId)]
    );
    res.json({ ...normalizeRecord(tickets[0]), replies: replies.map(normalizeRecord) });
  } catch (error) { next(error); }
});
router.post('/tickets', permit('chamados'), feature('chamados'), async (req, res, next) => {
  try {
    const data = ticketSchema.parse(req.body);
    const [result] = await pool.execute(
      `INSERT INTO chamados (empresa, data, titulo, texto, status, respondido)
       VALUES (?, CURRENT_DATE, ?, ?, ?, 'Não')`,
      [Number(req.auth.companyId), data.titulo, data.texto, data.status ?? 'Aberto']
    );
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'chamados', entityId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});
router.patch('/tickets/:id', permit('chamados'), feature('chamados'), async (req, res, next) => {
  try {
    const ticketId = id.parse(req.params.id);
    const data = ticketSchema.partial().parse(req.body);
    const fields = ['titulo', 'texto', 'status'].filter((field) => data[field] !== undefined);
    if (!fields.length) return res.status(204).end();
    const [result] = await pool.execute(`UPDATE chamados SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`, [...fields.map((field) => data[field]), ticketId, Number(req.auth.companyId)]);
    if (!result.affectedRows) throw Object.assign(new Error('Chamado não encontrado.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: 'chamados', entityId: ticketId, details: fields });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/tickets/:id/replies', permit('chamados'), feature('chamados'), async (req, res, next) => {
  try {
    const ticketId = id.parse(req.params.id);
    const data = replySchema.parse(req.body);
    const [ticket] = await pool.execute('SELECT id FROM chamados WHERE id = ? AND empresa = ?', [ticketId, Number(req.auth.companyId)]);
    if (!ticket[0]) throw Object.assign(new Error('Chamado não encontrado.'), { status: 404 });
    const [result] = await pool.execute(
      `INSERT INTO chamados_respostas (empresa, data, hora, usuario, texto, chamado)
       VALUES (?, CURRENT_DATE, LOCALTIME, ?, ?, ?)`,
      [Number(req.auth.companyId), Number(req.auth.sub), data.texto, ticketId]
    );
    await pool.execute(`UPDATE chamados SET respondido = 'Sim', status = CASE WHEN status = 'Aberto' THEN 'Em andamento' ELSE status END WHERE id = ? AND empresa = ?`, [ticketId, Number(req.auth.companyId)]);
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'responder', entity: 'chamados', entityId: ticketId, details: { replyId: result.insertId } });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});

module.exports = router;
