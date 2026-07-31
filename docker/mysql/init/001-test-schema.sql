SET NAMES utf8mb4;

CREATE TABLE empresas (
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
  data_cad DATE NOT NULL DEFAULT (CURRENT_DATE),
  usuario INT NULL,
  complemento VARCHAR(100) NULL,
  dias_teste INT NULL,
  mensalidade DECIMAL(8,2) NULL,
  ativo VARCHAR(5) NOT NULL,
  data_teste DATE NULL,
  plano INT NULL,
  url_site VARCHAR(100) NULL,
  frequencia INT NULL,
  dispositivos INT NULL
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
  comissao DECIMAL(9,2) NULL,
  pix VARCHAR(100) NULL,
  tipo_chave VARCHAR(100) NULL,
  salario DECIMAL(10,2) NULL,
  valor_hora DECIMAL(10,2) NULL,
  hora_entrada TIME NULL,
  hora_saida TIME NULL,
  jornada_horas TIME NULL,
  empresa INT NULL
);

CREATE TABLE acessos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  chave VARCHAR(50) NOT NULL,
  grupo INT NOT NULL,
  pagina VARCHAR(5) NULL
);
CREATE TABLE acessos_sas LIKE acessos;
CREATE TABLE grupo_acessos_sas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(25) NOT NULL
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
  senha_crip VARCHAR(150) NULL,
  ativo VARCHAR(5) NULL,
  token VARCHAR(255) NULL,
  foto VARCHAR(100) NULL,
  assinatura VARCHAR(100) NULL,
  api_pagamento_cliente VARCHAR(50) NULL,
  formas_pgto VARCHAR(100) NULL
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

CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  foto VARCHAR(100) NOT NULL DEFAULT 'sem-foto.jpg',
  ativo VARCHAR(5) NOT NULL DEFAULT 'Sim',
  empresa INT NULL,
  icone VARCHAR(60) NULL
);
CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(50) NOT NULL,
  valor_compra DECIMAL(8,2) NOT NULL,
  valor_venda DECIMAL(8,2) NOT NULL,
  valor_promocional DECIMAL(8,2) NULL,
  estoque INT NOT NULL,
  foto VARCHAR(100) NOT NULL,
  ativo VARCHAR(5) NOT NULL,
  nivel_estoque INT NOT NULL,
  categoria INT NOT NULL,
  sub_categoria VARCHAR(50) NULL,
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
  foto VARCHAR(100) NULL,
  mostrar_site VARCHAR(5) NULL,
  descricao TEXT NULL
);
CREATE TABLE formas_pgto (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(50) NOT NULL, taxa INT NULL, empresa INT NULL);

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
  multa DECIMAL(10,2) NULL, juros DECIMAL(10,2) NULL, desconto DECIMAL(10,2) NULL, taxa DECIMAL(10,2) NULL,
  usuario_lanc INT NOT NULL,
  usuario_pgto INT NOT NULL,
  pago VARCHAR(5) NULL,
  caixa INT NULL,
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
  multa DECIMAL(10,2) NULL, juros DECIMAL(10,2) NULL, desconto DECIMAL(10,2) NULL, taxa DECIMAL(10,2) NULL,
  usuario_lanc INT NULL,
  usuario_pgto INT NULL,
  pago VARCHAR(5) NULL,
  hora TIME NULL,
  empresa INT NULL,
  total_venda DECIMAL(10,2) NULL,
  valor_custo DECIMAL(10,2) NULL,
  cancelada VARCHAR(25) NULL,
  caixa INT NULL,
  node_status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  node_cancel_reason VARCHAR(255) NULL,
  node_cancelled_at DATETIME NULL,
  node_cancelled_by INT NULL
);
CREATE TABLE pagar_sas LIKE pagar;
CREATE TABLE receber_sas LIKE receber;

