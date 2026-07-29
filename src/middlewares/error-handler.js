function notFound(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Erro interno do servidor.' : error.message });
}

module.exports = { notFound, errorHandler };
