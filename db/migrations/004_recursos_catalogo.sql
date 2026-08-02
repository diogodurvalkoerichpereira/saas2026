-- Garante o catálogo COMPLETO de recursos (features do plano) em qualquer instalação. Como o
-- `acessos`, o `recursos` só existia no seed de teste; uma produção sem o seed ficava com a tabela
-- VAZIA, e a migração 003 (planos) criava planos_recursos vazio — o bloqueio de plano ficava inerte.
--
-- Esta migração roda DEPOIS da 003, então além de semear os recursos ela RECONSTRÓI a divisão de
-- recursos dos 4 planos (repete a lógica da 003 agora que os recursos existem). Idempotente:
-- insere só o recurso que falta (por chave) e reescreve os planos_recursos dos 4 planos.

-- 1) Catálogo de recursos (idempotente por chave; sem id explícito — a identity atribui).
INSERT INTO recursos (nome, chave)
SELECT v.nome, v.chave
FROM (VALUES
  ('Gestão comercial', 'comercial'),
  ('Financeiro', 'financeiro'),
  ('Marketing WhatsApp', 'marketing'),
  ('Dashboard', 'dashboard'),
  ('Clientes', 'clientes'),
  ('Fornecedores', 'fornecedores'),
  ('Usuários e permissões', 'usuarios'),
  ('Produtos e serviços', 'produtos_servicos'),
  ('Cadastros auxiliares', 'cadastros_auxiliares'),
  ('Estoque', 'estoque'),
  ('Compras', 'compras'),
  ('Vendas / PDV', 'vendas_pdv'),
  ('Cupons', 'cupons'),
  ('Orçamentos', 'orcamentos'),
  ('Ordens de serviço', 'ordens_servico'),
  ('Contratos', 'contratos'),
  ('Cobranças recorrentes', 'cobrancas_recorrentes'),
  ('Comissões', 'comissoes'),
  ('Recursos humanos', 'recursos_humanos'),
  ('Tarefas', 'tarefas'),
  ('Anotações', 'anotacoes'),
  ('Chamados', 'chamados'),
  ('Relatórios', 'relatorios'),
  ('Site institucional', 'site'),
  ('Assinatura', 'assinatura'),
  ('Configurações', 'configuracoes'),
  ('Tutoriais', 'tutoriais'),
  ('Emissão fiscal NFS-e/NF-e', 'fiscal'),
  ('Portal do cliente', 'portal_cliente'),
  ('Loja online', 'loja_online'),
  ('Anexos', 'anexos'),
  ('Auditoria', 'auditoria')
) AS v(nome, chave)
WHERE NOT EXISTS (SELECT 1 FROM recursos r WHERE r.chave = v.chave);

-- 2) Reconstrói a divisão de recursos premium dos 4 planos (idempotente).
DELETE FROM planos_recursos
 WHERE plano IN (SELECT id FROM planos WHERE nome IN ('Essencial', 'Profissional', 'Avançado', 'Enterprise'));

INSERT INTO planos_recursos (plano, recurso)
SELECT (SELECT id FROM planos WHERE nome = 'Essencial' LIMIT 1), r.id
  FROM recursos r WHERE r.chave IN ('chamados');

INSERT INTO planos_recursos (plano, recurso)
SELECT (SELECT id FROM planos WHERE nome = 'Profissional' LIMIT 1), r.id
  FROM recursos r WHERE r.chave IN (
    'chamados', 'comissoes', 'cupons', 'compras', 'marketing', 'orcamentos', 'ordens_servico'
  );

INSERT INTO planos_recursos (plano, recurso)
SELECT (SELECT id FROM planos WHERE nome = 'Avançado' LIMIT 1), r.id
  FROM recursos r WHERE r.chave IN (
    'chamados', 'comissoes', 'cupons', 'compras', 'marketing', 'orcamentos', 'ordens_servico',
    'cobrancas_recorrentes', 'contratos', 'fiscal', 'portal_cliente', 'loja_online'
  );

INSERT INTO planos_recursos (plano, recurso)
SELECT (SELECT id FROM planos WHERE nome = 'Enterprise' LIMIT 1), r.id
  FROM recursos r WHERE r.chave IN (
    'chamados', 'comissoes', 'cupons', 'compras', 'marketing', 'orcamentos', 'ordens_servico',
    'cobrancas_recorrentes', 'contratos', 'fiscal', 'portal_cliente', 'loja_online',
    'recursos_humanos', 'auditoria'
  );
