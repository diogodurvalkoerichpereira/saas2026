-- Cria os 4 planos com faixa de mercado e divide os recursos premium entre eles (ver
-- PLANOS_E_RECURSOS.md). O núcleo (dashboard, clientes, produtos, vendas, financeiro, estoque...)
-- é sempre liberado no provisionamento, então planos_recursos guarda só os recursos PREMIUM que
-- diferenciam os planos. Idempotente: cria plano por nome se faltar e reconstrói os planos_recursos
-- dos 4 planos por chave de recurso.

-- 1) Os 4 planos (idempotente por nome).
INSERT INTO planos (nome, valor, ativo)
SELECT v.nome, v.valor, 'Sim'
FROM (VALUES
  ('Essencial', 69.00),
  ('Profissional', 139.00),
  ('Avançado', 249.00),
  ('Enterprise', 449.00)
) AS v(nome, valor)
WHERE NOT EXISTS (SELECT 1 FROM planos p WHERE p.nome = v.nome);

-- 2) Zera os recursos desses 4 planos antes de recadastrar (mantém intactos outros planos).
DELETE FROM planos_recursos
 WHERE plano IN (SELECT id FROM planos WHERE nome IN ('Essencial', 'Profissional', 'Avançado', 'Enterprise'));

-- 3) Divisão cumulativa de recursos premium por plano.
--    Essencial
INSERT INTO planos_recursos (plano, recurso)
SELECT (SELECT id FROM planos WHERE nome = 'Essencial' LIMIT 1), r.id
  FROM recursos r WHERE r.chave IN ('chamados');

--    Profissional = Essencial + comercial premium
INSERT INTO planos_recursos (plano, recurso)
SELECT (SELECT id FROM planos WHERE nome = 'Profissional' LIMIT 1), r.id
  FROM recursos r WHERE r.chave IN (
    'chamados', 'comissoes', 'cupons', 'compras', 'marketing', 'orcamentos', 'ordens_servico'
  );

--    Avançado = Profissional + contratos/fiscal/canais
INSERT INTO planos_recursos (plano, recurso)
SELECT (SELECT id FROM planos WHERE nome = 'Avançado' LIMIT 1), r.id
  FROM recursos r WHERE r.chave IN (
    'chamados', 'comissoes', 'cupons', 'compras', 'marketing', 'orcamentos', 'ordens_servico',
    'cobrancas_recorrentes', 'contratos', 'fiscal', 'portal_cliente', 'loja_online'
  );

--    Enterprise = tudo
INSERT INTO planos_recursos (plano, recurso)
SELECT (SELECT id FROM planos WHERE nome = 'Enterprise' LIMIT 1), r.id
  FROM recursos r WHERE r.chave IN (
    'chamados', 'comissoes', 'cupons', 'compras', 'marketing', 'orcamentos', 'ordens_servico',
    'cobrancas_recorrentes', 'contratos', 'fiscal', 'portal_cliente', 'loja_online',
    'recursos_humanos', 'auditoria'
  );
