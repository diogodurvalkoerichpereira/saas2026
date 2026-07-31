-- Executar uma única vez, depois de 004_fiscal_certificado.sql.
-- Adiciona à tabela `config` as colunas que o código de Configurações já usa mas que não
-- existiam no banco (a guia Configurações retornava 500), e a URL da API de WhatsApp por
-- empresa. As colunas token_whatsapp e instancia_whatsapp já existem.

ALTER TABLE config
  ADD COLUMN multa_atraso DECIMAL(8,2) NULL,
  ADD COLUMN juros_atraso DECIMAL(8,2) NULL,
  ADD COLUMN dias_lembrete INT NULL,
  ADD COLUMN mao_obra_orc VARCHAR(100) NULL,
  ADD COLUMN senha_aparelho_orc VARCHAR(100) NULL,
  ADD COLUMN defeito_orc VARCHAR(100) NULL,
  ADD COLUMN avarias_orc VARCHAR(100) NULL,
  ADD COLUMN acessorios_orc VARCHAR(100) NULL,
  ADD COLUMN laudo_orc VARCHAR(100) NULL,
  ADD COLUMN mao_obra_os VARCHAR(100) NULL,
  ADD COLUMN senha_aparelho_os VARCHAR(100) NULL,
  ADD COLUMN defeito_os VARCHAR(100) NULL,
  ADD COLUMN avarias_os VARCHAR(100) NULL,
  ADD COLUMN acessorios_os VARCHAR(100) NULL,
  ADD COLUMN laudo_os VARCHAR(100) NULL,
  ADD COLUMN api_whatsapp VARCHAR(60) NULL;
