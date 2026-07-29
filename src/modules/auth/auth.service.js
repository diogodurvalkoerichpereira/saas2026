const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/database');
const { env } = require('../../config/env');

async function authenticate({ email, password }) {
  const [users] = await pool.execute(
    `SELECT id, nome, email, senha_crip, nivel, ativo, empresa, mostrar_registros
       FROM usuarios WHERE email = ? ORDER BY id DESC LIMIT 1`,
    [email]
  );
  const user = users[0];
  if (!user || user.ativo !== 'Sim' || !(await bcrypt.compare(password, user.senha_crip))) {
    const error = new Error('E-mail ou senha inválidos.');
    error.status = 401;
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

  const payload = { sub: user.id, companyId: user.empresa || 0, role: user.nivel };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '8h' });
  return { token, user: { id: user.id, name: user.nome, email: user.email, role: user.nivel, companyId: user.empresa || 0 } };
}

module.exports = { authenticate };
