const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');
const { providers } = require('../../integrations/whatsapp.providers');

const id = z.coerce.number().int().positive();
const optional = (max) => z.string().trim().max(max).optional();
const siteSchema = z.object({
  titulo: optional(255), subtitulo: optional(255), botao1: optional(80), botao2: optional(80),
  botao3: optional(80), titulo_recursos: optional(255), titulo_perguntas: optional(255),
  titulo_rodape: optional(255), descricao_rodape: optional(10000), botao_rodape: optional(100),
  link_rodape: optional(255), descricao_site: optional(10000), video_site: optional(255)
});
const featureSchema = z.object({
  titulo_recurso: z.string().trim().min(2).max(150),
  icone_recurso: optional(100),
  descricao_recurso: z.string().trim().min(2).max(255),
  posicao_recurso: z.number().int().min(0).max(999).optional()
});
const faqSchema = z.object({
  titulo_pergunta: z.string().trim().min(2).max(150),
  descricao_pergunta: z.string().trim().min(2).max(10000),
  posicao_pergunta: z.number().int().min(0).max(999).optional()
});
const settingsSchema = z.object({
  nome: optional(50), email: z.union([z.string().email().max(50), z.literal('')]).optional(),
  telefone: optional(20), endereco: optional(100), instagram: optional(100), cnpj: optional(25),
  cidade_sistema: optional(50), marca_dagua: z.enum(['Sim', 'Não']).optional(),
  assinatura_recibo: z.enum(['Sim', 'Não']).optional(), impressao_automatica: z.enum(['Sim', 'Não']).optional(),
  abertura_caixa: z.enum(['Sim', 'Não']).optional(), dias_comissao: z.number().int().min(0).max(365).optional(),
  assinatura_cliente: z.enum(['Sim', 'Não']).optional(), cobrar_automaticamente: z.enum(['Sim', 'Não']).optional(),
  cobrar_duas_vezes: z.enum(['Sim', 'Não']).optional(), pagina_entrada: optional(25),
  url_site: optional(255), meta_descricao: optional(255),
  multa_atraso: z.number().min(0).max(100).optional(), juros_atraso: z.number().min(0).max(100).optional(),
  dias_lembrete: z.number().int().min(0).max(365).optional(),
  mao_obra_orc: optional(100), senha_aparelho_orc: optional(100), defeito_orc: optional(100),
  avarias_orc: optional(100), acessorios_orc: optional(100), laudo_orc: optional(100),
  mao_obra_os: optional(100), senha_aparelho_os: optional(100), defeito_os: optional(100),
  avarias_os: optional(100), acessorios_os: optional(100), laudo_os: optional(100),
  // Provedor de WhatsApp da empresa: só os valores suportados (espelha o select do legado).
  api_whatsapp: z.enum(['Não', ...Object.keys(providers)]).optional(),
  token_whatsapp: optional(70), instancia_whatsapp: optional(70)
});

router.use(authenticate);

