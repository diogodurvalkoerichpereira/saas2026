-- Garante o catálogo COMPLETO de recursos (acessos) em qualquer instalação. O catálogo estava só
-- no seed de teste; uma produção que rodou apenas o schema ficava sem catálogo, e faltavam 4
-- recursos de relatório que o backend já exige (reports.routes.js). Idempotente: insere só o que
-- ainda não existe (por `chave`), sem id explícito (a identity atribui), então não colide com as
-- linhas já cadastradas. grupos: 1 pessoas, 2 produtos/estoque, 3 financeiro, 4 vendas, 5 RH,
-- 6 contratos, 7 tarefas, 8 marketing, 9 sistema.

INSERT INTO acessos (nome, chave, grupo)
SELECT v.nome, v.chave, v.grupo
FROM (VALUES
  ('Dashboard', 'home', 1),
  ('Clientes', 'clientes', 1),
  ('Usuários', 'usuarios', 1),
  ('Fornecedores', 'fornecedores', 1),
  ('Produtos', 'produtos', 2),
  ('Serviços', 'servicos', 2),
  ('Categorias', 'categorias', 2),
  ('Subcategorias', 'sub_categorias', 2),
  ('Marcas', 'marcas', 2),
  ('Equipamentos', 'equipamentos', 2),
  ('Modelos', 'modelos', 2),
  ('Cupons', 'cupom', 2),
  ('Compras', 'compras', 2),
  ('Entradas', 'entradas', 2),
  ('Saídas', 'saidas', 2),
  ('Estoque', 'estoque', 2),
  ('Financeiro', 'financeiro', 3),
  ('Formas de pagamento', 'formas_pgto', 3),
  ('Plano de contas', 'plano_contas', 3),
  ('Caixas', 'caixas', 3),
  ('Cobranças recorrentes', 'cobrancas', 3),
  ('Comissões', 'comissoes', 3),
  ('Minhas comissões', 'minhas_comissoes', 3),
  ('Contas a receber', 'receber', 3),
  ('Contas a pagar', 'pagar', 3),
  ('Ordens de Serviço', 'os', 4),
  ('Vendas', 'vendas', 4),
  ('Orçamentos', 'orcamentos', 4),
  ('Cargos', 'cargos', 5),
  ('Frequências', 'frequencias', 5),
  ('RH', 'rh', 5),
  ('Funcionários', 'funcionarios', 5),
  ('Modelos de contratos', 'modelos_contratos', 6),
  ('Contratos', 'listar_contratos', 6),
  ('Gerar contratos', 'rel_contratos', 6),
  ('Tarefas', 'tarefas', 7),
  ('Tarefas de clientes', 'tarefas_clientes', 7),
  ('Chamados', 'chamados', 7),
  ('Anotações', 'anotacoes', 7),
  ('Marketing', 'marketing', 8),
  ('Grupos de disparos', 'grupos_disparos', 8),
  ('Dispositivos', 'dispositivos', 8),
  ('Dados do site', 'site', 9),
  ('Configurações', 'configuracoes', 9),
  ('Relatório financeiro', 'rel_financeiro', 3),
  ('Relatório de vendas', 'rel_vendas', 4),
  ('Relatório de balanço', 'rel_balanco', 3),
  ('Relatório sintético de despesas', 'rel_sintetico_despesas', 3),
  ('Relatório sintético a receber', 'rel_sintetico_receber', 3),
  ('Relatório de produtos vendidos', 'rel_prod_vendidos', 4)
) AS v(nome, chave, grupo)
WHERE NOT EXISTS (SELECT 1 FROM acessos a WHERE a.chave = v.chave);
