const { pool } = require('../../config/database');

function tenantClause(companyId) {
  return companyId > 0 ? { sql: 'empresa = ?', params: [companyId] } : { sql: '(empresa = 0 OR empresa IS NULL)', params: [] };
}

async function listUsers(companyId, db = pool) {
  const tenant = tenantClause(companyId);
  const [rows] = await db.execute(`SELECT id, nome, email, nivel, ativo, empresa, telefone, foto, mostrar_registros FROM usuarios WHERE ${tenant.sql} ORDER BY nome`, tenant.params);
  return rows;
}

async function assertUserInTenant(userId, companyId, db = pool) {
  const tenant = tenantClause(companyId);
  const [rows] = await db.execute(`SELECT id FROM usuarios WHERE id = ? AND ${tenant.sql} LIMIT 1`, [userId, ...tenant.params]);
  if (!rows[0]) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
}

async function listPermissions(userId, companyId, db = pool) {
  await assertUserInTenant(userId, companyId, db);
  const table = companyId > 0 ? 'usuarios_permissoes' : 'usuarios_permissoes_sas';
  const [rows] = await db.execute(`SELECT permissao FROM ${table} WHERE usuario = ? ORDER BY permissao`, [userId]);
  return rows.map(({ permissao }) => Number(permissao));
}

async function replacePermissions(userId, permissionIds, companyId, db = pool) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await assertUserInTenant(userId, companyId, connection);
    const table = companyId > 0 ? 'usuarios_permissoes' : 'usuarios_permissoes_sas';
    await connection.execute(`DELETE FROM ${table} WHERE usuario = ?`, [userId]);
    for (const permissionId of [...new Set(permissionIds)]) await connection.execute(`INSERT INTO ${table} (usuario, permissao) VALUES (?, ?)`, [userId, permissionId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { listUsers, listPermissions, replacePermissions, tenantClause };
