-- Re-sincroniza clientes_recursos de TODAS as empresas com o plano atual delas.
--
-- Motivo: o provisionamento (núcleo + premium do plano) só roda ao criar/trocar o plano. Empresas
-- que já existiam antes da divisão de recursos — ou provisionadas quando o catálogo era outro —
-- ficaram com clientes_recursos dessincronizado do plano, e podiam acessar recursos fora da
-- assinatura. Esta migração reconstrói o vínculo de forma autoritativa: cada empresa passa a ter
-- exatamente o núcleo + os recursos premium do seu plano.
--
-- A lista de núcleo espelha src/config/features.js (CORE). Empresa sem plano fica só com o núcleo.

DELETE FROM clientes_recursos;

-- 1) Núcleo para toda empresa (id > 0). Sempre disponível, em qualquer plano.
INSERT INTO clientes_recursos (empresa, recurso)
SELECT e.id, r.id
  FROM empresas e
  CROSS JOIN recursos r
 WHERE e.id > 0
   AND r.chave IN (
     'dashboard', 'clientes', 'fornecedores', 'produtos_servicos', 'vendas_pdv', 'estoque',
     'financeiro', 'cadastros_auxiliares', 'usuarios', 'configuracoes', 'relatorios', 'anexos',
     'tarefas', 'anotacoes', 'assinatura', 'tutoriais', 'site', 'comercial'
   );

-- 2) Recursos premium do plano de cada empresa.
INSERT INTO clientes_recursos (empresa, recurso)
SELECT e.id, pr.recurso
  FROM empresas e
  JOIN planos_recursos pr ON pr.plano = e.plano
 WHERE e.id > 0;
