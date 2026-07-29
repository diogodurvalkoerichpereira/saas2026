SET NAMES utf8mb4;

CREATE TABLE empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  ativo VARCHAR(5) NOT NULL,
  data_teste DATE NULL
);

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  email VARCHAR(50) NOT NULL,
  senha VARCHAR(50) NULL,
  senha_crip VARCHAR(130) NOT NULL,
  nivel VARCHAR(25) NOT NULL,
  ativo VARCHAR(5) NOT NULL,
  telefone VARCHAR(20) NULL,
  endereco VARCHAR(150) NULL,
  foto VARCHAR(100) NULL,
  data DATE NOT NULL,
  data_nasc DATE NULL,
  numero VARCHAR(10) NULL,
  bairro VARCHAR(50) NULL,
  cidade VARCHAR(50) NULL,
  estado VARCHAR(50) NULL,
  cep VARCHAR(20) NULL,
  acessar_painel VARCHAR(5) NULL,
  cpf VARCHAR(20) NULL,
  mostrar_registros VARCHAR(5) NULL,
  complemento VARCHAR(100) NULL,
  empresa INT NULL
);

CREATE TABLE acessos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  chave VARCHAR(50) NOT NULL,
  grupo INT NOT NULL,
  pagina VARCHAR(5) NULL
);
CREATE TABLE usuarios_permissoes (id INT AUTO_INCREMENT PRIMARY KEY, usuario INT NOT NULL, permissao INT NOT NULL);
CREATE TABLE usuarios_permissoes_sas LIKE usuarios_permissoes;

CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  cpf VARCHAR(25) NULL,
  telefone VARCHAR(20) NULL,
  email VARCHAR(50) NULL,
  endereco VARCHAR(100) NULL,
  numero VARCHAR(10) NULL,
  bairro VARCHAR(50) NULL,
  cidade VARCHAR(50) NULL,
  estado VARCHAR(50) NULL,
  cep VARCHAR(20) NULL,
  tipo_pessoa VARCHAR(15) NULL,
  data_cad DATE NOT NULL,
  data_nasc DATE NULL,
  usuario INT NULL,
  complemento VARCHAR(100) NULL,
  empresa INT NULL,
  marketing VARCHAR(5) NULL,
  ativo VARCHAR(5) NULL
);

CREATE TABLE fornecedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  telefone VARCHAR(50) NOT NULL,
  email VARCHAR(50) NULL,
  endereco VARCHAR(100) NULL,
  pix VARCHAR(50) NULL,
  data DATE NOT NULL,
  numero VARCHAR(10) NULL,
  bairro VARCHAR(50) NULL,
  cidade VARCHAR(50) NULL,
  estado VARCHAR(50) NULL,
  cep VARCHAR(20) NULL,
  cnpj VARCHAR(20) NULL,
  complemento VARCHAR(255) NULL,
  tipo_chave VARCHAR(100) NULL,
  empresa INT NULL,
  ativo VARCHAR(5) NOT NULL DEFAULT 'Sim'
);

CREATE TABLE categorias (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(50) NOT NULL, empresa INT NULL);
CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(50) NOT NULL,
  valor_compra DECIMAL(8,2) NOT NULL,
  valor_venda DECIMAL(8,2) NOT NULL,
  estoque INT NOT NULL,
  foto VARCHAR(100) NOT NULL,
  ativo VARCHAR(5) NOT NULL,
  nivel_estoque INT NOT NULL,
  categoria INT NOT NULL,
  fornecedor INT NOT NULL,
  descricao VARCHAR(255) NULL,
  tem_estoque VARCHAR(5) NULL,
  vendas INT NULL,
  empresa INT NULL,
  mostrar_site VARCHAR(5) NULL
);
CREATE TABLE servicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  valor DECIMAL(8,2) NOT NULL,
  comissao INT NULL,
  dias INT NOT NULL,
  ativo VARCHAR(5) NOT NULL,
  empresa INT NULL,
  mostrar_site VARCHAR(5) NULL,
  descricao TEXT NULL
);
CREATE TABLE formas_pgto (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(50) NOT NULL, empresa INT NULL);

