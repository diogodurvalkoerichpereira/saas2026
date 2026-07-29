const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Autenticação obrigatória.' });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.kind && payload.kind !== 'staff') return res.status(403).json({ error: 'Esta sessão não possui acesso ao painel administrativo.' });
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

module.exports = { authenticate };
