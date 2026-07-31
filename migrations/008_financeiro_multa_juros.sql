-- Executar uma única vez, depois de 007_folha_lancamentos.sql.
-- Adiciona a receber/pagar (e às tabelas espelho _sas) as colunas multa, juros, desconto e
-- taxa, que existem no legado e que a baixa de contas (settleEntry) já grava. Sem elas, dar
-- baixa em qualquer conta retornava erro (Unknown column 'multa').

ALTER TABLE receber
  ADD COLUMN multa DECIMAL(10,2) NULL,
  ADD COLUMN juros DECIMAL(10,2) NULL,
  ADD COLUMN desconto DECIMAL(10,2) NULL,
  ADD COLUMN taxa DECIMAL(10,2) NULL;
ALTER TABLE pagar
  ADD COLUMN multa DECIMAL(10,2) NULL,
  ADD COLUMN juros DECIMAL(10,2) NULL,
  ADD COLUMN desconto DECIMAL(10,2) NULL,
  ADD COLUMN taxa DECIMAL(10,2) NULL;
ALTER TABLE receber_sas
  ADD COLUMN multa DECIMAL(10,2) NULL,
  ADD COLUMN juros DECIMAL(10,2) NULL,
  ADD COLUMN desconto DECIMAL(10,2) NULL,
  ADD COLUMN taxa DECIMAL(10,2) NULL;
ALTER TABLE pagar_sas
  ADD COLUMN multa DECIMAL(10,2) NULL,
  ADD COLUMN juros DECIMAL(10,2) NULL,
  ADD COLUMN desconto DECIMAL(10,2) NULL,
  ADD COLUMN taxa DECIMAL(10,2) NULL;
