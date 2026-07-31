const { pool } = require('../../config/database');

const configs = {
  quotes: {
    table: 'orcamentos',
    statuses: ['Pendente', 'Aprovado', 'Reprovado', 'Cancelado'],
    transitions: {
      Pendente: ['Aprovado', 'Reprovado', 'Cancelado'],
      Aprovado: ['Cancelado'],
      Reprovado: ['Pendente', 'Cancelado'],
      Cancelado: []
    },
    select: `id, cliente, data, data_entrega, dias_validade, valor, desconto, tipo_desconto, subtotal, obs, status,
      total_produtos, total_servicos, funcionario, frete, equipamento, marca, modelo, defeito, condicoes,
      acessorios, laudo, senha_ap, mao_obra, vall, empresa,
      (SELECT nome FROM clientes c WHERE c.id = orcamentos.cliente AND c.empresa = orcamentos.empresa LIMIT 1) AS cliente_nome,
      (SELECT nome FROM usuarios u WHERE u.id = orcamentos.funcionario AND u.empresa = orcamentos.empresa LIMIT 1) AS funcionario_nome`
  },
  orders: {
    table: 'os',
    statuses: ['Aberta', 'Iniciada', 'Em andamento', 'Aguardando Peça', 'Aguardando Aprovação', 'Finalizada', 'Entregue', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
    transitions: {
      Aberta: ['Iniciada', 'Em andamento', 'Aguardando Peça', 'Aguardando Aprovação', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
      Iniciada: ['Em andamento', 'Aguardando Peça', 'Aguardando Aprovação', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
      'Em andamento': ['Iniciada', 'Aguardando Peça', 'Aguardando Aprovação', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
      'Aguardando Peça': ['Iniciada', 'Em andamento', 'Aguardando Aprovação', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
      'Aguardando Aprovação': ['Iniciada', 'Em andamento', 'Aguardando Peça', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
      Finalizada: ['Entregue', 'Cancelada'],
      Entregue: [],
      'Sem Reparo': [],
      'Não Aprovada': [],
      Cancelada: []
    },
    select: `id, cliente, data, data_entrega, dias_validade, valor, desconto, tipo_desconto, subtotal, obs, status,
      total_produtos, total_servicos, funcionario, frete, tecnico, equipamento, marca, modelo, defeito, condicoes,
      acessorios, laudo, senha_ap, mao_obra, val_entrada, vall, dias_garantia, forma_pgto, orcamento, pago, empresa,
      (SELECT nome FROM clientes c WHERE c.id = os.cliente AND c.empresa = os.empresa LIMIT 1) AS cliente_nome,
      (SELECT nome FROM usuarios u WHERE u.id = os.funcionario AND u.empresa = os.empresa LIMIT 1) AS funcionario_nome,
      (SELECT nome FROM usuarios u WHERE u.id = os.tecnico AND u.empresa = os.empresa LIMIT 1) AS tecnico_nome`
  }
};

function configFor(type) {
  const config = configs[type];
  if (!config) throw Object.assign(new Error('Tipo de operação inválido.'), { status: 400 });
  return config;
}

function assertTransition(config, currentStatus, nextStatus) {
  if (!config.statuses.includes(nextStatus)) throw Object.assign(new Error('Status inválido.'), { status: 400 });
  if (!currentStatus || currentStatus === nextStatus) return;
  if (!(config.transitions[currentStatus] || []).includes(nextStatus)) {
    throw Object.assign(new Error(`Transição de status inválida: ${currentStatus} → ${nextStatus}.`), { status: 409 });
  }
}

async function listWorkItems(type, id, companyId, db = pool) {
  const relation = type === 'orders' ? 'os' : 'orcamento';
  const [products] = await db.execute(
    `SELECT 'product' AS kind, po.id, po.produto AS itemId, po.quantidade AS quantity, po.valor AS unitPrice, po.total,
            p.nome, p.codigo
       FROM produtos_orc po
       JOIN produtos p ON p.id = po.produto AND p.empresa = ?
      WHERE po.${relation} = ? ORDER BY po.id`,
    [companyId, id]
  );
  const [services] = await db.execute(
    `SELECT 'service' AS kind, so.id, so.servico AS itemId, so.quantidade AS quantity, so.valor AS unitPrice, so.total,
            s.nome
       FROM servicos_orc so
       JOIN servicos s ON s.id = so.servico AND s.empresa = ?
      WHERE so.${relation} = ? ORDER BY so.id`,
    [companyId, id]
  );
  return [...products, ...services];
}

async function resolveItems(items, companyId, db) {
  const resolved = [];
  for (const item of items || []) {
    const isProduct = item.kind === 'product';
    const [rows] = await db.execute(
      `SELECT id, ${isProduct ? 'valor_venda' : 'valor'} AS unitPrice FROM ${isProduct ? 'produtos' : 'servicos'} WHERE id = ? AND empresa = ? AND ativo = 'Sim' LIMIT 1`,
      [item.itemId, companyId]
    );
    if (!rows[0]) throw Object.assign(new Error(`${isProduct ? 'Produto' : 'Serviço'} indisponível.`), { status: 404 });
    const unitPrice = Number(rows[0].unitPrice);
    resolved.push({ ...item, unitPrice, total: unitPrice * item.quantity });
  }
  return resolved;
}

async function replaceWorkItems(type, id, items, companyId, userId, db) {
  const relation = type === 'orders' ? 'os' : 'orcamento';
  await db.execute(`DELETE FROM produtos_orc WHERE ${relation} = ?`, [id]);
  await db.execute(`DELETE FROM servicos_orc WHERE ${relation} = ?`, [id]);
  const resolved = await resolveItems(items, companyId, db);
  for (const item of resolved) {
    const relationValues = type === 'orders' ? [0, id] : [id, 0];
    if (item.kind === 'product') {
      await db.execute(
        'INSERT INTO produtos_orc (produto, orcamento, funcionario, quantidade, valor, total, os) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.itemId, relationValues[0], userId, item.quantity, item.unitPrice, item.total, relationValues[1]]
      );
    } else {
      await db.execute(
        'INSERT INTO servicos_orc (servico, orcamento, funcionario, quantidade, valor, total, os) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.itemId, relationValues[0], userId, item.quantity, item.unitPrice, item.total, relationValues[1]]
      );
    }
  }
  return {
    total_produtos: resolved.filter((item) => item.kind === 'product').reduce((sum, item) => sum + item.total, 0),
    total_servicos: resolved.filter((item) => item.kind === 'service').reduce((sum, item) => sum + item.total, 0)
  };
}

async function listWork(type, companyId, status, restrictToUserId, db = pool) {
  const config = configFor(type);
  const params = [companyId];
  const statusFilter = status ? ' AND status = ?' : '';
  if (status) params.push(status);
  let ownerFilter = '';
  if (restrictToUserId) {
    ownerFilter = type === 'orders' ? ' AND (funcionario = ? OR tecnico = ?)' : ' AND funcionario = ?';
    params.push(restrictToUserId);
    if (type === 'orders') params.push(restrictToUserId);
  }
  const [rows] = await db.execute(`SELECT ${config.select} FROM ${config.table} WHERE empresa = ?${statusFilter}${ownerFilter} ORDER BY data DESC, id DESC`, params);
  return rows;
}

async function getWork(type, id, companyId, db = pool) {
  const config = configFor(type);
  const [rows] = await db.execute(`SELECT ${config.select} FROM ${config.table} WHERE id = ? AND empresa = ? LIMIT 1`, [id, companyId]);
  if (!rows[0]) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
  return { ...rows[0], items: await listWorkItems(type, id, companyId, db) };
}

async function loadTextDefaults(type, companyId, db) {
  const suffix = type === 'orders' ? '_os' : '_orc';
  const [rows] = await db.execute(
    `SELECT mao_obra${suffix} AS mao_obra_texto, senha_aparelho${suffix} AS senha_aparelho, defeito${suffix} AS defeito,
            avarias${suffix} AS avarias, acessorios${suffix} AS acessorios, laudo${suffix} AS laudo
       FROM config WHERE empresa = ? ORDER BY id DESC LIMIT 1`,
    [companyId]
  );
  return rows[0] || {};
}

async function createWork(type, data, companyId, userId, db = pool) {
  const config = configFor(type);
  assertTransition(config, null, data.status);
  const connection = typeof db.getConnection === 'function' ? await db.getConnection() : db;
  const ownsConnection = connection !== db;
  try {
    if (connection.beginTransaction) await connection.beginTransaction();
    const totals = await resolveItems(data.items || [], companyId, connection);
    const totalProducts = totals.filter((item) => item.kind === 'product').reduce((sum, item) => sum + item.total, 0);
    const totalServices = totals.filter((item) => item.kind === 'service').reduce((sum, item) => sum + item.total, 0);
    const itemTotal = totalProducts + totalServices;
    const value = data.items?.length ? itemTotal : data.valor ?? 0;
    const defaults = await loadTextDefaults(type, companyId, connection);
    const condicoesDefault = [defaults.avarias, defaults.mao_obra_texto].filter(Boolean).join(' ');
    const baseColumns = ['cliente', 'data', 'data_entrega', 'dias_validade', 'valor', 'desconto', 'tipo_desconto', 'subtotal', 'obs', 'status', 'total_produtos', 'total_servicos', 'funcionario', 'frete', 'equipamento', 'marca', 'modelo', 'defeito', 'condicoes', 'acessorios', 'laudo', 'senha_ap', 'mao_obra', 'vall', 'empresa'];
    const values = [data.cliente, data.data, data.data_entrega, data.dias_validade ?? 0, value, data.desconto ?? 0, data.tipo_desconto ?? 'Valor', value, data.obs ?? '', data.status, totalProducts, totalServices, userId, data.frete ?? 0, data.equipamento ?? '', data.marca ?? '', data.modelo ?? '', data.defeito ?? defaults.defeito ?? '', data.condicoes ?? condicoesDefault, data.acessorios ?? defaults.acessorios ?? '', data.laudo ?? defaults.laudo ?? '', data.senha_ap ?? defaults.senha_aparelho ?? '', data.mao_obra ?? 0, data.vall ?? 0, companyId];
    if (type === 'orders') {
      baseColumns.push('tecnico', 'val_entrada', 'dias_garantia', 'forma_pgto', 'orcamento', 'pago');
      values.push(data.tecnico ?? 0, data.val_entrada ?? 0, data.dias_garantia ?? '', data.forma_pgto ?? '', data.orcamento ?? 0, data.pago ?? 'Não');
    }
    const [result] = await connection.execute(`INSERT INTO ${config.table} (${baseColumns.join(', ')}) VALUES (${baseColumns.map(() => '?').join(', ')})`, values);
    await replaceWorkItems(type, result.insertId, data.items || [], companyId, userId, connection);
    if (connection.commit) await connection.commit();
    return result.insertId;
  } catch (error) {
    if (connection.rollback) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function updateWork(type, id, data, companyId, userId = 0, db = pool) {
  const config = configFor(type);
  const connection = typeof db.getConnection === 'function' ? await db.getConnection() : db;
  const ownsConnection = connection !== db;
  try {
    if (connection.beginTransaction) await connection.beginTransaction();
    const [currentRows] = await connection.execute(`SELECT status FROM ${config.table} WHERE id = ? AND empresa = ? FOR UPDATE`, [id, companyId]);
    if (!currentRows[0]) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
    if (data.status) assertTransition(config, currentRows[0].status, data.status);
    const itemTotals = data.items ? await replaceWorkItems(type, id, data.items, companyId, userId, connection) : null;
    const itemTotal = itemTotals ? itemTotals.total_produtos + itemTotals.total_servicos : null;
    const merged = itemTotals ? { ...data, ...itemTotals, valor: itemTotal, subtotal: itemTotal } : data;
    delete merged.items;
    const allowed = [
      'cliente', 'data_entrega', 'dias_validade', 'valor', 'desconto', 'tipo_desconto', 'subtotal', 'obs', 'status',
      'total_produtos', 'total_servicos', 'frete', 'equipamento', 'marca', 'modelo', 'defeito', 'condicoes',
      'acessorios', 'laudo', 'senha_ap', 'mao_obra', 'vall',
      ...(type === 'orders' ? ['tecnico', 'pago', 'val_entrada', 'dias_garantia', 'forma_pgto', 'orcamento'] : [])
    ];
    const changed = allowed.filter((field) => merged[field] !== undefined);
    if (changed.length) {
      await connection.execute(`UPDATE ${config.table} SET ${changed.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`, [...changed.map((field) => merged[field]), id, companyId]);
    }
    if (connection.commit) await connection.commit();
  } catch (error) {
    if (connection.rollback) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function updateStatus(type, id, status, companyId, db = pool) {
  const config = configFor(type);
  if (!config.statuses.includes(status)) throw Object.assign(new Error('Status inválido.'), { status: 400 });
  const [currentRows] = await db.execute(`SELECT status FROM ${config.table} WHERE id = ? AND empresa = ?`, [id, companyId]);
  if (!currentRows[0]) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
  assertTransition(config, currentRows[0].status, status);
  const [result] = await db.execute(`UPDATE ${config.table} SET status = ? WHERE id = ? AND empresa = ?`, [status, id, companyId]);
  if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
}

module.exports = { configFor, assertTransition, listWork, listWorkItems, getWork, createWork, updateWork, updateStatus, loadTextDefaults };
