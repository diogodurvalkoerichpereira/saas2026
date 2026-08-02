'use strict';

// Cria (idempotente) os 7 usuários de teste — um por perfil, senha Teste@2026 — que fazem o
// "Acesso rápido de teste" da tela de login aparecer. Rode uma vez na VPS durante a fase de teste:
//
//   node scripts/criar-usuarios-teste.js
//
// Alternativa sem terminal: definir SEED_TEST_USERS=true no ambiente e dar Redeploy — o start
// executa a mesma semeadura. NÃO usar em produção de verdade (senha pública).

require('dotenv').config();
const { seedTestUsers, SENHA_TESTE } = require('../src/config/seed-test-users');

seedTestUsers()
  .then(() => {
    console.log(`\nPronto. Senha de todos: ${SENHA_TESTE}`);
    console.log('O "Acesso rápido de teste" aparece na tela de login (após o deploy do código novo).');
    process.exit(0);
  })
  .catch((error) => { console.error('Erro:', error.message); process.exit(1); });
