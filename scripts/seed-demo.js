'use strict';

// Popula o banco com 10 empresas-cliente distribuídas pelos planos, cada uma com os usuários e as
// permissões coerentes com o que o plano dela libera.
//
// Por que script e não SQL: as permissões de cada empresa dependem dos RECURSOS do plano, e os
// recursos são provisionados pelo mesmo `provisionCompanyResources` que o painel usa. Escrevendo
// isso em SQL solto, o seed viraria uma segunda implementação da regra e sairia do ar na primeira
// vez que a regra mudasse. Aqui ele chama o código de verdade.
//
// A empresa 1 ("Empresa de Teste") NÃO é recriada: é a fixture de que a suíte de testes depende
// (usuários por perfil, produtos, clientes, formas de pagamento). Ela conta como uma das 10.
//
// Uso: node scripts/seed-demo.js        (idempotente — não duplica se já existir)
//      node scripts/seed-demo.js --limpar  (apaga as empresas de demonstração antes)

const { pool } = require('../src/config/database');
const { provisionCompanyResources } = require('../src/services/plan-provisioning');
const { TRIAL_DAYS } = require('../src/config/trial');

// Mesma senha das fixtures de teste: Teste@2026. Hash fixo para o seed não depender de bcrypt aqui.
const SENHA_HASH = '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu';
const SENHA_CLARA = 'Teste@2026';

// Recurso do plano → permissões de tela que fazem sentido com ele. Dar a um cliente do Micro a
// permissão de "ordens de serviço" seria incoerente: o backend bloquearia pelo plano de qualquer
// forma, e o usuário veria uma permissão que não leva a lugar nenhum.
const PERMISSOES_POR_RECURSO = {
  comercial: ['home'],
  clientes: ['clientes'],
  produtos_servicos: ['produtos', 'servicos'],
  vendas_pdv: ['vendas', 'caixas'],
  financeiro: ['financeiro', 'receber', 'pagar', 'plano_contas', 'formas_pgto'],
  relatorios: ['rel_financeiro', 'rel_vendas', 'rel_prod_vendidos', 'rel_sintetico_receber'],
  configuracoes: ['configuracoes'],
  anotacoes: ['anotacoes'],
  estoque: ['estoque', 'entradas', 'saidas'],
  fornecedores: ['fornecedores'],
  cadastros_auxiliares: ['categorias', 'sub_categorias', 'marcas', 'modelos', 'equipamentos', 'frequencias', 'cargos'],
  chamados: ['chamados'],
  tarefas: ['tarefas', 'tarefas_clientes'],
  site: ['site'],
  usuarios: ['usuarios'],
  ordens_servico: ['os'],
  orcamentos: ['orcamentos'],
  compras: ['compras'],
  cupons: ['cupom'],
  comissoes: ['comissoes', 'minhas_comissoes'],
  marketing: ['marketing', 'grupos_disparos', 'dispositivos'],
  contratos: ['modelos_contratos', 'listar_contratos', 'rel_contratos'],
  cobrancas_recorrentes: ['cobrancas'],
  recursos_humanos: ['rh', 'funcionarios']
};

// O que cada perfil pode receber, dentro do que o plano já libera. O Administrador leva tudo do
// plano; os demais são recortes por função — é isso que faz a tela de um Comum ser diferente da
// de um Gerente na mesma empresa.
const PERFIS = {
  Administrador: null, // null = tudo que o plano permitir
  Gerente: ['home', 'clientes', 'produtos', 'servicos', 'vendas', 'caixas', 'estoque', 'entradas', 'saidas',
    'financeiro', 'receber', 'pagar', 'fornecedores', 'compras', 'orcamentos', 'os', 'chamados', 'tarefas',
    'rel_financeiro', 'rel_vendas', 'rel_prod_vendidos', 'comissoes', 'marketing'],
  Comum: ['home', 'clientes', 'produtos', 'vendas', 'caixas', 'orcamentos', 'tarefas', 'anotacoes'],
  Financeiro: ['home', 'financeiro', 'receber', 'pagar', 'plano_contas', 'formas_pgto', 'clientes',
    'rel_financeiro', 'rel_sintetico_receber', 'cobrancas'],
  Técnico: ['home', 'os', 'chamados', 'clientes', 'produtos', 'estoque', 'tarefas', 'equipamentos', 'modelos']
};