CREATE TABLE planos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NULL,
  valor DECIMAL(10,2) NULL,
  ativo VARCHAR(5) NULL,
  clientes INT NULL,
  usuarios INT NULL,
  dispositivos INT NULL
);
CREATE TABLE planos_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plano INT NULL,
  nome VARCHAR(100) NULL
);
CREATE TABLE recursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NULL,
  chave VARCHAR(50) NULL
);
CREATE TABLE planos_recursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plano INT NULL,
  recurso INT NULL
);
CREATE TABLE clientes_recursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa INT NULL,
  recurso INT NULL
);
CREATE TABLE alertas_sas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(100) NULL,
  texto TEXT NULL,
  ativo VARCHAR(5) NULL,
  data DATE NULL
);

CREATE TABLE itens_venda (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto INT NOT NULL,
  valor DECIMAL(8,2) NOT NULL,
  quantidade INT NOT NULL,
  total DECIMAL(8,2) NOT NULL,
  id_venda INT NOT NULL,
  funcionario INT NOT NULL,
  empresa INT NULL,
  tipo VARCHAR(25) NULL,
  comissao_paga VARCHAR(5) NOT NULL DEFAULT 'Não',
  comissao_paga_em DATETIME NULL,
  comissao_paga_por INT NULL
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
  condicoes VARCHAR(2000) NULL,
  acessorios VARCHAR(1000) NULL,
  laudo VARCHAR(1000) NULL,
  senha_ap VARCHAR(50) NULL,
  mao_obra DECIMAL(8,2) NULL,
  vall DECIMAL(8,2) NULL,
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
  laudo VARCHAR(2000) NULL,
  condicoes VARCHAR(2000) NULL,
  acessorios VARCHAR(1000) NULL,
  orcamento INT NULL,
  mao_obra DECIMAL(8,2) NULL,
  val_entrada DECIMAL(8,2) NULL,
  vall DECIMAL(8,2) NULL,
  dias_garantia VARCHAR(50) NULL,
  senha_ap VARCHAR(50) NULL,
  forma_pgto VARCHAR(20) NULL,
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

CREATE TABLE sub_categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  ativo VARCHAR(5) NOT NULL DEFAULT 'Sim',
  foto VARCHAR(100) NULL,
  empresa INT NULL
);
CREATE TABLE marcas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  ativo VARCHAR(5) NOT NULL DEFAULT 'Sim',
  empresa INT NULL
);
CREATE TABLE equipamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  ativo VARCHAR(5) NOT NULL DEFAULT 'Sim',
  empresa INT NULL
);
CREATE TABLE modelos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  ativo VARCHAR(5) NOT NULL DEFAULT 'Sim',
  marca VARCHAR(100) NULL,
  equipamento VARCHAR(100) NULL,
  empresa INT NULL
);
CREATE TABLE cargos (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(50) NOT NULL, empresa INT NULL);
CREATE TABLE frequencias (id INT AUTO_INCREMENT PRIMARY KEY, frequencia VARCHAR(25) NOT NULL, dias INT NOT NULL, empresa INT NULL);
CREATE TABLE plano_contas (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(150) NULL, empresa INT NULL);
CREATE TABLE cupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL,
  valor DECIMAL(8,2) NOT NULL,
  data DATE NULL,
  quantidade INT NULL,
  valor_minimo DECIMAL(8,2) NULL,
  tipo VARCHAR(20) NULL,
  empresa INT NULL
);
CREATE TABLE contratos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  modelo VARCHAR(50) NOT NULL,
  texto TEXT NOT NULL,
  mostrar_modelos VARCHAR(5) NULL,
  empresa INT NULL
);
CREATE TABLE anotacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(250) NOT NULL,
  msg TEXT NOT NULL,
  usuario INT NOT NULL,
  data DATE NOT NULL,
  mostrar_home VARCHAR(5) NOT NULL,
  privado VARCHAR(5) NOT NULL,
  empresa INT NULL
);
CREATE TABLE tarefas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario INT NOT NULL,
  usuario_lanc INT NOT NULL,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  hora_mensagem TIME NULL,
  descricao VARCHAR(2000) NULL,
  status VARCHAR(20) NULL,
  hash VARCHAR(100) NULL,
  prioridade VARCHAR(25) NULL,
  titulo VARCHAR(255) NULL,
  recorrencia INT NULL,
  empresa INT NULL
);
CREATE TABLE tarefas_clientes LIKE tarefas;
CREATE TABLE chamados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  data DATE NOT NULL,
  titulo VARCHAR(255) NULL,
  texto TEXT NULL,
  status VARCHAR(25) NULL,
  respondido VARCHAR(5) NULL
);
CREATE TABLE chamados_respostas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  usuario INT NOT NULL,
  texto TEXT NOT NULL,
  chamado INT NOT NULL
);
CREATE TABLE marketing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data DATE NOT NULL,
  data_envio DATE NULL,
  envios INT NULL,
  titulo VARCHAR(100) NULL,
  mensagem2 TEXT NULL,
  mensagem TEXT NULL,
  arquivo VARCHAR(100) NULL,
  audio VARCHAR(100) NULL,
  forma_envio VARCHAR(50) NULL,
  documento VARCHAR(100) NULL,
  ultimo_registro INT NULL,
  empresa INT NULL,
  dispositivo VARCHAR(35) NULL,
  total_disparos INT NULL
);
CREATE TABLE grupos_disparos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa INT NULL,
  ativo VARCHAR(5) NULL,
  nome VARCHAR(100) NULL
);
CREATE TABLE grupos_clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa INT NULL,
  grupo INT NULL,
  cliente INT NULL,
  UNIQUE KEY uq_group_client (empresa, grupo, cliente)
);
CREATE TABLE dispositivos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  telefone VARCHAR(20) NULL,
  appkey VARCHAR(40) NULL,
  status VARCHAR(50) NOT NULL,
  status_api VARCHAR(100) NULL,
  horario DATETIME NULL,
  empresa INT NULL
);
CREATE TABLE node_marketing_dispatch (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
);
CREATE TABLE caixas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operador INT NOT NULL,
  data_abertura DATE NOT NULL,
  data_fechamento DATE NULL,
  valor_abertura DECIMAL(10,2) NOT NULL,
  valor_fechamento DECIMAL(10,2) NULL,
  quebra DECIMAL(10,2) NULL,
  usuario_abertura INT NOT NULL,
  usuario_fechamento INT NULL,
  obs VARCHAR(255) NULL,
  sangrias DECIMAL(10,2) NULL,
  empresa INT NULL
);
CREATE TABLE sangrias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario INT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  caixa INT NOT NULL
);
CREATE TABLE cobrancas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente INT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  juros DECIMAL(10,2) NULL,
  multa DECIMAL(10,2) NULL,
  data DATE NOT NULL,
  usuario INT NOT NULL,
  obs VARCHAR(255) NULL,
  data_venc DATE NOT NULL,
  frequencia VARCHAR(25) NOT NULL,
  valor_parcela DECIMAL(10,2) NULL,
  descricao VARCHAR(50) NULL,
  parcelas INT NULL,
  empresa INT NULL,
  api_pagamento_conta VARCHAR(50) NULL,
  pgtos_aceitaveis VARCHAR(100) NULL,
  node_status VARCHAR(20) NOT NULL DEFAULT 'ativo'
);
CREATE TABLE node_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  motivo_cancelamento VARCHAR(255) NULL
);
CREATE TABLE node_purchase_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compra INT NOT NULL,
  produto INT NOT NULL,
  quantidade INT NOT NULL,
  valor_unitario DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL
);
CREATE TABLE node_contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  atualizado_em DATETIME NOT NULL
);
CREATE TABLE node_contract_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  contrato INT NOT NULL,
  cliente INT NOT NULL,
  assinado_por VARCHAR(100) NOT NULL,
  user_agent VARCHAR(255) NULL,
  assinado_em DATETIME NOT NULL,
  UNIQUE KEY uq_contract_signature (empresa, contrato, cliente)
);
CREATE TABLE node_recurring_generated (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa INT NOT NULL,
  cobranca INT NOT NULL,
  recebivel INT NOT NULL,
  vencimento DATE NOT NULL,
  criado_em DATETIME NOT NULL,
  UNIQUE KEY uq_recurring_due (empresa, cobranca, vencimento)
);
CREATE TABLE node_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
);
CREATE TABLE node_store_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
);
CREATE TABLE node_store_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido INT NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  item_id INT NOT NULL,
  nome VARCHAR(100) NOT NULL,
  quantidade INT NOT NULL,
  valor_unitario DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  INDEX idx_store_items_order (pedido)
);
CREATE TABLE jornada (
  id INT AUTO_INCREMENT PRIMARY KEY,
  funcionario INT NOT NULL,
  data DATE NOT NULL,
  entrada TIME NULL,
  entrada_almoco TIME NULL,
  saida_almoco TIME NULL,
  saida TIME NULL,
  total_horas TIME NULL,
  intervalo TIME NULL,
  hora_extra TIME NULL,
  folga VARCHAR(5) NOT NULL DEFAULT 'Não',
  feriado VARCHAR(5) NOT NULL DEFAULT 'Não',
  falta VARCHAR(5) NOT NULL DEFAULT 'Não',
  data_lanc DATE NOT NULL,
  usuario_lanc INT NOT NULL,
  empresa INT NULL,
  UNIQUE KEY uq_jornada_funcionario_data (empresa, funcionario, data)
);
CREATE TABLE site (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa INT NULL,
  titulo VARCHAR(255) NULL,
  subtitulo VARCHAR(255) NULL,
  botao1 VARCHAR(80) NULL,
  botao2 VARCHAR(80) NULL,
  botao3 VARCHAR(80) NULL,
  titulo_recursos VARCHAR(255) NULL,
  titulo_perguntas VARCHAR(255) NULL,
  titulo_rodape VARCHAR(255) NULL,
  descricao_rodape TEXT NULL,
  botao_rodape VARCHAR(100) NULL,
  link_rodape VARCHAR(255) NULL,
  descricao_site TEXT NULL,
  video_site VARCHAR(255) NULL
);
CREATE TABLE config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NULL,
  email VARCHAR(50) NULL,
  telefone VARCHAR(20) NULL,
  endereco VARCHAR(100) NULL,
  instagram VARCHAR(100) NULL,
  cnpj VARCHAR(25) NULL,
  cidade_sistema VARCHAR(50) NULL,
  marca_dagua VARCHAR(5) NULL,
  assinatura_recibo VARCHAR(5) NULL,
  impressao_automatica VARCHAR(5) NULL,
  abertura_caixa VARCHAR(5) NULL,
  dias_comissao INT NULL,
  assinatura_cliente VARCHAR(5) NULL,
  cobrar_automaticamente VARCHAR(5) NULL,
  cobrar_duas_vezes VARCHAR(5) NULL,
  pagina_entrada VARCHAR(25) NULL,
  url_site VARCHAR(255) NULL,
  meta_descricao VARCHAR(255) NULL,
  token_whatsapp VARCHAR(70) NULL,
  instancia_whatsapp VARCHAR(70) NULL,
  access_token VARCHAR(255) NULL,
  public_key VARCHAR(255) NULL,
  chave_api_asaas VARCHAR(255) NULL,
  api_whatsapp VARCHAR(60) NULL,
  multa_atraso DECIMAL(8,2) NULL,
  juros_atraso DECIMAL(8,2) NULL,
  dias_lembrete INT NULL,
  mao_obra_orc VARCHAR(100) NULL, senha_aparelho_orc VARCHAR(100) NULL, defeito_orc VARCHAR(100) NULL,
  avarias_orc VARCHAR(100) NULL, acessorios_orc VARCHAR(100) NULL, laudo_orc VARCHAR(100) NULL,
  mao_obra_os VARCHAR(100) NULL, senha_aparelho_os VARCHAR(100) NULL, defeito_os VARCHAR(100) NULL,
  avarias_os VARCHAR(100) NULL, acessorios_os VARCHAR(100) NULL, laudo_os VARCHAR(100) NULL,
  empresa INT NULL
);
CREATE TABLE recursos_site (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo_recurso VARCHAR(150) NULL,
  icone_recurso VARCHAR(100) NULL,
  descricao_recurso VARCHAR(255) NULL,
  empresa INT NOT NULL,
  posicao_recurso INT NULL
);
CREATE TABLE perguntas_site (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo_pergunta VARCHAR(150) NULL,
  descricao_pergunta TEXT NULL,
  empresa INT NOT NULL,
  posicao_pergunta INT NULL
);
CREATE TABLE videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NULL,
  link VARCHAR(255) NULL,
  ordem INT NULL
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

