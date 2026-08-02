-- Completa o cadastro dos 4 planos com o que faltava frente à tela do legado: os ITENS (bullets de
-- marketing exibidos por plano) e os LIMITES (clientes / usuários / dispositivos, mostrados na tela
-- de Assinatura). A estrutura já existia; faltava o dado. Idempotente: reescreve os itens dos 4
-- planos e atualiza os limites por nome.

-- 1) Limites por plano (exibição na tela de Assinatura). Enterprise usa números altos = "ilimitado".
UPDATE planos SET clientes = 500,   usuarios = 2,   dispositivos = 1  WHERE nome = 'Essencial';
UPDATE planos SET clientes = 2000,  usuarios = 5,   dispositivos = 3  WHERE nome = 'Profissional';
UPDATE planos SET clientes = 10000, usuarios = 15,  dispositivos = 10 WHERE nome = 'Avançado';
UPDATE planos SET clientes = 0,     usuarios = 0,   dispositivos = 0  WHERE nome = 'Enterprise'; -- 0 = ilimitado

-- 2) Itens (bullets) por plano — cada plano se descreve por completo, no espírito cumulativo.
DELETE FROM planos_itens
 WHERE plano IN (SELECT id FROM planos WHERE nome IN ('Essencial', 'Profissional', 'Avançado', 'Enterprise'));

INSERT INTO planos_itens (plano, nome)
SELECT (SELECT id FROM planos WHERE nome = 'Essencial' LIMIT 1), v.item
FROM (VALUES
  ('Vendas / PDV, produtos e estoque'),
  ('Financeiro: contas a pagar e receber'),
  ('Clientes e fornecedores'),
  ('Dashboard e relatórios'),
  ('Abertura de chamados'),
  ('Até 2 usuários')
) AS v(item);

INSERT INTO planos_itens (plano, nome)
SELECT (SELECT id FROM planos WHERE nome = 'Profissional' LIMIT 1), v.item
FROM (VALUES
  ('Tudo do Essencial'),
  ('Orçamentos e ordens de serviço'),
  ('Marketing e campanhas no WhatsApp'),
  ('Compras, cupons e comissões'),
  ('Até 5 usuários')
) AS v(item);

INSERT INTO planos_itens (plano, nome)
SELECT (SELECT id FROM planos WHERE nome = 'Avançado' LIMIT 1), v.item
FROM (VALUES
  ('Tudo do Profissional'),
  ('Emissão fiscal NF-e / NFS-e'),
  ('Contratos e cobranças recorrentes'),
  ('Portal do cliente e loja online'),
  ('Até 15 usuários')
) AS v(item);

INSERT INTO planos_itens (plano, nome)
SELECT (SELECT id FROM planos WHERE nome = 'Enterprise' LIMIT 1), v.item
FROM (VALUES
  ('Tudo do Avançado'),
  ('Recursos humanos e folha'),
  ('Trilha de auditoria'),
  ('Usuários ilimitados')
) AS v(item);
