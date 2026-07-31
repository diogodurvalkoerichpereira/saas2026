const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { env } = require('../../config/env');
const { clientAuthenticate } = require('../../middlewares/client-authenticate');
const { loginRateLimit } = require('../../middlewares/login-rate-limit');
const { listResponse, normalizeRecord } = require('../../lib/list-response');

const id = z.coerce.number().int().positive();
const credentials = z.object({
  email: z.string().email().max(50),
  password: z.string().min(1).max(72),
  companyId: z.number().int().positive().optional()
});
const profileSchema = z.object({
  nome: z.string().trim().min(2).max(50).optional(),
  telefone: z.string().trim().max(20).optional(),
  endereco: z.string().trim().max(100).optional(),
  numero: z.string().trim().max(10).optional(),
  bairro: z.string().trim().max(50).optional(),
  cidade: z.string().trim().max(50).optional(),
  estado: z.string().trim().max(50).optional(),
  cep: z.string().trim().max(20).optional(),
  complemento: z.string().trim().max(100).optional(),
  marketing: z.enum(['Sim', 'Não']).optional(),
  password: z.string().min(8).max(72).optional()
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const data = credentials.parse(req.body);
    const params = [data.email];
    const companyFilter = data.companyId ? ' AND c.empresa = ?' : '';
    if (data.companyId) params.push(data.companyId);
    const [rows] = await pool.execute(
      `SELECT c.id, c.nome, c.email, c.senha_crip, c.ativo, c.empresa, e.nome AS empresa_nome,
              e.ativo AS empresa_ativa, e.data_teste
         FROM clientes c
         JOIN empresas e ON e.id = c.empresa
        WHERE c.email = ?${companyFilter}
        ORDER BY c.id DESC LIMIT 2`,
      params
    );
    if (rows.length > 1 && !data.companyId) {
      throw Object.assign(new Error('Informe o código da empresa para identificar sua conta.'), { status: 409 });
    }
    const client = rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const activeCompany = client?.empresa_ativa === 'Sim' && (!client.data_teste || String(client.data_teste).slice(0, 10) >= today);
    if (!client || client.ativo !== 'Sim' || !activeCompany || !client.senha_crip || !(await bcrypt.compare(data.password, client.senha_crip))) {
      throw Object.assign(new Error('E-mail, empresa ou senha inválidos.'), { status: 401 });
    }
    const token = jwt.sign({ sub: client.id, companyId: client.empresa, role: 'Cliente', kind: 'client' }, env.jwtSecret, { expiresIn: '8h' });
    res.json({
      token,
      user: { id: client.id, name: client.nome, email: client.email, role: 'Cliente', companyId: client.empresa, companyName: client.empresa_nome }
    });
  } catch (error) { next(error); }
});

router.use(clientAuthenticate);

