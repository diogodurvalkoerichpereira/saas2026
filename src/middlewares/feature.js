const { pool } = require('../config/database');
const { CORE } = require('../config/features');

// Bloqueia a rota quando o PLANO da empresa não inclui o recurso. Semântica OR (como o permit):
// passa se a empresa tiver qualquer um dos recursos exigidos. É o segundo filtro, além do permit:
// permit = "o perfil pode?", feature = "a empresa contratou?".
//
// Só o painel do sistema (empresa 0) ignora o plano. TODO usuário de empresa fica preso aos
// recursos do plano — inclusive o Administrador da própria empresa, porque o plano é um limite da
// EMPRESA (não dá para o dono usar o que não contratou). Recursos de núcleo nunca bloqueiam.
function feature(...chaves) {
  return async (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Autenticação obrigatória.' });
    if (Number(req.auth.companyId) === 0) return next();
    if (chaves.some((chave) => CORE.has(chave))) return next();
    try {
      const placeholders = chaves.map(() => '?').join(', ');
      const [rows] = await pool.execute(
        `SELECT 1 FROM clientes_recursos cr
           JOIN recursos r ON r.id = cr.recurso
          WHERE cr.empresa = ? AND r.chave IN (${placeholders})
          LIMIT 1`,
        [Number(req.auth.companyId), ...chaves]
      );
      if (!rows[0]) {
        return res.status(403).json({ error: 'Este recurso não está incluído no plano da sua empresa.', code: 'RECURSO_NAO_INCLUIDO' });
      }
      next();
    } catch (error) { next(error); }
  };
}

module.exports = { feature };
