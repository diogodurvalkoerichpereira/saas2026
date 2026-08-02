function notFound(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

// Monta uma mensagem útil a partir do primeiro problema de validação, já em português (o mapa do
// Zod é aplicado em app.js). Inclui o nome do campo para o usuário saber onde corrigir.
function zodMessage(error) {
  const issue = error.issues?.[0];
  if (!issue) return 'Dados inválidos.';
  const campo = Array.isArray(issue.path) ? issue.path.filter((p) => typeof p !== 'number').join('.') : '';
  return campo ? `${campo}: ${issue.message}` : issue.message;
}

// Códigos de erro do PostgreSQL (SQLSTATE). O código anterior checava códigos do MySQL
// (ER_ROW_IS_REFERENCED_2), que o pg nunca produz — a mensagem amigável nunca disparava.
const PG_MENSAGENS = {
  23503: { status: 409, error: 'Este registro está sendo utilizado por outro módulo.' }, // foreign_key_violation
  23505: { status: 409, error: 'Já existe um registro com esses dados.' }, // unique_violation
  23502: { status: 400, error: 'Preencha todos os campos obrigatórios.' } // not_null_violation
};

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  if (error?.name === 'ZodError') {
    return res.status(400).json({ error: zodMessage(error), details: error.issues });
  }
  const pg = PG_MENSAGENS[error?.code];
  if (pg) {
    return res.status(pg.status).json({ error: pg.error });
  }
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Erro interno do servidor.' : error.message });
}

module.exports = { notFound, errorHandler };
