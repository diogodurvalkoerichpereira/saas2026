'use strict';

// Cria (idempotente) os 7 usuários de teste — um por perfil — com a senha conhecida Teste@2026.
// É o que faz o "Acesso rápido de teste" da tela de login aparecer: o endpoint só mostra os botões
// quando esses usuários existem. Rode uma vez na VPS durante a fase de teste.
//
//   node scripts/criar-usuarios-teste.js
//
// NÃO usar em produção de verdade: são usuários com senha pública. Para remover depois, inative-os
// em Cadastros → Usuários (ou defina SHOW_TEST_LOGINS=false para só esconder os botões).

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

const SENHA = 'Teste@2026';
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

async function empresaLoja() {
  // Primeira empresa real (id > 0). Numa instalação de empresa única, é a 1.
  const [rows] = await pool.execute('SELECT id FROM empresas WHERE id > 0 ORDER BY id LIMIT 1');
  return rows[0] ? rows[0].id : 1;
}

async function main() {
  const empresa = await empresaLoja();
  const hash = await bcrypt.hash(SENHA, 12);

  for (const u of USUARIOS) {
    const emp = u.saas ? 0 : empresa;
    const [existing] = await pool.execute('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [u.email]);
    let id;
    if (existing[0]) {
      id = existing[0].id;
      await pool.execute(
        "UPDATE usuarios SET senha = NULL, senha_crip = ?, nivel = ?, ativo = 'Sim', acessar_painel = 'Sim', empresa = ? WHERE id = ?",
        [hash, u.nivel, emp, id]
      );
    } else {
      const [result] = await pool.execute(
        `INSERT INTO usuarios (nome, email, senha, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa)
         VALUES (?, ?, NULL, ?, ?, 'Sim', '', CURRENT_DATE, 'Sim', 'Sim', ?)`,
        [u.nome, u.email, hash, u.nivel, emp]
      );
      id = result.insertId;
    }
    // Concede todas as permissões do catálogo apropriado (painel x SaaS).
    if (u.saas) {
      await pool.execute(
        'INSERT INTO usuarios_permissoes_sas (usuario, permissao) SELECT ?, a.id FROM acessos_sas a WHERE NOT EXISTS (SELECT 1 FROM usuarios_permissoes_sas up WHERE up.usuario = ? AND up.permissao = a.id)',
        [id, id]
      ).catch(() => {}); // tabela SaaS pode não existir em toda instalação
    } else {
      await pool.execute(
        'INSERT INTO usuarios_permissoes (usuario, permissao) SELECT ?, a.id FROM acessos a WHERE NOT EXISTS (SELECT 1 FROM usuarios_permissoes up WHERE up.usuario = ? AND up.permissao = a.id)',
        [id, id]
      );
    }
    console.log(`ok: ${u.nivel.padEnd(14)} ${u.email} (empresa ${emp})`);
  }

  console.log(`\nPronto. Senha de todos: ${SENHA}`);
  console.log('Agora o "Acesso rápido de teste" aparece na tela de login (após o deploy do código novo).');
}

main().then(() => process.exit(0)).catch((error) => { console.error('Erro:', error.message); process.exit(1); });
