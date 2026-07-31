-- Executar uma única vez, depois de 001_node_frontend_operations.sql.
-- Não contém dados, credenciais nem chamadas a serviços externos.

ALTER TABLE cobrancas
  ADD COLUMN node_status VARCHAR(20) NOT NULL DEFAULT 'ativo';

CREATE TABLE node_marketing_dispatch (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campanha INT NOT NULL,
  cliente INT NOT NULL,
  nome VARCHAR(100) NULL,
  telefone VARCHAR(20) NOT NULL,
  mensagem TEXT NOT NULL,
  empresa INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  tentativas INT NOT NULL DEFAULT 0,
  agendado_para DATETIME NOT NULL,
  enviado_em DATETIME NULL,
  erro VARCHAR(500) NULL,
  consentimento_confirmado VARCHAR(5) NOT NULL,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  UNIQUE KEY uq_campaign_client_schedule (campanha, cliente, agendado_para),
  INDEX idx_marketing_due (empresa, status, agendado_para)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_purchases (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  fornecedor INT NOT NULL,
  usuario INT NOT NULL,
  forma_pgto INT NULL,
  data DATE NOT NULL,
  vencimento DATE NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  pago VARCHAR(5) NOT NULL,
  status VARCHAR(20) NOT NULL,
  observacoes VARCHAR(500) NULL,
  payable_id INT NULL,
  criado_em DATETIME NOT NULL,
  cancelado_em DATETIME NULL,
  cancelado_por INT NULL,
  motivo_cancelamento VARCHAR(255) NULL,
  INDEX idx_purchases_tenant_date (empresa, data),
  INDEX idx_purchases_payable (empresa, payable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_purchase_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  compra INT NOT NULL,
  produto INT NOT NULL,
  quantidade INT NOT NULL,
  valor_unitario DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  INDEX idx_purchase_items_purchase (compra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_contracts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  cliente INT NOT NULL,
  modelo_id INT NULL,
  titulo VARCHAR(150) NOT NULL,
  conteudo MEDIUMTEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  inicio DATE NULL,
  fim DATE NULL,
  valor DECIMAL(12,2) NULL,
  criado_por INT NOT NULL,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  INDEX idx_contracts_tenant_status (empresa, status),
  INDEX idx_contracts_client (empresa, cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_recurring_generated (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  cobranca INT NOT NULL,
  recebivel INT NOT NULL,
  vencimento DATE NOT NULL,
  criado_em DATETIME NOT NULL,
  UNIQUE KEY uq_recurring_due (empresa, cobranca, vencimento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  entidade VARCHAR(40) NOT NULL,
  entidade_id INT NOT NULL,
  nome_original VARCHAR(180) NOT NULL,
  nome_armazenado VARCHAR(80) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  tamanho INT NOT NULL,
  criado_por INT NOT NULL,
  criado_em DATETIME NOT NULL,
  INDEX idx_attachments_record (empresa, entidade, entidade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_contract_signatures (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  contrato INT NOT NULL,
  cliente INT NOT NULL,
  assinado_por VARCHAR(100) NOT NULL,
  user_agent VARCHAR(255) NULL,
  assinado_em DATETIME NOT NULL,
  UNIQUE KEY uq_contract_signature (empresa, contrato, cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_store_orders (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  cliente INT NOT NULL,
  recebivel INT NOT NULL,
  token_acompanhamento CHAR(36) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  desconto DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  cupom VARCHAR(50) NULL,
  status VARCHAR(30) NOT NULL,
  observacoes VARCHAR(500) NULL,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  UNIQUE KEY uq_store_tracking (token_acompanhamento),
  INDEX idx_store_company_date (empresa, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE node_store_order_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pedido INT NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  item_id INT NOT NULL,
  nome VARCHAR(100) NOT NULL,
  quantidade INT NOT NULL,
  valor_unitario DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  INDEX idx_store_items_order (pedido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
