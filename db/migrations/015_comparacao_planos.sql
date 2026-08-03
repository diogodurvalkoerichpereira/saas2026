-- Publica os planos de entrada e prepara a tabela de comparação da página pública.
--
-- 1) Micro e Fiscal entram na vitrine (foram criados inativos na migração 014).
-- 2) `recursos` ganha grupo e posição: 32 linhas soltas numa tabela de comparação não se lê. O
--    agrupamento é por PERGUNTA DO CLIENTE ("consigo vender?", "emito nota?"), não pela ordem em
--    que os módulos foram programados. Fica no banco, e não no HTML, porque é conteúdo que o
--    administrador deve poder reorganizar sem depender de deploy.

UPDATE planos SET ativo = 'Sim' WHERE nome IN ('Micro', 'Fiscal');

ALTER TABLE recursos ADD COLUMN IF NOT EXISTS grupo VARCHAR(40) NULL;
ALTER TABLE recursos ADD COLUMN IF NOT EXISTS posicao INT NULL;

UPDATE recursos SET grupo = v.grupo, posicao = v.posicao
  FROM (VALUES
    ('dashboard',             'Sempre incluído',    10),
    ('assinatura',            'Sempre incluído',    20),

    ('comercial',             'Vender',            110),
    ('vendas_pdv',            'Vender',            120),
    ('produtos_servicos',     'Vender',            130),
    ('orcamentos',            'Vender',            140),
    ('cupons',                'Vender',            150),
    ('comissoes',             'Vender',            160),

    ('clientes',              'Cadastros',         210),
    ('anotacoes',             'Cadastros',         220),
    ('fornecedores',          'Cadastros',         230),
    ('cadastros_auxiliares',  'Cadastros',         240),
    ('anexos',                'Cadastros',         250),

    ('financeiro',            'Dinheiro',          310),
    ('relatorios',            'Dinheiro',          320),
    ('cobrancas_recorrentes', 'Dinheiro',          330),

    ('fiscal',                'Nota fiscal',       410),

    ('estoque',               'Operação',          510),
    ('tarefas',               'Operação',          520),
    ('chamados',              'Operação',          530),
    ('compras',               'Operação',          540),
    ('ordens_servico',        'Operação',          550),

    ('site',                  'Crescimento',       610),
    ('marketing',             'Crescimento',       620),
    ('loja_online',           'Crescimento',       630),
    ('portal_cliente',        'Crescimento',       640),
    ('contratos',             'Crescimento',       650),

    ('configuracoes',         'Equipe e controle', 710),
    ('tutoriais',             'Equipe e controle', 720),
    ('usuarios',              'Equipe e controle', 730),
    ('recursos_humanos',      'Equipe e controle', 740),
    ('auditoria',             'Equipe e controle', 750)
  ) AS v(chave, grupo, posicao)
 WHERE recursos.chave = v.chave;

-- Recurso criado depois desta migração (ou que não esteja na lista) cai num grupo próprio, no fim
-- da tabela — aparece na comparação mesmo sem ninguém classificar, em vez de sumir em silêncio.
UPDATE recursos SET grupo = 'Outros recursos', posicao = 900 WHERE grupo IS NULL;
