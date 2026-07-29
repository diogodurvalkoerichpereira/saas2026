function saasOnly(req, res, next) {
  if (!req.auth || Number(req.auth.companyId) !== 0 || req.auth.role !== 'Administrador') {
    return res.status(403).json({ error: 'Acesso exclusivo da administração SaaS.' });
  }
  next();
}

module.exports = { saasOnly };
