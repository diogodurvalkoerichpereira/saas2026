-- Executar uma única vez, depois de 003_fiscal.sql.
-- Guarda a senha do certificado cifrada no banco (AES-256-GCM, chave fora do banco) e o nome
-- original do arquivo. O conteúdo do certificado continua fora do repositório, em storage
-- protegido. Nada de senha em texto.

ALTER TABLE node_fiscal_config
  ADD COLUMN certificado_senha_cifrada TEXT NULL,
  ADD COLUMN certificado_nome VARCHAR(180) NULL;
