-- Conteúdo da landing de planos, editável pelo administrador do SaaS (empresa 0).
--
-- No legado, a página de planos (index.php) não tinha texto fixo: tudo vinha da tabela `site` da
-- empresa 0, mais `recursos_site` (cards de recurso) e `perguntas_site` (FAQ), editados em
-- sas/paginas/site.php. A versão Node tinha a landing com o texto cravado no HTML — mudar a
-- chamada, um selo ou uma pergunta exigia deploy. Esta migração devolve o controle ao painel.
--
-- Colunas que faltavam em `site` (existiam no legado e alimentam a landing):
--   item1/2/3            selos de confiança abaixo da chamada
--   logo, logo_topo      logo e a opção de exibi-la
--   fundo_topo(_mobile)  imagem de fundo do bloco de topo

ALTER TABLE site ADD COLUMN IF NOT EXISTS item1 VARCHAR(100) NULL;
ALTER TABLE site ADD COLUMN IF NOT EXISTS item2 VARCHAR(100) NULL;
ALTER TABLE site ADD COLUMN IF NOT EXISTS item3 VARCHAR(100) NULL;
ALTER TABLE site ADD COLUMN IF NOT EXISTS logo VARCHAR(100) NULL;
ALTER TABLE site ADD COLUMN IF NOT EXISTS logo_topo VARCHAR(5) NULL;
ALTER TABLE site ADD COLUMN IF NOT EXISTS fundo_topo VARCHAR(100) NULL;
ALTER TABLE site ADD COLUMN IF NOT EXISTS fundo_topo_mobile VARCHAR(100) NULL;

-- Uma linha por empresa: a landing do SaaS é a da empresa 0. O índice único deixa o UPSERT do
-- painel (ON CONFLICT) resolver sozinho o "cria na primeira vez, atualiza depois".
DELETE FROM site a USING site b WHERE a.empresa = b.empresa AND a.id > b.id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_site_empresa ON site (empresa);

-- Conteúdo inicial: exatamente o texto que estava cravado em planos.html, para que a landing
-- continue idêntica depois do deploy — só que agora editável.
INSERT INTO site (empresa, titulo, subtitulo, botao1, botao2, botao3, item1, item2, item3,
                  titulo_recursos, titulo_perguntas, titulo_rodape, descricao_rodape, botao_rodape,
                  link_rodape, logo_topo)
VALUES (0,
        'Escolha o plano ideal para o seu negócio',
        'ERP completo — vendas, financeiro, estoque e muito mais. Comece com 14 dias grátis, sem cartão. Cancele quando quiser.',
        'Ver planos', 'Tirar dúvidas', 'Acessar sistema',
        '14 dias grátis', 'Sem fidelidade', 'Dados protegidos (LGPD)',
        'Tudo que você precisa para gerir', 'Perguntas frequentes',
        'Pronto para começar?',
        'Crie sua conta em menos de um minuto e teste o sistema completo por 14 dias, sem cartão de crédito.',
        'Começar agora', '#plans', 'Sim')
ON CONFLICT (empresa) DO NOTHING;

-- A empresa 0 (o próprio SaaS) precisa da sua linha de `config`: é dela que saem o nome do sistema,
-- o telefone do WhatsApp e a meta descrição da landing. O legado criava esta linha sozinho na
-- primeira execução (conexao.php); aqui ela nunca era criada e a marca ficava presa no HTML.
INSERT INTO config (empresa, nome, meta_descricao, pagina_entrada)
SELECT 0, 'SaaS 2026', 'ERP completo: vendas, financeiro, estoque, fiscal e mais. Comece com 14 dias grátis.', 'Login'
 WHERE NOT EXISTS (SELECT 1 FROM config WHERE empresa = 0);

-- Cards de recurso e perguntas iniciais da landing. Só entram se a empresa 0 ainda não tiver
-- nenhum — assim rodar a migração de novo nunca duplica nem sobrescreve o que o admin editou.
INSERT INTO recursos_site (empresa, posicao_recurso, titulo_recurso, icone_recurso, descricao_recurso)
SELECT 0, v.pos, v.titulo, v.icone, v.descricao
  FROM (VALUES
    (1, 'Vendas e PDV', 'cart', 'Frente de caixa com leitura de código de barras, formas de pagamento e recibo.'),
    (2, 'Financeiro', 'wallet', 'Contas a pagar e a receber, fluxo de caixa e cobrança recorrente.'),
    (3, 'Estoque', 'inventory', 'Entradas, saídas e saldo em tempo real, com alerta de mínimo.'),
    (4, 'Clientes e fornecedores', 'clients', 'Cadastro completo, histórico de compras e portal do cliente.'),
    (5, 'Relatórios', 'file-text', 'Vendas, financeiro e estoque com filtro por período.'),
    (6, 'Equipe e permissões', 'user', 'Perfis de acesso por usuário, com permissão tela a tela.')
  ) AS v(pos, titulo, icone, descricao)
 WHERE NOT EXISTS (SELECT 1 FROM recursos_site WHERE empresa = 0);

INSERT INTO perguntas_site (empresa, posicao_pergunta, titulo_pergunta, descricao_pergunta)
SELECT 0, v.pos, v.titulo, v.descricao
  FROM (VALUES
    (1, 'Preciso de cartão de crédito para testar?',
        'Não. O teste de 14 dias começa assim que você cria a conta, sem informar cartão. A cobrança só existe se você decidir continuar.'),
    (2, 'Posso trocar de plano depois?',
        'Pode, a qualquer momento, pela própria tela de Assinatura dentro do sistema. Na subida cobramos apenas a diferença proporcional aos dias restantes; na descida a troca vale a partir da próxima renovação, sem cobrança extra.'),
    (3, 'O que acontece com meus dados se eu cancelar?',
        'Seus dados continuam guardados e disponíveis para exportação. Não apagamos nada automaticamente ao cancelar.'),
    (4, 'Tem fidelidade ou multa?',
        'Não. A assinatura é mensal e pode ser cancelada quando você quiser, sem multa.')
  ) AS v(pos, titulo, descricao)
 WHERE NOT EXISTS (SELECT 1 FROM perguntas_site WHERE empresa = 0);