router.get('/settings', permit('configuracoes', 'home'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, nome, email, telefone, endereco, instagram, cnpj, cidade_sistema, marca_dagua,
              assinatura_recibo, impressao_automatica, abertura_caixa, dias_comissao, assinatura_cliente,
              cobrar_automaticamente, cobrar_duas_vezes, pagina_entrada, url_site, meta_descricao, empresa,
              multa_atraso, juros_atraso, dias_lembrete,
              mao_obra_orc, senha_aparelho_orc, defeito_orc, avarias_orc, acessorios_orc, laudo_orc,
              mao_obra_os, senha_aparelho_os, defeito_os, avarias_os, acessorios_os, laudo_os,
              api_whatsapp, token_whatsapp, instancia_whatsapp
         FROM config WHERE empresa = ? ORDER BY id DESC LIMIT 1`,
      [Number(req.auth.companyId)]
    );
    if (!rows[0]) return res.json(null);
    const record = normalizeRecord(rows[0]);
    // Token do WhatsApp é write-only: nunca reexibido, só um indicador de configurado.
    record.token_whatsapp_configurado = Boolean(record.token_whatsapp);
    delete record.token_whatsapp;
    res.json(record);
  } catch (error) { next(error); }
});
router.put('/settings', permit('configuracoes', 'home'), authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const data = settingsSchema.parse(req.body);
    // Token vazio significa "manter o atual" (write-only), não apagar.
    if (data.token_whatsapp === '') delete data.token_whatsapp;
    const fields = Object.keys(data);
    if (!fields.length) return res.status(204).end();
    const [existing] = await pool.execute('SELECT id FROM config WHERE empresa = ? ORDER BY id DESC LIMIT 1', [Number(req.auth.companyId)]);
    let settingId;
    if (existing[0]) {
      settingId = existing[0].id;
      if (fields.length) await pool.execute(`UPDATE config SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`, [...fields.map((field) => data[field]), settingId, Number(req.auth.companyId)]);
    } else {
      const [result] = await pool.execute(`INSERT INTO config (${fields.join(', ')}, empresa) VALUES (${fields.map(() => '?').join(', ')}, ?)`, [...fields.map((field) => data[field]), Number(req.auth.companyId)]);
      settingId = result.insertId;
    }
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: existing[0] ? 'editar' : 'criar', entity: 'configuracoes', entityId: settingId, details: fields });
    res.json({ id: settingId });
  } catch (error) { next(error); }
});

router.get('/site', permit('site'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, empresa, titulo, subtitulo, botao1, botao2, botao3, titulo_recursos, titulo_perguntas,
              titulo_rodape, descricao_rodape, botao_rodape, link_rodape, descricao_site, video_site
         FROM site WHERE empresa = ? ORDER BY id DESC LIMIT 1`,
      [Number(req.auth.companyId)]
    );
    res.json(rows[0] ? normalizeRecord(rows[0]) : null);
  } catch (error) { next(error); }
});
router.put('/site', permit('site'), authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const data = siteSchema.parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) return res.status(204).end();
    const [existing] = await pool.execute('SELECT id FROM site WHERE empresa = ? ORDER BY id DESC LIMIT 1', [Number(req.auth.companyId)]);
    let siteId;
    if (existing[0]) {
      siteId = existing[0].id;
      if (fields.length) await pool.execute(`UPDATE site SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`, [...fields.map((field) => data[field]), siteId, Number(req.auth.companyId)]);
    } else {
      const [result] = await pool.execute(`INSERT INTO site (${fields.join(', ')}, empresa) VALUES (${fields.map(() => '?').join(', ')}, ?)`, [...fields.map((field) => data[field]), Number(req.auth.companyId)]);
      siteId = result.insertId;
    }
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: existing[0] ? 'editar' : 'criar', entity: 'site', entityId: siteId, details: fields });
    res.json({ id: siteId });
  } catch (error) { next(error); }
});

