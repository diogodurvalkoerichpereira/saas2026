const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('./auth.service');
const { loginRateLimit, clearLoginAttempts } = require('../../middlewares/login-rate-limit');
const { pool } = require('../../config/database');
const { env } = require('../../config/env');

const credentials = z.object({ email: z.string().email(), password: z.string().min(1) });

// A senha compartilhada dos usuários de teste do seed (db/002-seed-test.sql). Só é útil para esses
// usuários, que já são "remover antes de produção" — o acesso rápido não expõe nenhum segredo novo.
const SEED_TEST_PASSWORD = 'Teste@2026';

// Acesso rápido na tela de login (fase de teste): lista os usuários de teste do seed que realmente
// existem, com a senha conhecida. Vazio quando desligado (SHOW_TEST_LOGINS=false) ou quando o seed
// não foi aplicado (produção), então some sozinho fora de teste.
router.get('/test-logins', async (req, res, next) => {
  try {
    if (!env.showTestLogins) return res.json({ users: [] });
    const [rows] = await pool.execute(
      "SELECT nome, email, nivel, empresa FROM usuarios WHERE email LIKE '%.local@saas2026.local' AND ativo = 'Sim' ORDER BY empresa DESC, id"
    );
    res.json({ users: rows.map((row) => ({ nome: row.nome, email: row.email, nivel: row.nivel, isSaas: Number(row.empresa) === 0, password: SEED_TEST_PASSWORD })) });
  } catch (error) { next(error); }
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const result = await authenticate(credentials.parse(req.body));
    clearLoginAttempts(req);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) error.status = 400;
    next(error);
  }
});

module.exports = router;
