-- Tira o "Plano Demonstração" da vitrine pública (a listagem pública mostra só planos ativos).
-- Continua no banco para não quebrar empresas que porventura o referenciem — só deixa de ser
-- ofertado e some da página de planos.
UPDATE planos SET ativo = 'Não' WHERE nome = 'Plano Demonstração';
