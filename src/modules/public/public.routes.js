const { randomUUID } = require('node:crypto');
const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { normalizeRecord } = require('../../lib/list-response');

const companyIdSchema = z.coerce.number().int().positive();
const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(50),
    email: z.string().email().max(50),
    phone: z.string().trim().min(8).max(20),
    document: z.string().trim().max(25).optional(),
    address: z.string().trim().max(100).optional(),
    number: z.string().trim().max(10).optional(),
    city: z.string().trim().max(50).optional(),
    state: z.string().trim().max(50).optional(),
    zipCode: z.string().trim().max(20).optional()
  }),
  items: z.array(z.object({
    kind: z.enum(['product', 'service']),
    itemId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(999)
  })).min(1).max(100),
  paymentMethodId: z.number().int().positive(),
  coupon: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional()
});

async function assertCompany(companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT id, nome, ativo, data_teste, url_site FROM empresas WHERE id = ?`,
    [companyId]
  );
  const company = rows[0];
  const today = new Date().toISOString().slice(0, 10);
  if (!company || company.ativo !== 'Sim' || (company.data_teste && String(company.data_teste).slice(0, 10) < today)) {
    throw Object.assign(new Error('Loja indisponível.'), { status: 404 });
  }
  return company;
}

router.get('/:companyId/site', async (req, res, next) => {
  try {
    const companyId = companyIdSchema.parse(req.params.companyId);
    const company = await assertCompany(companyId);
    const [[siteRows], [features], [faqs], [configRows]] = await Promise.all([
      pool.execute(`SELECT titulo, subtitulo, botao1, botao2, botao3, titulo_recursos, titulo_perguntas,
                           titulo_rodape, descricao_rodape, botao_rodape, link_rodape, descricao_site, video_site
                      FROM site WHERE empresa = ? ORDER BY id DESC LIMIT 1`, [companyId]),
      pool.execute('SELECT titulo_recurso, icone_recurso, descricao_recurso, posicao_recurso FROM recursos_site WHERE empresa = ? ORDER BY posicao_recurso, id', [companyId]),
      pool.execute('SELECT titulo_pergunta, descricao_pergunta, posicao_pergunta FROM perguntas_site WHERE empresa = ? ORDER BY posicao_pergunta, id', [companyId]),
      pool.execute(`SELECT nome, email, telefone, endereco, instagram, cnpj, cidade_sistema, url_site, meta_descricao
                      FROM config WHERE empresa = ? ORDER BY id DESC LIMIT 1`, [companyId])
    ]);
    res.json({ company: normalizeRecord(company), site: normalizeRecord(siteRows[0] || {}), config: normalizeRecord(configRows[0] || {}), features, faqs });
  } catch (error) { next(error); }
});

router.get('/:companyId/catalog', async (req, res, next) => {
  try {
    const companyId = companyIdSchema.parse(req.params.companyId);
    await assertCompany(companyId);
    const [[products], [services], [categories], [paymentMethods]] = await Promise.all([
      pool.execute(
        `SELECT p.id, p.codigo, p.nome, p.valor_venda, p.valor_promocional, p.estoque, p.foto,
                p.nivel_estoque, p.categoria, p.sub_categoria, p.descricao, p.tem_estoque,
                c.nome AS categoria_nome
           FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria AND c.empresa = p.empresa
          WHERE p.empresa = ? AND p.ativo = 'Sim' AND p.mostrar_site = 'Sim'
          ORDER BY p.nome`,
        [companyId]
      ),
      pool.execute(`SELECT id, nome, valor, dias, foto, descricao FROM servicos WHERE empresa = ? AND ativo = 'Sim' AND mostrar_site = 'Sim' ORDER BY nome`, [companyId]),
      pool.execute(`SELECT id, nome, icone FROM categorias WHERE empresa = ? AND ativo = 'Sim' ORDER BY nome`, [companyId]),
      pool.execute(`SELECT id, nome, taxa FROM formas_pgto WHERE empresa = ? ORDER BY nome`, [companyId])
    ]);
    res.json({ products: products.map(normalizeRecord), services: services.map(normalizeRecord), categories, paymentMethods: paymentMethods.map(normalizeRecord) });
  } catch (error) { next(error); }
});

router.get('/:companyId/coupons/:code', async (req, res, next) => {
  try {
    const companyId = companyIdSchema.parse(req.params.companyId);
    await assertCompany(companyId);
    const code = z.string().trim().min(1).max(50).parse(req.params.code);
    const [rows] = await pool.execute(
      `SELECT codigo, valor, data, quantidade, valor_minimo, tipo
         FROM cupons
        WHERE empresa = ? AND UPPER(codigo) = UPPER(?)
          AND (data IS NULL OR data >= CURRENT_DATE)
          AND (quantidade IS NULL OR quantidade > 0)
        LIMIT 1`,
      [companyId, code]
    );
    if (!rows[0]) throw Object.assign(new Error('Cupom inválido ou expirado.'), { status: 404 });
    res.json(normalizeRecord(rows[0]));
  } catch (error) { next(error); }
});

router.post('/:companyId/checkout', async (req, res, next) => {
  try {
    const companyId = companyIdSchema.parse(req.params.companyId);
    const data = checkoutSchema.parse(req.body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await assertCompany(companyId, connection);
      const [paymentMethods] = await connection.execute('SELECT id FROM formas_pgto WHERE id = ? AND empresa = ?', [data.paymentMethodId, companyId]);
      if (!paymentMethods[0]) throw Object.assign(new Error('Forma de pagamento inválida.'), { status: 400 });

      const resolved = [];
      for (const item of data.items) {
        const table = item.kind === 'product' ? 'produtos' : 'servicos';
        const priceColumn = item.kind === 'product' ? 'COALESCE(NULLIF(valor_promocional, 0), valor_venda)' : 'valor';
        const [rows] = await connection.execute(
          `SELECT id, nome, ${priceColumn} AS valor${item.kind === 'product' ? ', estoque, tem_estoque' : ''}
             FROM ${table}
            WHERE id = ? AND empresa = ? AND ativo = 'Sim' AND mostrar_site = 'Sim' FOR UPDATE`,
          [item.itemId, companyId]
        );
        const found = rows[0];
        if (!found) throw Object.assign(new Error('Um item do carrinho não está mais disponível.'), { status: 409 });
        if (item.kind === 'product' && found.tem_estoque !== 'Não' && Number(found.estoque) < item.quantity) {
          throw Object.assign(new Error(`Estoque insuficiente para ${found.nome}.`), { status: 409 });
        }
        const unitPrice = Number(found.valor || 0);
        resolved.push({ ...item, name: found.nome, unitPrice, total: Math.round(unitPrice * item.quantity * 100) / 100, controlsStock: item.kind === 'product' && found.tem_estoque !== 'Não' });
      }
      const subtotal = Math.round(resolved.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
      let discount = 0;
      let coupon = null;
      if (data.coupon) {
        const [coupons] = await connection.execute(
          `SELECT id, codigo, valor, valor_minimo, tipo, quantidade
             FROM cupons
            WHERE empresa = ? AND UPPER(codigo) = UPPER(?)
              AND (data IS NULL OR data >= CURRENT_DATE)
              AND (quantidade IS NULL OR quantidade > 0)
            FOR UPDATE`,
          [companyId, data.coupon]
        );
        coupon = coupons[0];
        if (!coupon) throw Object.assign(new Error('Cupom inválido ou expirado.'), { status: 409 });
        if (subtotal < Number(coupon.valor_minimo || 0)) throw Object.assign(new Error('O carrinho não atingiu o valor mínimo do cupom.'), { status: 409 });
        discount = coupon.tipo === 'Percentual' ? subtotal * Number(coupon.valor) / 100 : Number(coupon.valor);
        discount = Math.min(Math.round(discount * 100) / 100, subtotal);
      }
      const total = Math.round((subtotal - discount) * 100) / 100;

      const [clients] = await connection.execute('SELECT id FROM clientes WHERE empresa = ? AND email = ? ORDER BY id DESC LIMIT 1', [companyId, data.customer.email]);
      let clientId = clients[0]?.id;
      if (!clientId) {
        const [client] = await connection.execute(
          `INSERT INTO clientes
            (nome, cpf, telefone, email, endereco, numero, bairro, cidade, estado, cep, tipo_pessoa,
             data_cad, usuario, complemento, empresa, marketing, ativo)
           VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, 'Física', CURRENT_DATE, 0, '', ?, 'Não', 'Sim')`,
          [data.customer.name, data.customer.document ?? '', data.customer.phone, data.customer.email, data.customer.address ?? '', data.customer.number ?? '', data.customer.city ?? '', data.customer.state ?? '', data.customer.zipCode ?? '', companyId]
        );
        clientId = client.insertId;
      }

      const trackingToken = randomUUID();
      const [receivable] = await connection.execute(
        `INSERT INTO receber
          (descricao, cliente, valor, vencimento, data_lanc, forma_pgto, obs, referencia, subtotal,
           usuario_lanc, usuario_pgto, pago, empresa, total_venda, cancelada, node_status)
         VALUES (?, ?, ?, CURRENT_DATE, CURRENT_DATE, ?, ?, 'Loja online', ?, 0, 0, 'Não', ?, ?, 'Não', 'ativo')`,
        [`Pedido da loja - ${data.customer.name}`, clientId, total, data.paymentMethodId, data.notes ?? '', total, companyId, subtotal]
      );
      const [order] = await connection.execute(
        `INSERT INTO node_store_orders
          (empresa, cliente, recebivel, token_acompanhamento, subtotal, desconto, total, cupom, status, observacoes, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aguardando pagamento', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [companyId, clientId, receivable.insertId, trackingToken, subtotal, discount, total, coupon?.codigo ?? null, data.notes ?? '']
      );
      for (const item of resolved) {
        await connection.execute(
          `INSERT INTO node_store_order_items
            (pedido, tipo, item_id, nome, quantidade, valor_unitario, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [order.insertId, item.kind, item.itemId, item.name, item.quantity, item.unitPrice, item.total]
        );
        await connection.execute(
          `INSERT INTO itens_venda (produto, valor, quantidade, total, id_venda, funcionario, empresa, tipo)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          [item.itemId, item.unitPrice, item.quantity, item.total, receivable.insertId, companyId, item.kind === 'product' ? 'Produto' : 'Serviço']
        );
        if (item.kind === 'product') {
          if (item.controlsStock) {
            await connection.execute('UPDATE produtos SET estoque = estoque - ?, vendas = COALESCE(vendas, 0) + ? WHERE id = ? AND empresa = ?', [item.quantity, item.quantity, item.itemId, companyId]);
            await connection.execute('INSERT INTO saidas (produto, quantidade, motivo, usuario, data, empresa) VALUES (?, ?, ?, 0, CURRENT_DATE, ?)', [item.itemId, item.quantity, `Pedido loja #${order.insertId}`, companyId]);
          } else {
            await connection.execute('UPDATE produtos SET vendas = COALESCE(vendas, 0) + ? WHERE id = ? AND empresa = ?', [item.quantity, item.itemId, companyId]);
          }
        }
      }
      if (coupon?.quantidade !== null && coupon?.quantidade !== undefined) {
        await connection.execute('UPDATE cupons SET quantidade = GREATEST(quantidade - 1, 0) WHERE id = ? AND empresa = ?', [coupon.id, companyId]);
      }
      await connection.commit();
      res.status(201).json({ orderId: order.insertId, trackingToken, subtotal, discount, total, status: 'Aguardando pagamento' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (error) { next(error); }
});

router.get('/orders/:token', async (req, res, next) => {
  try {
    const token = z.string().uuid().parse(req.params.token);
    const [rows] = await pool.execute(
      `SELECT o.id, o.subtotal, o.desconto, o.total, o.status, o.criado_em, o.atualizado_em,
              r.pago, r.data_pgto
         FROM node_store_orders o JOIN receber r ON r.id = o.recebivel AND r.empresa = o.empresa
        WHERE o.token_acompanhamento = ?`,
      [token]
    );
    if (!rows[0]) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });
    res.json(normalizeRecord(rows[0]));
  } catch (error) { next(error); }
});

module.exports = router;
