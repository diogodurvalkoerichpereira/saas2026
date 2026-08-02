'use strict';

// Cria (ou promove) um usuário Administrador, com a mesma cifra de senha do sistema (bcrypt custo 12).
// Feito para rodar tanto local quanto na VPS (usa as mesmas variáveis DATABASE_* da aplicação),
// para você criar o seu login e parar de usar os usuários de teste do seed.
//
// Uso (a SENHA é digitada por você, nunca fica no código):
//   ADMIN_EMAIL=voce@dominio.com ADMIN_SENHA='SuaSenhaForte' ADMIN_NOME='Seu Nome' node scripts/criar-admin.js
//
// Variáveis:
//   ADMIN_EMAIL   (obrigatória)  e-mail de login
//   ADMIN_SENHA   (obrigatória)  senha, mínimo 8 caracteres (igual à regra do sistema)
//   ADMIN_NOME    (opcional)     nome exibido; padrão "Administrador"
//   ADMIN_EMPRESA (opcional)     id da empresa; padrão = a primeira empresa existente
//
// Se o e-mail já existir, o script apenas redefine a senha, garante o nível Administrador e reativa.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA || '';
  const nome = (process.env.ADMIN_NOME || 'Administrador').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Informe um ADMIN_EMAIL válido.');
  }
  if (senha.length < 8 || senha.length > 72) {
    throw new Error('ADMIN_SENHA precisa ter entre 8 e 72 caracteres.');
  }

  // Empresa: usa a informada, senão a primeira que existir (numa instalação de empresa única, é a 1).
  let empresa = Number(process.env.ADMIN_EMPRESA);
  if (!Number.isInteger(empresa) || empresa <= 0) {
    const [rows] = await pool.execute('SELECT id FROM empresas ORDER BY id LIMIT 1');
    if (!rows[0]) throw new Error('Nenhuma empresa cadastrada. Defina ADMIN_EMPRESA com o id da empresa.');
    empresa = rows[0].id;
  }

  const hash = await bcrypt.hash(senha, 12);
  const [existing] = await pool.execute('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email]);

  let id;
  if (existing[0]) {
    id = existing[0].id;
    await pool.execute(
      "UPDATE usuarios SET senha = NULL, senha_crip = ?, nivel = 'Administrador', ativo = 'Sim', acessar_painel = 'Sim' WHERE id = ?",
      [hash, id]
    );
    console.log(`Usuário já existia (id ${id}) — senha redefinida e promovido a Administrador.`);
  } else {
    const [result] = await pool.execute(
      `INSERT INTO usuarios
        (nome, email, senha, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa)
       VALUES (?, ?, NULL, ?, 'Administrador', 'Sim', '', CURRENT_DATE, 'Sim', 'Sim', ?)`,
      [nome, email, hash, empresa]
    );
    id = result.insertId;
    console.log(`Administrador criado (id ${id}) na empresa ${empresa}.`);
  }

  // Concede todas as permissões (o Administrador já ignora a checagem, mas mantém o cadastro coerente).
  await pool.execute(
    'INSERT INTO usuarios_permissoes (usuario, permissao) SELECT ?, a.id FROM acessos a WHERE NOT EXISTS (SELECT 1 FROM usuarios_permissoes up WHERE up.usuario = ? AND up.permissao = a.id)',
    [id, id]
  );

  console.log(`Pronto. Entre com:\n  e-mail: ${email}\n  senha:  (a que você definiu em ADMIN_SENHA)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error('Erro:', error.message); process.exit(1); });