CREATE TABLE pagar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  descricao VARCHAR(100) NULL,
  fornecedor INT NOT NULL,
  funcionario INT NOT NULL,
  valor DECIMAL(8,2) NOT NULL,
  vencimento DATE NOT NULL,
  data_pgto DATE NULL,
  data_lanc DATE NOT NULL,
  forma_pgto INT NOT NULL,
  frequencia INT NOT NULL,
  obs VARCHAR(100) NULL,
  referencia VARCHAR(30) NULL,
  subtotal DECIMAL(8,2) NULL,
  usuario_lanc INT NOT NULL,
  usuario_pgto INT NOT NULL,
  pago VARCHAR(5) NULL,
  empresa INT NULL,
  node_status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  node_cancel_reason VARCHAR(255) NULL,
  node_cancelled_at DATETIME NULL,
  node_cancelled_by INT NULL
);
CREATE TABLE receber (
  id INT AUTO_INCREMENT PRIMARY KEY,
  descricao VARCHAR(100) NULL,
  cliente INT NULL,
  valor DECIMAL(8,2) NULL,
  vencimento DATE NULL,
  data_pgto DATE NULL,
  data_lanc DATE NULL,
  forma_pgto INT NULL,
  obs VARCHAR(100) NULL,
  arquivo VARCHAR(100) NULL,
  referencia VARCHAR(30) NULL,
  subtotal DECIMAL(8,2) NULL,
  usuario_lanc INT NULL,
  usuario_pgto INT NULL,
  pago VARCHAR(5) NULL,
  hora TIME NULL,
  empresa INT NULL,
  total_venda DECIMAL(10,2) NULL,
  valor_custo DECIMAL(10,2) NULL,
  cancelada VARCHAR(25) NULL,
  node_status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  node_cancel_reason VARCHAR(255) NULL,
  node_cancelled_at DATETIME NULL,
  node_cancelled_by INT NULL
);
CREATE TABLE pagar_sas LIKE pagar;
CREATE TABLE receber_sas LIKE receber;

CREATE TABLE itens_venda (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto INT NOT NULL,
  valor DECIMAL(8,2) NOT NULL,
  quantidade INT NOT NULL,
  total DECIMAL(8,2) NOT NULL,
  id_venda INT NOT NULL,
  funcionario INT NOT NULL,
  empresa INT NULL,
  tipo VARCHAR(25) NULL
);
CREATE TABLE entradas (id INT AUTO_INCREMENT PRIMARY KEY, produto INT NOT NULL, quantidade INT NOT NULL, motivo VARCHAR(100) NOT NULL, usuario INT NOT NULL, data DATE NOT NULL, empresa INT NULL);
CREATE TABLE saidas LIKE entradas;

CREATE TABLE orcamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente INT NOT NULL,
  data DATE NOT NULL,
  data_entrega DATE NOT NULL,
  dias_validade INT NOT NULL,
  valor DECIMAL(8,2) NOT NULL,
  desconto INT NOT NULL,
  tipo_desconto VARCHAR(20) NOT NULL,
  subtotal DECIMAL(8,2) NOT NULL,
  obs VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL,
  total_produtos DECIMAL(8,2) NULL,
  total_servicos DECIMAL(8,2) NULL,
  funcionario INT NOT NULL,
  frete DECIMAL(8,2) NOT NULL,
  equipamento VARCHAR(50) NULL,
  marca VARCHAR(50) NULL,
  modelo VARCHAR(50) NULL,
  defeito VARCHAR(1000) NULL,
  empresa INT NULL
);
CREATE TABLE os (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente INT NOT NULL,
  data DATE NOT NULL,
  data_entrega DATE NOT NULL,
  dias_validade INT NULL,
  valor DECIMAL(8,2) NOT NULL,
  desconto INT NOT NULL,
  tipo_desconto VARCHAR(20) NOT NULL,
  subtotal DECIMAL(8,2) NOT NULL,
  obs VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL,
  total_produtos DECIMAL(8,2) NOT NULL,
  total_servicos DECIMAL(8,2) NOT NULL,
  funcionario INT NOT NULL,
  frete DECIMAL(8,2) NOT NULL,
  tecnico INT NOT NULL,
  equipamento VARCHAR(255) NULL,
  marca VARCHAR(255) NULL,
  modelo VARCHAR(255) NULL,
  defeito VARCHAR(1000) NULL,
  pago VARCHAR(5) NULL,
  empresa INT NULL
);
CREATE TABLE produtos_orc (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto INT NOT NULL,
  orcamento INT NULL,
  funcionario INT NOT NULL,
  quantidade INT NOT NULL,
  valor DECIMAL(8,2) NOT NULL,
  total DECIMAL(8,2) NOT NULL,
  os INT NULL
);
CREATE TABLE servicos_orc (
  id INT AUTO_INCREMENT PRIMARY KEY,
  servico INT NOT NULL,
  orcamento INT NULL,
  funcionario INT NOT NULL,
  quantidade INT NOT NULL,
  valor DECIMAL(8,2) NOT NULL,
  total DECIMAL(8,2) NOT NULL,
  os INT NULL,
  cliente INT NULL,
  data DATE NULL,
  equipamento VARCHAR(100) NULL,
  modelo VARCHAR(100) NULL,
  subtotal DECIMAL(8,2) NULL
);

