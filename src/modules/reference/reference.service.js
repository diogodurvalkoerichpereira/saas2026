const { pool } = require('../../config/database');

function placeholders(fields) {
  return fields.map(() => '?').join(', ');
}

function selectList(config) {
  return ['id', ...config.fields, 'empresa', ...(config.selectExtras || [])].join(', ');
}

async function list(config, companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT ${selectList(config)} FROM ${config.table} WHERE empresa = ? ORDER BY ${config.orderBy || 'id DESC'}`,
    [companyId]
  );
  return rows;
}

async function get(config, id, companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT ${selectList(config)} FROM ${config.table} WHERE id = ? AND empresa = ? LIMIT 1`,
    [id, companyId]
  );
  if (!rows[0]) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
  return rows[0];
}

async function create(config, data, companyId, userId, db = pool) {
  const values = config.fields.map((field) => {
    if (data[field] !== undefined) return data[field];
    const fallback = config.defaults?.[field];
    return typeof fallback === 'function' ? fallback({ userId }) : fallback ?? null;
  });
  const [result] = await db.execute(
    `INSERT INTO ${config.table} (${config.fields.join(', ')}, empresa) VALUES (${placeholders(config.fields)}, ?)`,
    [...values, companyId]
  );
  return result.insertId;
}

async function update(config, id, data, companyId, db = pool) {
  const changed = config.fields.filter((field) => data[field] !== undefined && !config.immutable?.includes(field));
  if (!changed.length) return;
  const [result] = await db.execute(
    `UPDATE ${config.table} SET ${changed.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`,
    [...changed.map((field) => data[field]), id, companyId]
  );
  if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
}

async function remove(config, id, companyId, db = pool) {
  if (config.activeField) {
    const [result] = await db.execute(
      `UPDATE ${config.table} SET ${config.activeField} = 'Não' WHERE id = ? AND empresa = ?`,
      [id, companyId]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
    return;
  }
  const [result] = await db.execute(`DELETE FROM ${config.table} WHERE id = ? AND empresa = ?`, [id, companyId]);
  if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
}

async function restore(config, id, companyId, db = pool) {
  if (!config.activeField) throw Object.assign(new Error('Este cadastro não utiliza inativação.'), { status: 409 });
  const [result] = await db.execute(
    `UPDATE ${config.table} SET ${config.activeField} = 'Sim' WHERE id = ? AND empresa = ?`,
    [id, companyId]
  );
  if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
}

module.exports = { list, get, create, update, remove, restore };
