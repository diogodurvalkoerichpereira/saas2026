const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { saasOnly } = require('../../middlewares/saas-only');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { provisionCompanyResources } = require('../../services/plan-provisioning');
const { CORE } = require('../../config/features');

const id = z.coerce.number().int().positive();
const yesNo = z.enum(['Sim', 'Não']);
const optional = (max) => z.string().trim().max(max).optional();
const companySchema = z.object({
  nome: z.string().trim().min(2).max(50),
  cpf: optional(25), telefone: optional(20),
  email: z.union([z.string().email().max(50), z.literal('')]).optional(),
  endereco: optional(100), numero: optional(10), bairro: optional(50), cidade: optional(50),
  estado: optional(50), cep: optional(20), tipo_pessoa: optional(15), complemento: optional(100),
  dias_teste: z.number().int().min(0).max(3650).optional(),
  mensalidade: z.number().nonnegative().optional(),
  data_teste: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ativo: yesNo.optional(),
  plano: z.number().int().positive().nullable().optional(),
  url_site: optional(100),
  frequencia: z.number().int().nonnegative().nullable().optional(),
  dispositivos: z.number().int().min(0).max(1000).optional()
});
const planSchema = z.object({
  nome: z.string().trim().min(2).max(255),
  valor: z.number().nonnegative(),
  ativo: yesNo.optional(),
  clientes: z.number().int().min(0).max(1000000).optional(),
  usuarios: z.number().int().min(0).max(1000000).optional(),
  dispositivos: z.number().int().min(0).max(1000000).optional()
});
const resourceSchema = z.object({
  nome: z.string().trim().min(2).max(50),
  chave: z.string().trim().regex(/^[a-z0-9_]+$/).max(50)
});
const alertSchema = z.object({
  titulo: z.string().trim().min(2).max(100),
  texto: z.string().trim().min(2).max(5000),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ativo: yesNo.optional()
});

router.use(authenticate, saasOnly);

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [[companies], [plans], [users], [receivables]] = await Promise.all([
      pool.execute(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE ativo = 'Sim') ativos, COALESCE(SUM(mensalidade), 0) mrr FROM empresas`),
      pool.execute(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE ativo = 'Sim') ativos FROM planos`),
      pool.execute(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE ativo = 'Sim') ativos FROM usuarios WHERE empresa = 0 OR empresa IS NULL`),
      pool.execute(`SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN pago = 'Sim' THEN subtotal ELSE 0 END), 0) recebido,
                           COALESCE(SUM(CASE WHEN (pago IS NULL OR pago <> 'Sim') THEN subtotal ELSE 0 END), 0) pendente
                      FROM receber_sas WHERE node_status = 'ativo'`)
    ]);
    res.json({ companies: normalizeRecord(companies[0]), plans: normalizeRecord(plans[0]), users: normalizeRecord(users[0]), receivables: normalizeRecord(receivables[0]) });
  } catch (error) { next(error); }
});

router.get('/companies', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT e.id, e.nome, e.cpf, e.telefone, e.email, e.cidade, e.estado, e.data_cad, e.data_teste,
              e.mensalidade, e.ativo, e.plano, e.url_site, e.dispositivos, p.nome AS plano_nome,
              (SELECT COUNT(*) FROM usuarios u WHERE u.empresa = e.id AND u.ativo = 'Sim') AS usuarios_ativos,
              (SELECT COUNT(*) FROM clientes c WHERE c.empresa = e.id AND c.ativo = 'Sim') AS clientes_ativos
         FROM empresas e LEFT JOIN planos p ON p.id = e.plano ORDER BY e.nome`
    );
    res.json(listResponse(rows, req.query, { searchFields: ['nome', 'cpf', 'telefone', 'email', 'cidade', 'plano_nome'], statusField: 'ativo', dateField: 'data_cad', defaultSort: 'nome' }));
  } catch (error) { next(error); }
});

router.get('/companies/:id', async (req, res, next) => {
  try {
    const companyId = id.parse(req.params.id);
    const [rows] = await pool.execute('SELECT * FROM empresas WHERE id = ?', [companyId]);
    if (!rows[0]) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 });
    res.json(normalizeRecord(rows[0]));
  } catch (error) { next(error); }
});

