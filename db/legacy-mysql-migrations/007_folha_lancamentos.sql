-- Executar uma única vez, depois de 006_usuarios_teste.sql.
-- Lançamentos manuais da folha (proventos e descontos) por funcionário e competência, para
-- ajustar o total estimado. Os valores são informados pelo operador; o sistema não calcula
-- encargos legais (INSS/FGTS/IRRF), que dependem de tabelas trabalhistas e validação contábil.

CREATE TABLE node_folha_lancamentos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  funcionario INT NOT NULL,
  competencia CHAR(7) NOT NULL,
  tipo VARCHAR(10) NOT NULL,
  descricao VARCHAR(120) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  criado_por INT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_folha_lanc (empresa, funcionario, competencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
