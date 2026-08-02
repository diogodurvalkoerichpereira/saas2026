'use strict';

const bcrypt = require('bcryptjs');
const { pool } = require('./database');

// Cria (idempotente) os 7 usuários de teste — um por perfil — com a senha conhecida Teste@2026.
// É o que faz o "Acesso rápido de teste" da tela de login aparecer. Usado tanto pelo script
// scripts/criar-usuarios-teste.js quanto, opcionalmente, no start (SEED_TEST_USERS=true).
//
// NÃO é para produção de verdade: são usuários com senha pública. Desligue SEED_TEST_USERS e
// inative-os em Cadastros → Usuários antes de usar pra valer.

const SENHA_TESTE = 'Teste@2026';

// empresa 0 = Administrador do painel SaaS (/admin.html); os demais são da empresa da loja.
const USUARIOS = [
  { nome: 'Administrador de Teste', email: 'teste.local@saas2026.local', nivel: 'Administrador', saas: false },
  { nome: 'Administrador SaaS de Teste', email: 'sas.local@saas2026.local', nivel: 'Administrador', saas: true },
  { nome: 'Gerente de Teste', email: 'gerente.local@saas2026.local', nivel: 'Gerente', saas: false },
  { nome: 'Comum de Teste', email: 'comum.local@saas2026.local', nivel: 'Comum', saas: false },
  { nome: 'Tecnico de Teste', email: 'tecnico.local@saas2026.local', nivel: 'Técnico', saas: false },
  { nome: 'Tesoureiro de Teste', email: 'tesoureiro.local@saas2026.local', nivel: 'Tesoureiro', saas: false },
  { nome: 'Financeiro de Teste', email: 'financeiro.local@saas2026.local', nivel: 'Financeiro', saas: false }
];

async function seedTestUsers({ db = pool, logger = console } = {}) {
  const [empresas] = await db.execute('SELECT id FROM empresas WHERE id > 0 ORDER BY id LIMIT 1');
  const empresaLoja = empresas[0] ? empresas[0].id : 1;
  const hash = await bcrypt.hash(SENHA_TESTE, 12);
  const criados = [];

  for (const u of USUARIOS) {
    const emp = u.saas ? 0 : empresaLoja;
    const [existing] = await db.execute('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [u.email]);
    let id;
    if (existing[0]) {
      id = existing[0].id;
      await db.execute(
        "UPDATE usuarios SET senha = NULL, senha_crip = ?, nivel = ?, ativo = 'Sim', acessar_painel = 'Sim', empresa = ? WHERE id = ?",
        [hash, u.nivel, emp, id]
      );
    } else {
      const [result] = await db.execute(
        `INSERT INTO usuarios (nome, email, senha, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa)
         VALUES (?, ?, NULL, ?, ?, 'Sim', '', CURRENT_DATE, 'Sim', 'Sim', ?)`,
        [u.nome, u.email, hash, u.nivel, emp]
      );
      id = result.insertId;
    }
    // Concede todas as permissões do catálogo apropriado (painel x SaaS).
    if (u.saas) {
      await db.execute(
        'INSERT INTO usuarios_permissoes_sas (usuario, permissao) SELECT ?, a.id FROM acessos_sas a WHERE NOT EXISTS (SELECT 1 FROM usuarios_permissoes_sas up WHERE up.usuario = ? AND up.permissao = a.id)',
        [id, id]
      ).catch(() => {}); // a tabela SaaS pode não existir em toda instalação
    } else {
      await db.execute(
        'INSERT INTO usuarios_permissoes (usuario, permissao) SELECT ?, a.id FROM acessos a WHERE NOT EXISTS (SELECT 1 FROM usuarios_permissoes up WHERE up.usuario = ? AND up.permissao = a.id)',
        [id, id]
      );
    }
    criados.push({ email: u.email, nivel: u.nivel, empresa: emp });
    logger.log(`[seed-test-users] ok: ${u.nivel.padEnd(14)} ${u.email} (empresa ${emp})`);
  }
  return { senha: SENHA_TESTE, usuarios: criados };
}

module.exports = { seedTestUsers, SENHA_TESTE };
