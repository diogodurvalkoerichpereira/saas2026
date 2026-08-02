const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/database');
const { env } = require('../../config/env');
const { CORE } = require('../../config/features');

async function authenticate({ email, password }) {
  const [users] = await pool.execute(
    `SELECT id, nome, email, senha_crip, nivel, ativo, empresa, mostrar_registros, acessar_painel
       FROM usuarios WHERE email = ? ORDER BY id DESC LIMIT 1`,
    [email]
  );
  const user = users[0];
  if (!user || user.ativo !== 'Sim' || !(await bcrypt.compare(password, user.senha_crip))) {
    const error = new Error('E-mail ou senha inválidos.');
    error.status = 401;
    throw error;
  }
  if (user.acessar_painel === 'Não') {
    const error = new Error('Este usuário não tem permissão para acessar o painel.');
    error.status = 403;
    throw error;
  }

  if (user.empresa > 0) {
    const [companies] = await pool.execute('SELECT data_teste, ativo FROM empresas WHERE id = ? LIMIT 1', [user.empresa]);
    const company = companies[0];
    const today = new Date().toISOString().slice(0, 10);
    const trialExpired = company?.data_teste && String(company.data_teste).slice(0, 10) < today;
    if (!company || company.ativo !== 'Sim' || trialExpired) {
      const error = new Error('A empresa não está ativa.');
      error.status = 403;
      throw error;
    }
  }

  const isTenantUser = Number(user.empresa) > 0;
  const permissionTable = isTenantUser ? 'usuarios_permissoes' : 'usuarios_permissoes_sas';
  const accessTable = isTenantUser ? 'acessos' : 'acessos_sas';
  const [permissionRows] = user.nivel === 'Administrador'
    ? await pool.execute(`SELECT chave FROM ${accessTable} ORDER BY chave`)
    : await pool.execute(
      `SELECT DISTINCT a.chave
         FROM ${permissionTable} up
         JOIN ${accessTable} a ON a.id = up.permissao
        WHERE up.usuario = ?
        ORDER BY a.chave`,
      [user.id]
    );
  const permissions = permissionRows.map((row) => row.chave);

  // Recursos (features do plano) da empresa. Admin do sistema e painel SaaS (empresa 0) enxergam
  // tudo; empresa comum recebe os recursos do seu plano ∪ o núcleo (via provisionamento).
  let resources = [];
  if (!isTenantUser || user.nivel === 'Administrador') {
    const [all] = await pool.execute('SELECT chave FROM recursos ORDER BY chave');
    resources = all.map((row) => row.chave);
  } else {
    const [rows] = await pool.execute(
      `SELECT r.chave FROM clientes_recursos cr JOIN recursos r ON r.id = cr.recurso
        WHERE cr.empresa = ? ORDER BY r.chave`,
      [user.empresa]
    );
    resources = [...new Set([...CORE, ...rows.map((row) => row.chave)])];
  }

  const mostrarRegistros = user.mostrar_registros !== 'Não';
  const payload = { sub: user.id, companyId: user.empresa || 0, role: user.nivel, kind: 'staff', mostrarRegistros };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '8h' });
  return {
    token,
    user: {
      id: user.id,
      name: user.nome,
      email: user.email,
      role: user.nivel,
      companyId: user.empresa || 0,
      mostrarRegistros,
      permissions,
      resources
    }
  };
}

module.exports = { authenticate };
