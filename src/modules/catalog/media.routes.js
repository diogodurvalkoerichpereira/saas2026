const express = require('express');
const path = require('node:path');
const router = express.Router();

// Serve as imagens de produto/serviço sem autenticação: um <img> não envia header Authorization,
// e a foto do produto já é semi-pública (aparece na loja). O nome é um UUID, então não é
// adivinhável, e o padrão restrito evita path traversal. Escopo por empresa vem no caminho.
const uploadRoot = path.resolve(__dirname, '..', '..', '..', 'uploads');
const safeName = /^[a-f0-9-]+\.(jpg|png|webp)$/i;

router.get('/catalog/:companyId/:filename', (req, res) => {
  if (!/^\d+$/.test(req.params.companyId) || !safeName.test(req.params.filename)) {
    return res.status(404).end();
  }
  const absolutePath = path.join(uploadRoot, req.params.companyId, 'catalog', req.params.filename);
  res.sendFile(absolutePath, (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});

// Logo e fundos da landing de planos (empresa 0). São imagens de página pública por definição —
// qualquer visitante as vê no navegador antes de existir qualquer sessão.
router.get('/site/:filename', (req, res) => {
  if (!safeName.test(req.params.filename)) return res.status(404).end();
  res.sendFile(path.join(uploadRoot, '0', 'site', req.params.filename), (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});

module.exports = router;