// As 9 empresas de demonstração (a décima é a "Empresa de Teste", que já existe). A distribuição
// pelos planos é proposital: dois na porta de entrada, dois no Essencial, dois no Fiscal e um em
// cada faixa acima — o desenho de carteira que a página de planos assume.
const EMPRESAS = [
  { nome: 'Mercearia Bom Preço', plano: 'Micro', cidade: 'Blumenau', estado: 'SC', slug: 'mercearia',
    equipe: [['Roberto Lima', 'Administrador']] },
  { nome: 'Papelaria Escreve Bem', plano: 'Micro', cidade: 'Joinville', estado: 'SC', slug: 'papelaria',
    equipe: [['Sandra Rocha', 'Administrador']] },
  { nome: 'Pet Shop Amigo Fiel', plano: 'Essencial', cidade: 'Itajaí', estado: 'SC', slug: 'petshop',
    equipe: [['Carla Menezes', 'Administrador'], ['Bruno Alves', 'Comum']] },
  { nome: 'Studio Bella Estética', plano: 'Essencial', cidade: 'Florianópolis', estado: 'SC', slug: 'studiobella',
    equipe: [['Isabela Ferraz', 'Administrador'], ['Paula Dias', 'Comum']] },
  { nome: 'Contabilidade Nunes', plano: 'Fiscal', cidade: 'Blumenau', estado: 'SC', slug: 'contnunes',
    equipe: [['Marcelo Nunes', 'Administrador'], ['Renata Alves', 'Financeiro']] },
  { nome: 'Clínica Vida Saudável', plano: 'Fiscal', cidade: 'Curitiba', estado: 'PR', slug: 'clinicavida',
    equipe: [['Helena Prado', 'Administrador'], ['Tiago Moraes', 'Comum']] },
  { nome: 'TecCell Assistência', plano: 'Profissional', cidade: 'Joinville', estado: 'SC', slug: 'teccell',
    equipe: [['Fernando Souza', 'Administrador'], ['Lucas Pereira', 'Técnico'], ['Aline Costa', 'Financeiro']] },
  { nome: 'Móveis Planejados Kasa', plano: 'Avançado', cidade: 'São José', estado: 'SC', slug: 'kasa',
    equipe: [['Gustavo Farias', 'Administrador'], ['Débora Lins', 'Gerente'], ['Rafael Muniz', 'Comum']] },
  { nome: 'Distribuidora Sul Alimentos', plano: 'Enterprise', cidade: 'Chapecó', estado: 'SC', slug: 'distsul',
    equipe: [['Antonio Bertoldi', 'Administrador'], ['Juliana Reis', 'Gerente'], ['Marcos Vieira', 'Financeiro'], ['Priscila Amaral', 'Comum']] }
];

