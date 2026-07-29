function notFound(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  if (error?.name === 'ZodError') {
    return res.status(400).json({ error: 'Dados inválidos.', details: error.issues });
  }
  if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(409).json({ error: 'Este registro está sendo utilizado por outro módulo.' });
  }
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Erro interno do servidor.' : error.message });
}

module.exports = { notFound, errorHandler };