CREATE TABLE node_audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  usuario INT NOT NULL,
  acao VARCHAR(40) NOT NULL,
  entidade VARCHAR(40) NOT NULL,
  entidade_id INT NOT NULL,
  motivo VARCHAR(255) NULL,
  detalhes JSON NULL,
  criado_em DATETIME NOT NULL,
  INDEX idx_node_audit_tenant (empresa, entidade, entidade_id)
);

INSERT INTO empresas (id, nome, ativo, data_teste) VALUES (1, 'Empresa de Teste', 'Sim', '2099-12-31');
INSERT INTO usuarios (id, nome, email, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa)
VALUES (1, 'Administrador de Teste', 'teste.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Administrador', 'Sim', '(00) 0000-0000', CURRENT_DATE, 'Sim', 'Sim', 1);
INSERT INTO acessos (id, nome, chave, grupo) VALUES
  (1, 'Dashboard', 'home', 1), (2, 'Clientes', 'clientes', 1), (3, 'Usuários', 'usuarios', 1),
  (4, 'Produtos', 'produtos', 2), (5, 'Financeiro', 'financeiro', 3), (6, 'Ordens de Serviço', 'os', 4);
INSERT INTO clientes (id, nome, telefone, email, cidade, estado, tipo_pessoa, data_cad, usuario, empresa, marketing, ativo)
VALUES (1, 'Cliente Demonstração', '(00) 99999-0000', 'cliente@exemplo.local', 'Cidade Teste', 'SC', 'Física', CURRENT_DATE, 1, 1, 'Não', 'Sim');
INSERT INTO fornecedores (id, nome, telefone, email, data, cidade, estado, empresa, ativo)
VALUES (1, 'Fornecedor Demonstração', '(00) 3333-0000', 'fornecedor@exemplo.local', CURRENT_DATE, 'Cidade Teste', 'SC', 1, 'Sim');
INSERT INTO categorias (id, nome, empresa) VALUES (1, 'Geral', 1);
INSERT INTO produtos (id, codigo, nome, valor_compra, valor_venda, estoque, foto, ativo, nivel_estoque, categoria, fornecedor, tem_estoque, vendas, empresa, mostrar_site)
VALUES (1, 'PROD-001', 'Produto Demonstração', 25.00, 49.90, 12, 'sem-foto.jpg', 'Sim', 3, 1, 1, 'Sim', 0, 1, 'Não');
INSERT INTO servicos (id, nome, valor, comissao, dias, ativo, empresa, mostrar_site, descricao)
VALUES (1, 'Serviço Demonstração', 80.00, 10, 2, 'Sim', 1, 'Não', 'Serviço usado somente no ambiente de teste.');
INSERT INTO formas_pgto (id, nome, empresa) VALUES (1, 'Dinheiro', 1);
INSERT INTO receber (descricao, cliente, valor, vencimento, data_lanc, forma_pgto, referencia, subtotal, usuario_lanc, usuario_pgto, pago, empresa)
VALUES ('Recebimento de demonstração', 1, 120.00, CURRENT_DATE, CURRENT_DATE, 1, 'Conta', 120.00, 1, 0, 'Não', 1);
INSERT INTO pagar (descricao, fornecedor, funcionario, valor, vencimento, data_lanc, forma_pgto, frequencia, referencia, subtotal, usuario_lanc, usuario_pgto, pago, empresa)
VALUES ('Pagamento de demonstração', 1, 0, 50.00, CURRENT_DATE, CURRENT_DATE, 1, 0, 'Conta', 50.00, 1, 0, 'Não', 1);
INSERT INTO orcamentos (cliente, data, data_entrega, dias_validade, valor, desconto, tipo_desconto, subtotal, status, total_produtos, total_servicos, funcionario, frete, equipamento, marca, modelo, defeito, empresa)
VALUES (1, CURRENT_DATE, CURRENT_DATE, 7, 80.00, 0, 'Valor', 80.00, 'Pendente', 0, 80.00, 1, 0, 'Notebook', 'Marca Teste', 'Modelo Teste', 'Avaliação inicial', 1);
INSERT INTO os (cliente, data, data_entrega, dias_validade, valor, desconto, tipo_desconto, subtotal, status, total_produtos, total_servicos, funcionario, frete, tecnico, equipamento, marca, modelo, defeito, pago, empresa)
VALUES (1, CURRENT_DATE, CURRENT_DATE, 7, 80.00, 0, 'Valor', 80.00, 'Aberta', 0, 80.00, 1, 0, 1, 'Notebook', 'Marca Teste', 'Modelo Teste', 'Avaliação inicial', 'Não', 1);
