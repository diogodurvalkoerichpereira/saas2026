const { pool } = require('../config/database');

function permit(...keys) {
  return async (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Autenticação obrigatória.' });
    if (req.auth.role === 'Administrador') return next();

    try {
      const table = Number(req.auth.companyId) > 0 ? 'usuarios_permissoes' : 'usuarios_permissoes_sas';
      const accessTable = Number(req.auth.companyId) > 0 ? 'acessos' : 'acessos_sas';
      const placeholders = keys.map(() => '?').join(', ');
      const [rows] = await pool.execute(
        `SELECT 1
           FROM ${table} up
           JOIN ${accessTable} a ON a.id = up.permissao
          WHERE up.usuario = ? AND a.chave IN (${placeholders})
          LIMIT 1`,
        [Number(req.auth.sub), ...keys]
      );
      if (!rows[0]) return res.status(403).json({ error: 'Você não possui permissão para este módulo.' });
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { permit };