router.post('/companies', async (req, res, next) => {
  try {
    const data = companySchema.parse(req.body);
    const [result] = await pool.execute(
      `INSERT INTO empresas
        (nome, cpf, telefone, email, endereco, numero, bairro, cidade, estado, cep, tipo_pessoa,
         data_cad, complemento, dias_teste, mensalidade, data_teste, ativo, plano, url_site, frequencia, dispositivos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nome, data.cpf ?? '', data.telefone ?? '', data.email ?? '', data.endereco ?? '', data.numero ?? '',
        data.bairro ?? '', data.cidade ?? '', data.estado ?? '', data.cep ?? '', data.tipo_pessoa ?? 'Jurídica',
        data.complemento ?? '', data.dias_teste ?? 0, data.mensalidade ?? 0, data.data_teste ?? null,
        data.ativo ?? 'Sim', data.plano ?? null, data.url_site ?? '', data.frequencia ?? null, data.dispositivos ?? 0
      ]
    );
    // Provisiona os recursos da empresa a partir do plano (núcleo + premium do plano).
    await provisionCompanyResources({ companyId: result.insertId, planId: data.plano ?? null });
    await audit(pool, { companyId: 0, userId: Number(req.auth.sub), action: 'criar', entity: 'empresa', entityId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});

router.patch('/companies/:id', async (req, res, next) => {
  try {
    const companyId = id.parse(req.params.id);
    const data = companySchema.partial().parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) return res.status(204).end();
    const [result] = await pool.execute(`UPDATE empresas SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`, [...fields.map((field) => data[field]), companyId]);
    if (!result.affectedRows) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 });
    // Se o plano mudou, ressincroniza os recursos liberados da empresa.
    if (Object.prototype.hasOwnProperty.call(data, 'plano')) {
      await provisionCompanyResources({ companyId, planId: data.plano ?? null });
    }
    await audit(pool, { companyId: 0, userId: Number(req.auth.sub), action: 'editar', entity: 'empresa', entityId: companyId, details: fields });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete('/companies/:id', async (req, res, next) => {
  try {
    const companyId = id.parse(req.params.id);
    const reason = z.object({ reason: z.string().trim().min(3).max(255) }).parse(req.body).reason;
    const [result] = await pool.execute(`UPDATE empresas SET ativo = 'Não' WHERE id = ? AND ativo = 'Sim'`, [companyId]);
    if (!result.affectedRows) throw Object.assign(new Error('Empresa não encontrada ou já inativa.'), { status: 409 });
    await audit(pool, { companyId: 0, userId: Number(req.auth.sub), action: 'inativar', entity: 'empresa', entityId: companyId, reason });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post('/companies/:id/restore', async (req, res, next) => {
  try {
    const companyId = id.parse(req.params.id);
    const [result] = await pool.execute(`UPDATE empresas SET ativo = 'Sim' WHERE id = ? AND ativo = 'Não'`, [companyId]);
    if (!result.affectedRows) throw Object.assign(new Error('Empresa não encontrada ou já ativa.'), { status: 409 });
    await audit(pool, { companyId: 0, userId: Number(req.auth.sub), action: 'reativar', entity: 'empresa', entityId: companyId });
    res.status(204).end();
  } catch (error) { next(error); }
});

function registerSimpleCrud(path, { table, schema, entity, orderBy = 'id DESC' }) {
  router.get(path, async (req, res, next) => {
    try {
      const [rows] = await pool.execute(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
      res.json(listResponse(rows, req.query, { searchFields: Object.keys(schema.shape), statusField: schema.shape.ativo ? 'ativo' : undefined, defaultSort: orderBy.split(/[ ,]/)[0] }));
    } catch (error) { next(error); }
  });
  router.post(path, async (req, res, next) => {
    try {
      const data = schema.parse(req.body);
      const fields = Object.keys(data);
      const [result] = await pool.execute(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, fields.map((field) => data[field]));
      await audit(pool, { companyId: 0, userId: Number(req.auth.sub), action: 'criar', entity, entityId: result.insertId });
      res.status(201).json({ id: result.insertId });
    } catch (error) { next(error); }
  });
  router.patch(`${path}/:id`, async (req, res, next) => {
    try {
      const recordId = id.parse(req.params.id);
      const data = schema.partial().parse(req.body);
      const fields = Object.keys(data);
      if (!fields.length) return res.status(204).end();
      const [result] = await pool.execute(`UPDATE ${table} SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`, [...fields.map((field) => data[field]), recordId]);
      if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
      await audit(pool, { companyId: 0, userId: Number(req.auth.sub), action: 'editar', entity, entityId: recordId, details: fields });
      res.status(204).end();
    } catch (error) { next(error); }
  });
}

registerSimpleCrud('/plans', { table: 'planos', schema: planSchema, entity: 'plano', orderBy: 'nome' });
registerSimpleCrud('/resources', { table: 'recursos', schema: resourceSchema, entity: 'recurso', orderBy: 'nome' });
registerSimpleCrud('/alerts', { table: 'alertas_sas', schema: alertSchema, entity: 'alerta_sas', orderBy: 'data DESC, id DESC' });

router.get('/plans/:id/resources', async (req, res, next) => {
  try {
    const planId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT r.id, r.nome, r.chave, CASE WHEN pr.id IS NULL THEN 'Não' ELSE 'Sim' END selecionado
         FROM recursos r LEFT JOIN planos_recursos pr ON pr.recurso = r.id AND pr.plano = ?
        ORDER BY r.nome`,
      [planId]
    );
    // Marca o núcleo: sempre incluído em qualquer plano (o ERP não funciona sem ele). O que o
    // administrador realmente escolhe são os recursos premium.
    res.json({ items: rows.map((row) => ({ ...row, nucleo: CORE.has(row.chave) ? 'Sim' : 'Não' })) });
  } catch (error) { next(error); }
});
router.put('/plans/:id/resources', async (req, res, next) => {
  try {
    const planId = id.parse(req.params.id);
    const { resourceIds, items } = z.object({
      resourceIds: z.array(z.number().int().positive()).max(500),
      items: z.array(z.string().trim().min(1).max(100)).max(100).optional()
    }).parse(req.body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [plan] = await connection.execute('SELECT id FROM planos WHERE id = ?', [planId]);
      if (!plan[0]) throw Object.assign(new Error('Plano não encontrado.'), { status: 404 });
      await connection.execute('DELETE FROM planos_recursos WHERE plano = ?', [planId]);
      for (const resourceId of [...new Set(resourceIds)]) {
        const [resource] = await connection.execute('SELECT id FROM recursos WHERE id = ?', [resourceId]);
        if (resource[0]) await connection.execute('INSERT INTO planos_recursos (plano, recurso) VALUES (?, ?)', [planId, resourceId]);
      }
      if (items) {
        await connection.execute('DELETE FROM planos_itens WHERE plano = ?', [planId]);
        for (const item of [...new Set(items)]) await connection.execute('INSERT INTO planos_itens (plano, nome) VALUES (?, ?)', [planId, item]);
      }
      // Cascata: as empresas que já estão neste plano são re-sincronizadas para o novo conjunto de
      // recursos (núcleo + premium do plano). Sem isso, tirar um recurso do plano não tirava o
      // acesso de quem já estava nele.
      const [affected] = await connection.execute('SELECT id FROM empresas WHERE plano = ? AND id > 0', [planId]);
      for (const company of affected) {
        await provisionCompanyResources({ companyId: company.id, planId, db: connection });
      }
      await audit(connection, { companyId: 0, userId: Number(req.auth.sub), action: 'recursos', entity: 'plano', entityId: planId, details: { resourceIds, items: items || [], empresasAfetadas: affected.length } });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/companies/:id/resources', async (req, res, next) => {
  try {
    const companyId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT r.id, r.nome, r.chave,
              CASE WHEN cr.id IS NOT NULL OR pr.id IS NOT NULL THEN 'Sim' ELSE 'Não' END AS selecionado,
              CASE WHEN cr.id IS NOT NULL THEN 'Exceção da empresa' WHEN pr.id IS NOT NULL THEN 'Plano' ELSE 'Indisponível' END AS origem
         FROM recursos r
         LEFT JOIN empresas e ON e.id = ?
         LEFT JOIN planos_recursos pr ON pr.recurso = r.id AND pr.plano = e.plano
         LEFT JOIN clientes_recursos cr ON cr.recurso = r.id AND cr.empresa = e.id
        ORDER BY r.nome`,
      [companyId]
    );
    res.json({ items: rows.map((row) => ({ ...row, nucleo: CORE.has(row.chave) ? 'Sim' : 'Não' })) });
  } catch (error) { next(error); }
});
router.put('/companies/:id/resources', async (req, res, next) => {
  try {
    const companyId = id.parse(req.params.id);
    const { resourceIds } = z.object({ resourceIds: z.array(z.number().int().positive()).max(500) }).parse(req.body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [company] = await connection.execute('SELECT id FROM empresas WHERE id = ?', [companyId]);
      if (!company[0]) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 });
      await connection.execute('DELETE FROM clientes_recursos WHERE empresa = ?', [companyId]);
      for (const resourceId of [...new Set(resourceIds)]) {
        const [resource] = await connection.execute('SELECT id FROM recursos WHERE id = ?', [resourceId]);
        if (resource[0]) await connection.execute('INSERT INTO clientes_recursos (empresa, recurso) VALUES (?, ?)', [companyId, resourceId]);
      }
      await audit(connection, { companyId: 0, userId: Number(req.auth.sub), action: 'recursos', entity: 'empresa', entityId: companyId, details: resourceIds });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/billing', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, e.nome AS empresa_nome, f.nome AS forma_pgto_nome
         FROM receber_sas r
         LEFT JOIN empresas e ON e.id = r.cliente
         LEFT JOIN formas_pgto f ON f.id = r.forma_pgto AND (f.empresa = 0 OR f.empresa IS NULL)
        ORDER BY r.vencimento DESC, r.id DESC`
    );
    res.json(listResponse(rows, req.query, { searchFields: ['descricao', 'empresa_nome', 'referencia'], statusField: 'pago', dateField: 'vencimento', defaultSort: 'vencimento' }));
  } catch (error) { next(error); }
});

module.exports = router;