async function main() {
  const limpar = process.argv.includes('--limpar');
  const [planos] = await pool.execute('SELECT id, nome, valor FROM planos');
  const planoPorNome = new Map(planos.map((p) => [p.nome, p]));
  const [acessos] = await pool.execute('SELECT id, chave FROM acessos');
  const acessoPorChave = new Map(acessos.map((a) => [a.chave, a.id]));
  const [recursos] = await pool.execute('SELECT id, chave FROM recursos');
  const recursoPorId = new Map(recursos.map((r) => [r.id, r.chave]));

  if (limpar) {
    const [alvo] = await pool.query('SELECT id FROM empresas WHERE id > 1');
    for (const { id } of alvo) {
      for (const tabela of ['usuarios_permissoes']) {
        await pool.execute(`DELETE FROM ${tabela} WHERE usuario IN (SELECT id FROM usuarios WHERE empresa = ?)`, [id]);
      }
      for (const tabela of ['clientes_recursos', 'usuarios', 'config', 'clientes', 'site']) {
        await pool.execute(`DELETE FROM ${tabela} WHERE empresa = ?`, [id]);
      }
      await pool.execute('DELETE FROM receber_sas WHERE cliente = ?', [id]);
      await pool.execute('DELETE FROM empresas WHERE id = ?', [id]);
    }
    console.log(`limpeza: ${alvo.length} empresa(s) de demonstração removida(s)`);
  }

  // A empresa 1 (fixture da suíte) nasce em `db/002-seed-test.sql` apontando para o "Plano
  // Demonstração", que as migrações desativaram e que não tem recurso nenhum vinculado. Num banco
  // recriado do zero isso deixa a empresa sem acesso a nada e derruba a suíte inteira com 403 —
  // antes só passava porque rodadas anteriores tinham deixado a empresa no Enterprise. Aqui ela
  // recebe o Enterprise e os recursos correspondentes, que é o estado que os testes assumem.
  const enterprise = planoPorNome.get('Enterprise');
  if (enterprise) {
    await pool.execute('UPDATE empresas SET plano = ?, mensalidade = ? WHERE id = 1', [enterprise.id, enterprise.valor]);
    await provisionCompanyResources({ companyId: 1, planId: enterprise.id, db: pool });
    const [base] = await pool.execute('SELECT COUNT(*) AS total FROM clientes_recursos WHERE empresa = 1');
    console.log(`empresa 1 (fixture) → Enterprise, ${base[0].total} recursos`);
  }

  const resumo = [];
  for (const dados of EMPRESAS) {
    const plano = planoPorNome.get(dados.plano);
    if (!plano) throw new Error(`plano "${dados.plano}" não existe — rode as migrações antes`);

    const [existente] = await pool.execute('SELECT id FROM empresas WHERE nome = ? LIMIT 1', [dados.nome]);
    if (existente[0]) { console.log(`· ${dados.nome} já existe (id ${existente[0].id}), pulando`); continue; }

    const email = `contato@${dados.slug}.local`;
    const [emp] = await pool.execute(
      `INSERT INTO empresas (nome, email, telefone, cidade, estado, tipo_pessoa, data_cad, dias_teste,
                             mensalidade, ativo, data_teste, plano, frequencia, dispositivos, url_site)
       VALUES (?, ?, ?, ?, ?, 'Jurídica', CURRENT_DATE, ?, ?, 'Sim', CURRENT_DATE + ?::int, ?, 30, 1, ?)`,
      [dados.nome, email, `(47) 3${String(Math.floor(Math.random() * 9e6) + 1e6)}`, dados.cidade, dados.estado,
       TRIAL_DAYS, plano.valor, TRIAL_DAYS, plano.id, `${dados.slug}-loja`]
    );
    const empresaId = emp.insertId;

    // Recursos do plano — pelo mesmo caminho que o painel usa ao atribuir um plano.
    await provisionCompanyResources({ companyId: empresaId, planId: plano.id, db: pool });
    const [liberados] = await pool.execute('SELECT recurso FROM clientes_recursos WHERE empresa = ?', [empresaId]);
    const chavesDoPlano = new Set(liberados.map((r) => recursoPorId.get(r.recurso)).filter(Boolean));

    // Permissões possíveis nesta empresa = só as que correspondem a recurso que o plano liberou.
    const permitidasNoPlano = new Set();
    for (const chave of chavesDoPlano) {
      for (const permissao of PERMISSOES_POR_RECURSO[chave] || []) permitidasNoPlano.add(permissao);
    }

    const usuarios = [];
    for (const [nome, perfil] of dados.equipe) {
      const primeiro = nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const emailUsuario = `${primeiro}@${dados.slug}.local`;
      const [usr] = await pool.execute(
        `INSERT INTO usuarios (nome, email, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa)
         VALUES (?, ?, ?, ?, 'Sim', ?, CURRENT_DATE, 'Sim', 'Sim', ?)`,
        [nome, emailUsuario, SENHA_HASH, perfil, '(47) 90000-0000', empresaId]
      );
      const usuarioId = usr.insertId;

      const doPerfil = PERFIS[perfil];
      const concedidas = [...permitidasNoPlano].filter((chave) => doPerfil === null || doPerfil.includes(chave));
      for (const chave of concedidas) {
        const acessoId = acessoPorChave.get(chave);
        if (acessoId) await pool.execute('INSERT INTO usuarios_permissoes (usuario, permissao) VALUES (?, ?)', [usuarioId, acessoId]);
      }
      usuarios.push({ nome, perfil, email: emailUsuario, permissoes: concedidas.length });
    }

    await pool.execute('INSERT INTO config (empresa, nome, email, url_site, pagina_entrada) VALUES (?, ?, ?, ?, ?)',
      [empresaId, dados.nome, email, `${dados.slug}-loja`, 'Login']);

    // Primeira mensalidade em aberto, vencendo no fim do teste — igual à assinatura pública.
    await pool.execute(
      `INSERT INTO receber_sas (descricao, cliente, valor, subtotal, vencimento, data_lanc, referencia, pago, empresa)
       VALUES ('Mensalidade SAAS', ?, ?, ?, CURRENT_DATE + ?::int, CURRENT_DATE, 'Mensalidade', 'Não', 0)`,
      [empresaId, plano.valor, plano.valor, TRIAL_DAYS]
    );

    resumo.push({ id: empresaId, empresa: dados.nome, plano: dados.plano, recursos: chavesDoPlano.size, usuarios });
  }

  console.log('');
  for (const r of resumo) {
    console.log(`${String(r.id).padStart(3)}  ${r.empresa.padEnd(30)} ${r.plano.padEnd(13)} ${String(r.recursos).padStart(2)} recursos`);
    for (const u of r.usuarios) console.log(`     ${u.email.padEnd(34)} ${u.perfil.padEnd(14)} ${String(u.permissoes).padStart(2)} permissões`);
  }
  console.log(`\nSenha de todos os usuários de demonstração: ${SENHA_CLARA}`);
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