INSERT INTO planos (id, nome, valor, ativo, clientes, usuarios, dispositivos)
VALUES (1, 'Plano Demonstração', 99.90, 'Sim', 1000, 20, 2);
INSERT INTO recursos (id, nome, chave) VALUES
  (1, 'Gestão comercial', 'comercial'),
  (2, 'Financeiro', 'financeiro'),
  (3, 'Marketing WhatsApp', 'marketing'),
  (4, 'Dashboard', 'dashboard'),
  (5, 'Clientes', 'clientes'),
  (6, 'Fornecedores', 'fornecedores'),
  (7, 'Usuários e permissões', 'usuarios'),
  (8, 'Produtos e serviços', 'produtos_servicos'),
  (9, 'Cadastros auxiliares', 'cadastros_auxiliares'),
  (10, 'Estoque', 'estoque'),
  (11, 'Compras', 'compras'),
  (12, 'Vendas / PDV', 'vendas_pdv'),
  (13, 'Cupons', 'cupons'),
  (14, 'Orçamentos', 'orcamentos'),
  (15, 'Ordens de serviço', 'ordens_servico'),
  (16, 'Contratos', 'contratos'),
  (17, 'Cobranças recorrentes', 'cobrancas_recorrentes'),
  (18, 'Comissões', 'comissoes'),
  (19, 'Recursos humanos', 'recursos_humanos'),
  (20, 'Tarefas', 'tarefas'),
  (21, 'Anotações', 'anotacoes'),
  (22, 'Chamados', 'chamados'),
  (23, 'Relatórios', 'relatorios'),
  (24, 'Site institucional', 'site'),
  (25, 'Assinatura', 'assinatura'),
  (26, 'Configurações', 'configuracoes'),
  (27, 'Tutoriais', 'tutoriais'),
  (28, 'Emissão fiscal NFS-e/NF-e', 'fiscal'),
  (29, 'Portal do cliente', 'portal_cliente'),
  (30, 'Loja online', 'loja_online'),
  (31, 'Anexos', 'anexos'),
  (32, 'Auditoria', 'auditoria');
