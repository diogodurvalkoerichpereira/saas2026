-- Redesenho: o núcleo forçado virou MÍNIMO (só dashboard + assinatura). Tudo mais é decidido pelo
-- plano. Para os 4 planos existentes continuarem funcionando, esta migração passa a incluir em cada
-- um a BASE operacional (clientes, vendas, financeiro, estoque, produtos, etc.) + os premium da
-- faixa. Assim, o que estava implícito no núcleo agora está explícito em planos_recursos — e um
-- plano novo que não marca nada realmente não libera nada além do dashboard/assinatura.

DELETE FROM planos_recursos
 WHERE plano IN (SELECT id FROM planos WHERE nome IN ('Essencial', 'Profissional', 'Avançado', 'Enterprise'));

-- Base operacional incluída em TODOS os 4 planos.
INSERT INTO planos_recursos (plano, recurso)
SELECT p.id, r.id
  FROM planos p
  CROSS JOIN recursos r
 WHERE p.nome IN ('Essencial', 'Profissional', 'Avançado', 'Enterprise')
   AND r.chave IN (
     'comercial', 'clientes', 'fornecedores', 'usuarios', 'produtos_servicos', 'cadastros_auxiliares',
     'estoque', 'vendas_pdv', 'financeiro', 'relatorios', 'site', 'configuracoes', 'tutoriais',
     'anexos', 'tarefas', 'anotacoes'
   );

-- Premium por faixa (cumulativo), somado à base.
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

-- Re-sincroniza as empresas com o plano atual (agora com a base explícita).
DELETE FROM clientes_recursos;
INSERT INTO clientes_recursos (empresa, recurso)
SELECT e.id, r.id FROM empresas e CROSS JOIN recursos r
 WHERE e.id > 0 AND r.chave IN ('dashboard', 'assinatura');
INSERT INTO clientes_recursos (empresa, recurso)
SELECT e.id, pr.recurso FROM empresas e JOIN planos_recursos pr ON pr.plano = e.plano WHERE e.id > 0;
