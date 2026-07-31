-- Executar uma única vez, depois de 008_financeiro_multa_juros.sql.
-- Controle de pagamento da comissão por item de venda (a comissão é calculada dinamicamente;
-- estas colunas registram quando/por quem foi marcada como paga).

ALTER TABLE itens_venda
  ADD COLUMN comissao_paga VARCHAR(5) NOT NULL DEFAULT 'Não',
  ADD COLUMN comissao_paga_em DATETIME NULL,
  ADD COLUMN comissao_paga_por INT NULL;
