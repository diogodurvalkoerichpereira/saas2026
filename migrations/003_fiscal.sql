-- Executar uma única vez, depois de 002_legacy_parity.sql.
-- Fundação fiscal para emissão de NFS-e (Padrao Nacional / SEFIN Nacional) e NF-e (SEFAZ).
-- Nao contem dados, credenciais nem certificados. O certificado digital A1 e a sua senha
-- NUNCA ficam neste banco: o arquivo fica em storage protegido fora do repositorio e a
-- senha em variavel de ambiente ou cofre. Aqui guardamos apenas referencias.

-- 1. Emitente: campos fiscais que faltam em empresas.
ALTER TABLE empresas
  ADD COLUMN cnpj VARCHAR(18) NULL,
  ADD COLUMN razao_social VARCHAR(150) NULL,
  ADD COLUMN nome_fantasia VARCHAR(150) NULL,
  ADD COLUMN inscricao_estadual VARCHAR(20) NULL,
  ADD COLUMN inscricao_municipal VARCHAR(20) NULL,
  ADD COLUMN regime_tributario VARCHAR(30) NULL,
  ADD COLUMN cnae VARCHAR(10) NULL,
  ADD COLUMN codigo_ibge CHAR(7) NULL;

-- 2. Tomador/destinatario: campos fiscais que faltam em clientes.
ALTER TABLE clientes
  ADD COLUMN cnpj VARCHAR(18) NULL,
  ADD COLUMN inscricao_estadual VARCHAR(20) NULL,
  ADD COLUMN ind_ie_dest VARCHAR(1) NULL,
  ADD COLUMN codigo_ibge CHAR(7) NULL;

-- 3. Itens de venda: campos fiscais em produtos. A venda referencia produtos, entao a
--    classificacao fiscal (mercadoria ou servico) e os campos de cada caso ficam aqui.
--    tipo_fiscal = 'mercadoria' usa os campos de NF-e; 'servico' usa os campos de NFS-e.
ALTER TABLE produtos
  ADD COLUMN tipo_fiscal VARCHAR(12) NOT NULL DEFAULT 'mercadoria',
  ADD COLUMN ncm VARCHAR(8) NULL,
  ADD COLUMN cest VARCHAR(7) NULL,
  ADD COLUMN cfop VARCHAR(4) NULL,
  ADD COLUMN origem VARCHAR(1) NULL,
  ADD COLUMN cst_csosn VARCHAR(4) NULL,
  ADD COLUMN unidade_fiscal VARCHAR(6) NULL,
  ADD COLUMN aliq_icms DECIMAL(6,2) NULL,
  ADD COLUMN aliq_pis DECIMAL(6,2) NULL,
  ADD COLUMN aliq_cofins DECIMAL(6,2) NULL,
  ADD COLUMN codigo_lc116 VARCHAR(10) NULL,
  ADD COLUMN codigo_tributacao_municipio VARCHAR(20) NULL,
  ADD COLUMN aliquota_iss DECIMAL(6,2) NULL;

-- 4. Servico (NFS-e): campos fiscais em servicos.
ALTER TABLE servicos
  ADD COLUMN codigo_lc116 VARCHAR(10) NULL,
  ADD COLUMN codigo_tributacao_municipio VARCHAR(20) NULL,
  ADD COLUMN aliquota_iss DECIMAL(6,2) NULL,
  ADD COLUMN cnae VARCHAR(10) NULL,
  ADD COLUMN iss_retido VARCHAR(5) NOT NULL DEFAULT 'Nao';

-- 5. Configuracao fiscal por empresa (multi-tenant). Ambiente comeca em homologacao.
--    certificado_ref: caminho do arquivo do certificado em storage protegido (nunca o conteudo).
--    certificado_senha_ref: nome da variavel de ambiente/cofre que guarda a senha (nunca a senha).
CREATE TABLE node_fiscal_config (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  ambiente VARCHAR(15) NOT NULL DEFAULT 'homologacao',
  emite_nfse VARCHAR(5) NOT NULL DEFAULT 'Sim',
  emite_nfe VARCHAR(5) NOT NULL DEFAULT 'Nao',
  certificado_ref VARCHAR(255) NULL,
  certificado_senha_ref VARCHAR(100) NULL,
  certificado_validade DATE NULL,
  regime_especial VARCHAR(30) NULL,
  incentivo_fiscal VARCHAR(5) NOT NULL DEFAULT 'Nao',
  atualizado_por INT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fiscal_config_empresa (empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Controle de numeracao por empresa, modelo e serie.
CREATE TABLE node_fiscal_numeracao (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  modelo VARCHAR(10) NOT NULL,
  serie VARCHAR(5) NOT NULL DEFAULT '1',
  ultimo_numero INT NOT NULL DEFAULT 0,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fiscal_numeracao (empresa, modelo, serie)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Documentos fiscais emitidos ou em processamento.
--    referencia: uuid gerado na solicitacao, usado como chave de idempotencia da submissao.
--    chave_acesso: 44 posicoes na NF-e, ate 50 na NFS-e do Padrao Nacional.
--    xml_path/pdf_path: caminhos em storage protegido para o XML autorizado e o DANFE/DANFSE.
CREATE TABLE node_fiscal_documentos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  modelo VARCHAR(10) NOT NULL,
  venda INT NULL,
  cliente INT NULL,
  referencia CHAR(36) NOT NULL,
  numero INT NULL,
  serie VARCHAR(5) NULL,
  chave_acesso VARCHAR(50) NULL,
  protocolo VARCHAR(50) NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'pendente',
  ambiente VARCHAR(15) NOT NULL DEFAULT 'homologacao',
  valor_total DECIMAL(12,2) NULL,
  motivo_rejeicao VARCHAR(500) NULL,
  xml_path VARCHAR(255) NULL,
  pdf_path VARCHAR(255) NULL,
  tentativas INT NOT NULL DEFAULT 0,
  data_emissao DATETIME NULL,
  criado_por INT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fiscal_doc_referencia (empresa, referencia),
  UNIQUE KEY uq_fiscal_doc_chave (chave_acesso),
  INDEX idx_fiscal_doc_status (empresa, status),
  INDEX idx_fiscal_doc_venda (empresa, venda),
  INDEX idx_fiscal_doc_modelo (empresa, modelo, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Itens fiscais do documento, com os valores e tributos aplicados por item.
CREATE TABLE node_fiscal_documento_itens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  documento BIGINT UNSIGNED NOT NULL,
  descricao VARCHAR(180) NOT NULL,
  quantidade DECIMAL(12,4) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(12,2) NOT NULL,
  valor_total DECIMAL(12,2) NOT NULL,
  ncm_lc116 VARCHAR(10) NULL,
  cfop VARCHAR(4) NULL,
  cst_csosn VARCHAR(4) NULL,
  aliquota DECIMAL(6,2) NULL,
  tributo VARCHAR(10) NULL,
  INDEX idx_fiscal_item_documento (documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Eventos fiscais (cancelamento, correcao) com rastreio e auditoria.
CREATE TABLE node_fiscal_eventos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  documento BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'pendente',
  motivo VARCHAR(500) NULL,
  protocolo VARCHAR(50) NULL,
  xml_path VARCHAR(255) NULL,
  criado_por INT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fiscal_evento_documento (empresa, documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