router.get('/me', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, nome, cpf, telefone, email, endereco, numero, bairro, cidade, estado, cep,
              tipo_pessoa, data_cad, data_nasc, complemento, empresa, marketing, ativo
         FROM clientes WHERE id = ? AND empresa = ?`,
      [Number(req.clientAuth.sub), Number(req.clientAuth.companyId)]
    );
    if (!rows[0]) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
    res.json(normalizeRecord(rows[0]));
  } catch (error) { next(error); }
});

router.patch('/me', async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body);
    const allowed = ['nome', 'telefone', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'complemento', 'marketing'];
    const fields = allowed.filter((field) => data[field] !== undefined);
    const assignments = fields.map((field) => `${field} = ?`);
    const values = fields.map((field) => data[field]);
    if (data.password) {
      assignments.push('senha_crip = ?');
      values.push(await bcrypt.hash(data.password, 12));
    }
    if (!assignments.length) return res.status(204).end();
    const [result] = await pool.execute(
      `UPDATE clientes SET ${assignments.join(', ')} WHERE id = ? AND empresa = ? AND ativo = 'Sim'`,
      [...values, Number(req.clientAuth.sub), Number(req.clientAuth.companyId)]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
    res.status(204).end();
  } catch (error) { next(error); }
});

function clientList(path, sql, options) {
  router.get(path, async (req, res, next) => {
    try {
      const [rows] = await pool.execute(sql, [Number(req.clientAuth.sub), Number(req.clientAuth.companyId)]);
      res.json(listResponse(rows, req.query, options));
    } catch (error) { next(error); }
  });
}

clientList(
  '/orders',
  `SELECT o.id, o.data, o.data_entrega, o.status, o.equipamento, o.marca, o.modelo, o.defeito,
          o.laudo, o.subtotal, o.pago, u.nome AS tecnico_nome
     FROM os o LEFT JOIN usuarios u ON u.id = o.tecnico AND u.empresa = o.empresa
    WHERE o.cliente = ? AND o.empresa = ? ORDER BY o.data DESC, o.id DESC`,
  { searchFields: ['equipamento', 'marca', 'modelo', 'defeito', 'status'], statusField: 'status', dateField: 'data', defaultSort: 'data' }
);
clientList(
  '/quotes',
  `SELECT id, data, data_entrega, status, equipamento, marca, modelo, defeito, subtotal, dias_validade
     FROM orcamentos WHERE cliente = ? AND empresa = ? ORDER BY data DESC, id DESC`,
  { searchFields: ['equipamento', 'marca', 'modelo', 'defeito', 'status'], statusField: 'status', dateField: 'data', defaultSort: 'data' }
);
clientList(
  '/contracts',
  `SELECT id, titulo, status, inicio, fim, valor, criado_em, atualizado_em
     FROM node_contracts WHERE cliente = ? AND empresa = ? ORDER BY criado_em DESC, id DESC`,
  { searchFields: ['titulo', 'status'], statusField: 'status', dateField: 'criado_em', defaultSort: 'criado_em' }
);
clientList(
  '/billing',
  `SELECT id, descricao, valor, subtotal, vencimento, data_pgto, data_lanc, pago, referencia, node_status
     FROM receber WHERE cliente = ? AND empresa = ? ORDER BY vencimento DESC, id DESC`,
  { searchFields: ['descricao', 'referencia'], statusField: 'pago', dateField: 'vencimento', defaultSort: 'vencimento' }
);

router.get('/orders/:id', async (req, res, next) => {
  try {
    const orderId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT o.*, u.nome AS tecnico_nome FROM os o
       LEFT JOIN usuarios u ON u.id = o.tecnico AND u.empresa = o.empresa
       WHERE o.id = ? AND o.cliente = ? AND o.empresa = ?`,
      [orderId, Number(req.clientAuth.sub), Number(req.clientAuth.companyId)]
    );
    if (!rows[0]) throw Object.assign(new Error('Ordem de serviço não encontrada.'), { status: 404 });
    const [items] = await pool.execute(
      `SELECT po.id, 'Produto' AS tipo, p.nome, po.quantidade, po.valor, po.total
         FROM produtos_orc po JOIN produtos p ON p.id = po.produto
        WHERE po.os = ? AND po.empresa = ?
        UNION ALL
       SELECT so.id, 'Serviço' AS tipo, s.nome, so.quantidade, so.valor, so.total
         FROM servicos_orc so JOIN servicos s ON s.id = so.servico
        WHERE so.os = ? AND so.empresa = ?`,
      [orderId, Number(req.clientAuth.companyId), orderId, Number(req.clientAuth.companyId)]
    );
    res.json({ ...normalizeRecord(rows[0]), items: items.map(normalizeRecord) });
  } catch (error) { next(error); }
});

router.get('/contracts/:id', async (req, res, next) => {
  try {
    const contractId = id.parse(req.params.id);
    const [rows] = await pool.execute(
      `SELECT c.id, c.titulo, c.conteudo, c.status, c.inicio, c.fim, c.valor, c.criado_em,
              s.assinado_por, s.assinado_em
         FROM node_contracts c
         LEFT JOIN node_contract_signatures s ON s.contrato = c.id AND s.empresa = c.empresa AND s.cliente = c.cliente
        WHERE c.id = ? AND c.cliente = ? AND c.empresa = ?`,
      [contractId, Number(req.clientAuth.sub), Number(req.clientAuth.companyId)]
    );
    if (!rows[0]) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
    res.json(normalizeRecord(rows[0]));
  } catch (error) { next(error); }
});

router.post('/contracts/:id/sign', async (req, res, next) => {
  try {
    const contractId = id.parse(req.params.id);
    const data = z.object({ name: z.string().trim().min(3).max(100), accepted: z.literal(true) }).parse(req.body);
    const [contracts] = await pool.execute(
      `SELECT id FROM node_contracts WHERE id = ? AND cliente = ? AND empresa = ? AND status IN ('Rascunho', 'Ativo')`,
      [contractId, Number(req.clientAuth.sub), Number(req.clientAuth.companyId)]
    );
    if (!contracts[0]) throw Object.assign(new Error('Contrato não encontrado ou encerrado.'), { status: 409 });
    await pool.execute(
      `INSERT INTO node_contract_signatures
        (empresa, contrato, cliente, assinado_por, user_agent, assinado_em)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE assinado_por = VALUES(assinado_por), user_agent = VALUES(user_agent), assinado_em = CURRENT_TIMESTAMP`,
      [Number(req.clientAuth.companyId), contractId, Number(req.clientAuth.sub), data.name, String(req.headers['user-agent'] || '').slice(0, 255)]
    );
    await pool.execute(`UPDATE node_contracts SET status = 'Ativo', atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND empresa = ?`, [contractId, Number(req.clientAuth.companyId)]);
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