INSERT INTO planos_recursos (plano, recurso) VALUES (1, 1), (1, 2), (1, 3);
INSERT INTO planos_itens (plano, nome) VALUES (1, 'Até 20 usuários'), (1, 'Marketing e financeiro');
INSERT INTO empresas
  (id, nome, telefone, email, cidade, estado, tipo_pessoa, data_cad, dias_teste, mensalidade, ativo, data_teste, plano, url_site, dispositivos)
VALUES
  (1, 'Empresa de Teste', '(00) 4000-0000', 'empresa@exemplo.local', 'Cidade Teste', 'SC', 'Jurídica', CURRENT_DATE, 0, 99.90, 'Sim', '2099-12-31', 1, 'http://localhost:3000/store.html?company=1', 1);
INSERT INTO usuarios (id, nome, email, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa)
VALUES (1, 'Administrador de Teste', 'teste.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Administrador', 'Sim', '(00) 0000-0000', CURRENT_DATE, 'Sim', 'Sim', 1);
INSERT INTO usuarios (id, nome, email, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa)
VALUES (2, 'Administrador SaaS de Teste', 'sas.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Administrador', 'Sim', '(00) 0000-0001', CURRENT_DATE, 'Sim', 'Sim', 0);
INSERT INTO usuarios (id, nome, email, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa) VALUES
  (3, 'Gerente de Teste', 'gerente.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Gerente', 'Sim', '(00) 0000-0003', CURRENT_DATE, 'Sim', 'Sim', 1),
  (4, 'Comum de Teste', 'comum.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Comum', 'Sim', '(00) 0000-0004', CURRENT_DATE, 'Sim', 'Sim', 1),
  (5, 'Tecnico de Teste', 'tecnico.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Técnico', 'Sim', '(00) 0000-0005', CURRENT_DATE, 'Sim', 'Sim', 1),
  (6, 'Tesoureiro de Teste', 'tesoureiro.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Tesoureiro', 'Sim', '(00) 0000-0006', CURRENT_DATE, 'Sim', 'Sim', 1),
  (7, 'Financeiro de Teste', 'financeiro.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Financeiro', 'Sim', '(00) 0000-0007', CURRENT_DATE, 'Sim', 'Sim', 1);
