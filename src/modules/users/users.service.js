const bcrypt = require('bcryptjs');
const { pool } = require('../../config/database');

function tenantClause(companyId) {
  return companyId > 0 ? { sql: 'empresa = ?', params: [companyId] } : { sql: '(empresa = 0 OR empresa IS NULL)', params: [] };
}

const publicFields = 'id, nome, email, nivel, ativo, empresa, telefone, endereco, data_nasc, numero, bairro, cidade, estado, cep, acessar_painel, cpf, mostrar_registros, complemento';

async function listUsers(companyId, db = pool) {
  const tenant = tenantClause(companyId);
  const [rows] = await db.execute(`SELECT ${publicFields} FROM usuarios WHERE ${tenant.sql} ORDER BY nome`, tenant.params);
  return rows;
}

async function getUser(userId, companyId, db = pool) {
  const tenant = tenantClause(companyId);
  const [rows] = await db.execute(`SELECT ${publicFields} FROM usuarios WHERE id = ? AND ${tenant.sql} LIMIT 1`, [userId, ...tenant.params]);
  if (!rows[0]) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
  return rows[0];
}

async function assertUserInTenant(userId, companyId, db = pool) {
  const tenant = tenantClause(companyId);
  const [rows] = await db.execute(`SELECT id FROM usuarios WHERE id = ? AND ${tenant.sql} LIMIT 1`, [userId, ...tenant.params]);
  if (!rows[0]) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
}

async function createUser(data, companyId, db = pool) {
  const [duplicates] = await db.execute('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [data.email]);
  if (duplicates[0]) throw Object.assign(new Error('Já existe um usuário com este e-mail.'), { status: 409 });
  const hash = await bcrypt.hash(data.password, 12);
  const [result] = await db.execute(
    `INSERT INTO usuarios
      (nome, email, senha, senha_crip, nivel, ativo, telefone, endereco, data, acessar_painel, mostrar_registros, empresa)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?)`,
    [data.nome, data.email, hash, data.nivel, data.ativo ?? 'Sim', data.telefone ?? '', data.endereco ?? '', data.acessar_painel ?? 'Sim', data.mostrar_registros ?? 'Sim', companyId]
  );
  return result.insertId;
}

async function updateUser(userId, data, companyId, db = pool) {
  await assertUserInTenant(userId, companyId, db);
  const allowed = ['nome', 'email', 'nivel', 'telefone', 'endereco', 'acessar_painel', 'mostrar_registros'];
  const changed = allowed.filter((field) => data[field] !== undefined);
  const assignments = changed.map((field) => `${field} = ?`);
  const values = changed.map((field) => data[field]);
  if (data.password) {
    assignments.push('senha = NULL', 'senha_crip = ?');
    values.push(await bcrypt.hash(data.password, 12));
  }
  if (!assignments.length) return;
  await db.execute(`UPDATE usuarios SET ${assignments.join(', ')} WHERE id = ? AND ${tenantClause(companyId).sql}`, [...values, userId, ...tenantClause(companyId).params]);
}

async function setUserActive(userId, active, actorId, companyId, db = pool) {
  if (!active && userId === actorId) throw Object.assign(new Error('Você não pode inativar o próprio usuário.'), { status: 409 });
  const user = await getUser(userId, companyId, db);
  if (!active && user.nivel === 'Administrador') {
    const tenant = tenantClause(companyId);
    const [rows] = await db.execute(`SELECT COUNT(*) total FROM usuarios WHERE nivel = 'Administrador' AND ativo = 'Sim' AND ${tenant.sql}`, tenant.params);
    if (Number(rows[0].total) <= 1) throw Object.assign(new Error('A empresa precisa manter ao menos um administrador ativo.'), { status: 409 });
  }
  const tenant = tenantClause(companyId);
  await db.execute(`UPDATE usuarios SET ativo = ? WHERE id = ? AND ${tenant.sql}`, [active ? 'Sim' : 'Não', userId, ...tenant.params]);
}

async function listPermissionOptions(db = pool) {
  const [rows] = await db.execute('SELECT id, nome, chave, grupo FROM acessos ORDER BY grupo, nome');
  return rows;
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

module.exports = { listUsers, getUser, createUser, updateUser, setUserActive, listPermissionOptions, listPermissions, replacePermissions, tenantClause };
