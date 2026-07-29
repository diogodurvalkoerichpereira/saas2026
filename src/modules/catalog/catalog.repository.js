const { pool } = require('../../config/database');

function createRepository({ table, fields, orderBy = 'nome', defaults = {} }) {
  return {
    async list(companyId, db = pool) {
      const [rows] = await db.execute(`SELECT id, ${fields.join(', ')}, empresa FROM ${table} WHERE empresa = ? ORDER BY ${orderBy}`, [companyId]);
      return rows;
    },
    async create(data, companyId, db = pool) {
      const values = fields.map((field) => data[field] ?? (typeof defaults[field] === 'function' ? defaults[field]() : defaults[field]) ?? null);
      const [result] = await db.execute(`INSERT INTO ${table} (${fields.join(', ')}, empresa) VALUES (${fields.map(() => '?').join(', ')}, ?)`, [...values, companyId]);
      return result.insertId;
    },
    async update(id, data, companyId, db = pool) {
      const changed = fields.filter((field) => data[field] !== undefined);
      if (!changed.length) return;
      const [result] = await db.execute(`UPDATE ${table} SET ${changed.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND empresa = ?`, [...changed.map((field) => data[field]), id, companyId]);
      if (!result.affectedRows) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
    }
  };
}

module.exports = { createRepository };
