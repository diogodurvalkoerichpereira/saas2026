-- Dois planos de entrada, para cobrir os dois buracos da escada de preços atual.
--
-- Buraco 1 — a porta de entrada é cara demais. A escada começava em R$ 69, enquanto a entrada do
-- mercado brasileiro em 2026 está entre R$ 30 e R$ 55 (Bling parte de R$ 55). Quem hoje controla a
-- loja em caderno ou planilha não começa em R$ 69; começa em algo que caiba no impulso.
--
-- Buraco 2 — emitir nota custava um salto de 261%. `fiscal` só existia no Avançado (R$ 249), então
-- quem estava no Essencial (R$ 69) e passou a precisar de NF-e tinha que quase quadruplicar a conta
-- ou trocar de fornecedor. É o momento exato em que se perde o cliente que está crescendo — e a
-- concorrência com emissão fiscal cobra entre R$ 189 e R$ 300.
--
-- Os dois planos entram INATIVOS. Quem publica na vitrine é o administrador, quando decidir.

INSERT INTO planos (nome, valor, ativo, clientes, usuarios, dispositivos)
SELECT 'Micro', 29.90, 'Não', 300, 1, 1
 WHERE NOT EXISTS (SELECT 1 FROM planos WHERE nome = 'Micro');

INSERT INTO planos (nome, valor, ativo, clientes, usuarios, dispositivos)
SELECT 'Fiscal', 99.90, 'Não', 1000, 3, 1
 WHERE NOT EXISTS (SELECT 1 FROM planos WHERE nome = 'Fiscal');

-- Micro: só o ciclo do dinheiro entrando. Vender, saber de quem, receber e enxergar o resultado.
-- Fica de fora tudo que pressupõe operação montada (estoque, fornecedores, compras, anexos,
-- chamados, tarefas, site) — é isso que dá motivo para subir para o Essencial.
INSERT INTO planos_recursos (plano, recurso)
SELECT p.id, r.id
  FROM planos p, recursos r
 WHERE p.nome = 'Micro'
   AND r.chave IN ('comercial', 'clientes', 'produtos_servicos', 'vendas_pdv', 'financeiro',
                   'relatorios', 'configuracoes', 'tutoriais', 'anotacoes')
   AND NOT EXISTS (SELECT 1 FROM planos_recursos x WHERE x.plano = p.id AND x.recurso = r.id);

-- Fiscal: exatamente o Essencial + emissão fiscal. A promessa é uma frase só — "o Essencial, com
-- nota fiscal" — e não uma lista nova para o cliente decifrar.
INSERT INTO planos_recursos (plano, recurso)
SELECT novo.id, r.id
  FROM planos novo, planos base, planos_recursos pr, recursos r
 WHERE novo.nome = 'Fiscal' AND base.nome = 'Essencial'
   AND pr.plano = base.id AND r.id = pr.recurso
   AND NOT EXISTS (SELECT 1 FROM planos_recursos x WHERE x.plano = novo.id AND x.recurso = r.id);

INSERT INTO planos_recursos (plano, recurso)
SELECT p.id, r.id
  FROM planos p, recursos r
 WHERE p.nome = 'Fiscal' AND r.chave = 'fiscal'
   AND NOT EXISTS (SELECT 1 FROM planos_recursos x WHERE x.plano = p.id AND x.recurso = r.id);

-- Emissão fiscal passa a existir também no Profissional (R$ 139).
--
-- Isto não é generosidade: sem isso a escada fica MENTIROSA. O upgrade lista os planos por valor,
-- então quem estivesse no Fiscal (R$ 99,90, com nota) veria o Profissional (R$ 139, sem nota) como
-- "upgrade" — pagaria mais caro para PERDER a emissão fiscal. Com o Profissional incluindo fiscal,
-- a capacidade só cresce conforme o preço sobe, em qualquer degrau da escada.
-- Ninguém perde nada: quem já assina o Profissional ganha o módulo.
INSERT INTO planos_recursos (plano, recurso)
SELECT p.id, r.id
  FROM planos p, recursos r
 WHERE p.nome = 'Profissional' AND r.chave = 'fiscal'
   AND NOT EXISTS (SELECT 1 FROM planos_recursos x WHERE x.plano = p.id AND x.recurso = r.id);

-- Características que aparecem com ✓ no card de cada plano na vitrine.
DELETE FROM planos_itens WHERE plano IN (SELECT id FROM planos WHERE nome IN ('Micro', 'Fiscal'));

INSERT INTO planos_itens (plano, nome)
SELECT p.id, v.texto
  FROM planos p, (VALUES
    ('Vendas e PDV com código de barras'),
    ('Cadastro de clientes e produtos'),
    ('Contas a receber e a pagar'),
    ('Relatórios de vendas e financeiro'),
    ('1 usuário · 300 clientes')
  ) AS v(texto)
 WHERE p.nome = 'Micro';

INSERT INTO planos_itens (plano, nome)
SELECT p.id, v.texto
  FROM planos p, (VALUES
    ('Tudo do Essencial'),
    ('Emissão de NF-e, NFC-e e NFS-e'),
    ('Estoque, fornecedores e anexos'),
    ('Chamados e tarefas'),
    ('3 usuários · 1.000 clientes')
  ) AS v(texto)
 WHERE p.nome = 'Fiscal';

-- O Profissional passa a anunciar a nota fiscal que acabou de ganhar.
INSERT INTO planos_itens (plano, nome)
SELECT p.id, 'Emissão de NF-e, NFC-e e NFS-e'
  FROM planos p
 WHERE p.nome = 'Profissional'
   AND NOT EXISTS (SELECT 1 FROM planos_itens i WHERE i.plano = p.id AND i.nome = 'Emissão de NF-e, NFC-e e NFS-e');

-- As empresas que já estão no Profissional precisam receber o módulo fiscal agora — o
-- provisionamento só roda quando o plano é atribuído ou editado pelo painel.
INSERT INTO clientes_recursos (empresa, recurso)
SELECT e.id, r.id
  FROM empresas e, planos p, recursos r
 WHERE e.id > 0 AND e.plano = p.id AND p.nome = 'Profissional' AND r.chave = 'fiscal'
   AND NOT EXISTS (SELECT 1 FROM clientes_recursos x WHERE x.empresa = e.id AND x.recurso = r.id);
