const { pool } = require('../../config/database');

const configs = {
  quotes: { table: 'orcamentos', statuses: ['Pendente', 'Aprovado', 'Reprovado'], select: 'id, cliente, data, data_entrega, valor, subtotal, status, total_produtos, total_servicos, funcionario, equipamento, marca, modelo, defeito, empresa' },
  orders: { table: 'os', statuses: ['Aberta', 'Em andamento', 'Finalizada', 'Entregue', 'Cancelada'], select: 'id, cliente, data, data_entrega, valor, subtotal, status, total_produtos, total_servicos, funcionario, tecnico, equipamento, marca, modelo, defeito, pago, empresa' }
};

function configFor(type) {
  const config = configs[type];
  if (!config) throw Object.assign(new Error('Tipo de operação inválido.'), { status: 400 });
  return config;
}

async function listWork(type, companyId, status, db = pool) {
  const config = configFor(type);
  const params = [companyId];
  const statusFilter = status ? ' AND status = ?' : '';
  if (status) params.push(status);
  const [rows] = await db.execute(`SELECT ${config.select} FROM ${config.table} WHERE empresa = ?${statusFilter} ORDER BY data DESC, id DESC`, params);
  return rows;
}

async function updateStatus(type, id, status, companyId, db = pool) {
  const config = configFor(type);
  if (!config.statuses.includes(status)) throw Object.assign(new Error('Status inválido.'), { status: 400 });
  const [result] = await db.execute(`UPDATE ${config.table} SET status = ? WHERE id = ? AND empresa = ?`, [status, id, companyId]);
  if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
}

module.exports = { configFor, listWork, updateStatus };
