-- Executar uma única vez, depois de 005_config_campos.sql.
-- Cria um usuário de teste para cada perfil de acesso do ERP (senha de teste Teste@2026),
-- todos na empresa 1 e com todas as permissões, para validar o RBAC por nível.
-- SOMENTE ambiente de teste/homologação local. NÃO deve existir em produção.
-- O hash é o mesmo dos administradores de teste já presentes no seed (senha Teste@2026).

INSERT INTO usuarios (id, nome, email, senha_crip, nivel, ativo, telefone, data, acessar_painel, mostrar_registros, empresa) VALUES
  (3, 'Gerente de Teste', 'gerente.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Gerente', 'Sim', '(00) 0000-0003', CURRENT_DATE, 'Sim', 'Sim', 1),
  (4, 'Comum de Teste', 'comum.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Comum', 'Sim', '(00) 0000-0004', CURRENT_DATE, 'Sim', 'Sim', 1),
  (5, 'Tecnico de Teste', 'tecnico.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Técnico', 'Sim', '(00) 0000-0005', CURRENT_DATE, 'Sim', 'Sim', 1),
  (6, 'Tesoureiro de Teste', 'tesoureiro.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Tesoureiro', 'Sim', '(00) 0000-0006', CURRENT_DATE, 'Sim', 'Sim', 1),
  (7, 'Financeiro de Teste', 'financeiro.local@saas2026.local', '$2b$12$UTs6lFN1arRukJ0VJrJLLOHePByL4BME8UiGQuXEHRxDPxL2RiOyu', 'Financeiro', 'Sim', '(00) 0000-0007', CURRENT_DATE, 'Sim', 'Sim', 1);

INSERT INTO usuarios_permissoes (usuario, permissao)
  SELECT u.id, a.id FROM usuarios u CROSS JOIN acessos a WHERE u.id IN (3, 4, 5, 6, 7);