INSERT INTO acessos (id, nome, chave, grupo) VALUES
  (1, 'Dashboard', 'home', 1), (2, 'Clientes', 'clientes', 1), (3, 'Usuários', 'usuarios', 1),
  (4, 'Produtos', 'produtos', 2), (5, 'Financeiro', 'financeiro', 3), (6, 'Ordens de Serviço', 'os', 4);
INSERT INTO acessos (id, nome, chave, grupo) VALUES
  (7, 'Fornecedores', 'fornecedores', 1),
  (8, 'Serviços', 'servicos', 2),
  (9, 'Categorias', 'categorias', 2),
  (10, 'Subcategorias', 'sub_categorias', 2),
  (11, 'Marcas', 'marcas', 2),
  (12, 'Equipamentos', 'equipamentos', 2),
  (13, 'Modelos', 'modelos', 2),
  (14, 'Formas de pagamento', 'formas_pgto', 3),
  (15, 'Cargos', 'cargos', 5),
  (16, 'Frequências', 'frequencias', 5),
  (17, 'Plano de contas', 'plano_contas', 3),
  (18, 'Cupons', 'cupom', 2),
  (19, 'Modelos de contratos', 'modelos_contratos', 6),
  (20, 'Contratos', 'listar_contratos', 6),
  (21, 'Tarefas', 'tarefas', 7),
  (22, 'Tarefas de clientes', 'tarefas_clientes', 7),
  (23, 'Chamados', 'chamados', 7),
  (24, 'Marketing', 'marketing', 8),
  (25, 'Grupos de disparos', 'grupos_disparos', 8),
  (26, 'Dispositivos', 'dispositivos', 8),
  (27, 'Caixas', 'caixas', 3),
  (28, 'Compras', 'compras', 2),
  (29, 'Cobranças recorrentes', 'cobrancas', 3),
  (30, 'Comissões', 'comissoes', 3),
  (31, 'RH', 'rh', 5),
  (32, 'Dados do site', 'site', 9),
  (33, 'Anotações', 'anotacoes', 7);
