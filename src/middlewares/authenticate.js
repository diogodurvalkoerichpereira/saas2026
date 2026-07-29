const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Autenticação obrigatória.' });
  try {
    req.auth = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

module.exports = { authenticate };
