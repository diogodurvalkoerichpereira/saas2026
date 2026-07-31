-- Dados fictícios para desenvolvimento e teste do saas2026.
-- NÃO aplicar em produção: contém usuários de teste com senha conhecida (Teste@2026).

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

DO $$
DECLARE r RECORD; seq TEXT; maxid BIGINT;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'id' LOOP
    seq := pg_get_serial_sequence(r.table_name, 'id');
    IF seq IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', r.table_name) INTO maxid;
      PERFORM setval(seq, GREATEST(maxid, 1), maxid > 0);
    END IF;
  END LOOP;
END $$;
