const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function clientAuthenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Autenticação do cliente obrigatória.' });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.kind !== 'client' || !Number(payload.companyId) || !Number(payload.sub)) {
      return res.status(403).json({ error: 'Esta sessão não pertence ao portal do cliente.' });
    }
    req.clientAuth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

module.exports = { clientAuthenticate };
