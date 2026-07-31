CREATE TABLE IF NOT EXISTS node_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  usuario INT NOT NULL,
  acao VARCHAR(40) NOT NULL,
  entidade VARCHAR(40) NOT NULL,
  entidade_id INT NOT NULL,
  motivo VARCHAR(255) NULL,
  detalhes JSON NULL,
  criado_em DATETIME NOT NULL,
  INDEX idx_node_audit_tenant (empresa, entidade, entidade_id),
  INDEX idx_node_audit_created (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE pagar
  ADD COLUMN node_status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  ADD COLUMN node_cancel_reason VARCHAR(255) NULL,
  ADD COLUMN node_cancelled_at DATETIME NULL,
  ADD COLUMN node_cancelled_by INT NULL;

ALTER TABLE receber
  ADD COLUMN node_status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  ADD COLUMN node_cancel_reason VARCHAR(255) NULL,
  ADD COLUMN node_cancelled_at DATETIME NULL,
  ADD COLUMN node_cancelled_by INT NULL;

ALTER TABLE fornecedores
  ADD COLUMN ativo VARCHAR(5) NOT NULL DEFAULT 'Sim';
