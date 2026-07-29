const { pool } = require('../../config/database');

const fields = ['nome', 'cpf', 'telefone', 'email', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'tipo_pessoa', 'data_nasc', 'complemento', 'marketing', 'ativo'];

async function listClients(companyId, db = pool) {
  const [rows] = await db.execute(`SELECT id, ${fields.join(', ')}, data_cad, empresa FROM clientes WHERE empresa = ? ORDER BY nome`, [companyId]);
  return rows;
}

async function createClient(data, companyId, userId, db = pool) {
  const columns = [...fields, 'empresa', 'usuario', 'data_cad'];
  const values = fields.map((field) => data[field] ?? null);
  const placeholders = columns.map((column) => column === 'data_cad' ? 'CURRENT_DATE' : '?').join(', ');
  const [result] = await db.execute(`INSERT INTO clientes (${columns.join(', ')}) VALUES (${placeholders})`, [...values, companyId, userId]);
  return result.insertId;
}

async function updateClient(id, data, companyId, db = pool) {
  const assignments = fields.filter((field) => data[field] !== undefined).map((field) => `${field} = ?`);
  const values = fields.filter((field) => data[field] !== undefined).map((field) => data[field]);
  if (!assignments.length) return false;
  const [result] = await db.execute(`UPDATE clientes SET ${assignments.join(', ')} WHERE id = ? AND empresa = ?`, [...values, id, companyId]);
  if (!result.affectedRows) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
  return true;
}

module.exports = { listClients, createClient, updateClient };