INSERT INTO acessos (id, nome, chave, grupo) VALUES
  (34, 'Vendas', 'vendas', 4),
  (35, 'Orçamentos', 'orcamentos', 4),
  (36, 'Entradas', 'entradas', 2),
  (37, 'Saídas', 'saidas', 2),
  (38, 'Estoque', 'estoque', 2),
  (39, 'Contas a receber', 'receber', 3),
  (40, 'Contas a pagar', 'pagar', 3),
  (41, 'Configurações', 'configuracoes', 9),
  (42, 'Funcionários', 'funcionarios', 5),
  (43, 'Gerar contratos', 'rel_contratos', 6),
  (44, 'Minhas comissões', 'minhas_comissoes', 3),
  (45, 'Relatório financeiro', 'rel_financeiro', 3),
  (46, 'Relatório de vendas', 'rel_vendas', 4);
INSERT INTO usuarios_permissoes (usuario, permissao) SELECT 1, id FROM acessos;
INSERT INTO usuarios_permissoes (usuario, permissao) SELECT u.id, a.id FROM usuarios u CROSS JOIN acessos a WHERE u.id IN (3, 4, 5, 6, 7);
INSERT INTO acessos_sas (id, nome, chave, grupo) VALUES
  (1, 'Dashboard SaaS', 'home', 1),
  (2, 'Empresas', 'empresas', 1),
  (3, 'Planos', 'planos', 1),
  (4, 'Recursos', 'recursos', 1),
  (5, 'Financeiro SaaS', 'financeiro_sas', 2),
  (6, 'Alertas', 'alertas', 3),
  (7, 'Usuários SaaS', 'usuarios', 3);