function crudRoutes(path, { table, schema, permission, orderBy, searchFields }) {
  router.get(path, permit(permission), async (req, res, next) => {
    try {
      const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE empresa = ? ORDER BY ${orderBy}`, [Number(req.auth.companyId)]);
      res.json(listResponse(rows, req.query, { searchFields, defaultSort: orderBy.split(/[ ,]/)[0] }));
    } catch (error) { next(error); }
  });
  router.post(path, permit(permission), authorize('Administrador', 'Gerente'), async (req, res, next) => {
    try {
      const data = schema.parse(req.body);
      const fields = Object.keys(data);
      const [result] = await pool.execute(`INSERT INTO ${table} (${fields.join(', ')}, empresa) VALUES (${fields.map(() => '?').join(', ')}, ?)`, [...fields.map((field) => data[field]), Number(req.auth.companyId)]);
      await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: table, entityId: result.insertId });
      res.status(201).json({ id: result.insertId });
    } catch (error) { next(error); }
  });
  router.patch(`${path}/:id`, permit(permission), authorize('Administrador', 'Gerente'), async (req, res, next) => {
    try {
      const recordId = id.parse(req.params.id);
      const data = schema.partial().parse(req.body);
      const fields = Object.keys(data);
      if (!fields.length) return res.status(204).end();
      const [result] = await pool.execute(`UPDATE ${table} SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`, [...fields.map((field) => data[field]), recordId, Number(req.auth.companyId)]);
      if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
      await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'editar', entity: table, entityId: recordId, details: fields });
      res.status(204).end();
    } catch (error) { next(error); }
  });
  router.delete(`${path}/:id`, permit(permission), authorize('Administrador', 'Gerente'), async (req, res, next) => {
    try {
      const recordId = id.parse(req.params.id);
      const [result] = await pool.execute(`DELETE FROM ${table} WHERE id = ? AND empresa = ?`, [recordId, Number(req.auth.companyId)]);
      if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
      await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'excluir', entity: table, entityId: recordId, reason: req.body?.reason || null });
      res.status(204).end();
    } catch (error) { next(error); }
  });
}

crudRoutes('/site/features', { table: 'recursos_site', schema: featureSchema, permission: 'site', orderBy: 'posicao_recurso, id', searchFields: ['titulo_recurso', 'descricao_recurso'] });
crudRoutes('/site/faqs', { table: 'perguntas_site', schema: faqSchema, permission: 'site', orderBy: 'posicao_pergunta, id', searchFields: ['titulo_pergunta', 'descricao_pergunta'] });

router.get('/tutorials', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, titulo, link, ordem FROM videos ORDER BY ordem, id');
    res.json(listResponse(rows, req.query, { searchFields: ['titulo', 'link'], defaultSort: 'ordem' }));
  } catch (error) { next(error); }
});

router.get('/subscription', permit('home'), async (req, res, next) => {
  try {
    const companyId = Number(req.auth.companyId);
    const [companies] = await pool.execute(
      `SELECT e.id, e.nome, e.ativo, e.data_teste, e.mensalidade, e.plano, e.dispositivos,
              p.nome AS plano_nome, p.valor AS plano_valor, p.clientes AS limite_clientes,
              p.usuarios AS limite_usuarios, p.dispositivos AS limite_dispositivos
         FROM empresas e LEFT JOIN planos p ON p.id = e.plano WHERE e.id = ?`,
      [companyId]
    );
    if (!companies[0]) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 });
    const [[resources], [billing], [usage]] = await Promise.all([
      pool.execute(
        `SELECT DISTINCT r.id, r.nome, r.chave
           FROM recursos r
           LEFT JOIN planos_recursos pr ON pr.recurso = r.id AND pr.plano = ?
           LEFT JOIN clientes_recursos cr ON cr.recurso = r.id AND cr.empresa = ?
          WHERE pr.id IS NOT NULL OR cr.id IS NOT NULL ORDER BY r.nome`,
        [companies[0].plano, companyId]
      ),
      pool.execute(
        `SELECT id, descricao, subtotal, vencimento, pago, data_pgto, node_status
           FROM receber_sas WHERE cliente = ? ORDER BY vencimento DESC, id DESC LIMIT 24`,
        [companyId]
      ),
      pool.execute(
        `SELECT (SELECT COUNT(*) FROM clientes WHERE empresa = ? AND ativo = 'Sim') AS clientes,
                (SELECT COUNT(*) FROM usuarios WHERE empresa = ? AND ativo = 'Sim') AS usuarios,
                (SELECT COUNT(*) FROM dispositivos WHERE empresa = ?) AS dispositivos`,
        [companyId, companyId, companyId]
      )
    ]);
    res.json({ company: normalizeRecord(companies[0]), resources, billing: billing.map(normalizeRecord), usage: normalizeRecord(usage[0]) });
  } catch (error) { next(error); }
});

module.exports = router;