INSERT INTO usuarios_permissoes_sas (usuario, permissao) SELECT 2, id FROM acessos_sas;
INSERT INTO clientes (id, nome, telefone, email, cidade, estado, tipo_pessoa, data_cad, usuario, empresa, marketing, senha_crip, ativo)
VALUES (1, 'Cliente Demonstração', '(00) 99999-0000', 'cliente@exemplo.local', 'Cidade Teste', 'SC', 'Física', CURRENT_DATE, 1, 1, 'Não', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Sim');
INSERT INTO clientes (id, nome, telefone, email, cidade, estado, tipo_pessoa, data_cad, usuario, empresa, marketing, ativo)
VALUES (2, 'Cliente Opt-in de Teste', '(00) 98888-0000', 'optin@exemplo.local', 'Cidade Teste', 'SC', 'Física', CURRENT_DATE, 1, 1, 'Sim', 'Sim');
INSERT INTO fornecedores (id, nome, telefone, email, data, cidade, estado, empresa, ativo)
VALUES (1, 'Fornecedor Demonstração', '(00) 3333-0000', 'fornecedor@exemplo.local', CURRENT_DATE, 'Cidade Teste', 'SC', 1, 'Sim');
INSERT INTO categorias (id, nome, foto, ativo, empresa) VALUES (1, 'Geral', 'sem-foto.jpg', 'Sim', 1);
INSERT INTO produtos (id, codigo, nome, valor_compra, valor_venda, estoque, foto, ativo, nivel_estoque, categoria, fornecedor, tem_estoque, vendas, empresa, mostrar_site)
VALUES (1, 'PROD-001', 'Produto Demonstração', 25.00, 49.90, 12, 'sem-foto.jpg', 'Sim', 3, 1, 1, 'Sim', 0, 1, 'Sim');
INSERT INTO servicos (id, nome, valor, comissao, dias, ativo, empresa, mostrar_site, descricao)
VALUES (1, 'Serviço Demonstração', 80.00, 10, 2, 'Sim', 1, 'Sim', 'Serviço usado somente no ambiente de teste.');
INSERT INTO formas_pgto (id, nome, empresa) VALUES (1, 'Dinheiro', 1);
INSERT INTO receber (descricao, cliente, valor, vencimento, data_lanc, forma_pgto, referencia, subtotal, usuario_lanc, usuario_pgto, pago, empresa)
VALUES ('Recebimento de demonstração', 1, 120.00, CURRENT_DATE, CURRENT_DATE, 1, 'Conta', 120.00, 1, 0, 'Não', 1);
INSERT INTO pagar (descricao, fornecedor, funcionario, valor, vencimento, data_lanc, forma_pgto, frequencia, referencia, subtotal, usuario_lanc, usuario_pgto, pago, empresa)
VALUES ('Pagamento de demonstração', 1, 0, 50.00, CURRENT_DATE, CURRENT_DATE, 1, 0, 'Conta', 50.00, 1, 0, 'Não', 1);
INSERT INTO orcamentos (cliente, data, data_entrega, dias_validade, valor, desconto, tipo_desconto, subtotal, status, total_produtos, total_servicos, funcionario, frete, equipamento, marca, modelo, defeito, empresa)
VALUES (1, CURRENT_DATE, CURRENT_DATE, 7, 80.00, 0, 'Valor', 80.00, 'Pendente', 0, 80.00, 1, 0, 'Notebook', 'Marca Teste', 'Modelo Teste', 'Avaliação inicial', 1);
INSERT INTO os (cliente, data, data_entrega, dias_validade, valor, desconto, tipo_desconto, subtotal, status, total_produtos, total_servicos, funcionario, frete, tecnico, equipamento, marca, modelo, defeito, pago, empresa)
VALUES (1, CURRENT_DATE, CURRENT_DATE, 7, 80.00, 0, 'Valor', 80.00, 'Aberta', 0, 80.00, 1, 0, 1, 'Notebook', 'Marca Teste', 'Modelo Teste', 'Avaliação inicial', 'Não', 1);
INSERT INTO contratos (id, modelo, texto, mostrar_modelos, empresa)
VALUES (1, 'Contrato de demonstração', 'Contrato entre {{empresa.nome}} e {{cliente.nome}}, emitido em {{data}}.', 'Sim', 1);
INSERT INTO node_contracts
  (id, empresa, cliente, modelo_id, titulo, conteudo, status, inicio, fim, valor, criado_por, criado_em, atualizado_em)
VALUES
  (1, 1, 1, 1, 'Contrato de demonstração', 'Contrato de teste local para o Cliente Demonstração.', 'Rascunho', CURRENT_DATE, NULL, 99.90, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO site
  (empresa, titulo, subtitulo, botao1, titulo_recursos, titulo_perguntas, titulo_rodape, descricao_rodape, descricao_site)
VALUES
  (1, 'Loja da Empresa de Teste', 'Produtos e serviços disponíveis no ambiente local.', 'Ver catálogo', 'Nossos recursos', 'Dúvidas frequentes', 'Empresa de Teste', 'Ambiente demonstrativo sem cobrança real.', 'Loja local de demonstração.');
INSERT INTO config
  (nome, email, telefone, endereco, cidade_sistema, url_site, meta_descricao, empresa)
VALUES
  ('Empresa de Teste', 'empresa@exemplo.local', '(00) 4000-0000', 'Rua de Teste, 100', 'Cidade Teste', 'http://localhost:3000/store.html?company=1', 'Catálogo local de demonstração.', 1);
INSERT INTO recursos_site (titulo_recurso, icone_recurso, descricao_recurso, empresa, posicao_recurso)
VALUES ('Compra segura', 'check', 'Pedido registrado diretamente no ERP local.', 1, 1);
INSERT INTO perguntas_site (titulo_pergunta, descricao_pergunta, empresa, posicao_pergunta)
VALUES ('Há cobrança real?', 'Não. O Docker de teste não processa pagamentos externos.', 1, 1);
INSERT INTO videos (titulo, link, ordem) VALUES ('Primeiros passos', 'https://example.com/tutorial-local', 1);
INSERT INTO cupons (codigo, valor, data, quantidade, valor_minimo, tipo, empresa)
VALUES ('TESTE10', 10, '2099-12-31', 100, 10, 'Percentual', 1);
