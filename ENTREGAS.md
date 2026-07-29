# Entregas

**Última atualização:** 29 de julho de 2026, 15:42 (horário de Brasília).

## Concluído — 29 de julho de 2026

- Memória técnica do projeto em `MEMORIA_PROJETO.md`.
- Repositório Git preparado e primeira versão da memória publicada.
- Base da API Node.js criada com Express e MySQL.
- Configuração por variáveis de ambiente e exemplo de `.env`.
- Middleware de segurança, CORS e tratamento de erros.
- Endpoint de saúde da API.
- Primeiro fluxo de autenticação migrado: login, validação de senha criptografada, usuário ativo e vínculo de empresa.
- Dependências instaladas e carregamento da aplicação validado.
- Usuários e permissões protegidos por empresa, com autorização por função e atualização transacional.
- Testes automatizados da separação por empresa e autorização.
- Cadastro inicial de clientes, fornecedores, produtos e serviços com validação e isolamento por empresa.
- Núcleo financeiro inicial para consulta e baixa controlada de contas a pagar e receber.
- Vendas transacionais com recebível, itens e baixa de estoque no mesmo commit de banco.
- Movimentação de estoque com bloqueio contra saldo negativo.
- Consultas de ordens de serviço e orçamentos, com transições de status validadas.
- Resumos financeiro e operacional para relatórios.
- Job seguro para identificação de recebíveis vencidos.
- Clientes de integração Asaas e WhatsApp configurados somente por ambiente.
- Frontend inicial responsivo para login e indicadores do painel.

## Em andamento — iniciado em 29 de julho de 2026

- Detalhamento das telas operacionais, relatórios avançados e integrações em homologação.

## Próximas entregas

- Completar os fluxos operacionais ainda parciais e os módulos listados em `COBERTURA_MIGRACAO.md`.
- Homologar integrações externas somente em ambientes de teste.
- Sanear o backup legado antes de uma migração definitiva com modo estrito do MySQL.
- Ampliar o frontend para todas as operações e concluir testes ponta a ponta.

## Observações

- O banco MySQL legado será mantido na primeira fase para reduzir risco de migração.
- Credenciais não são versionadas; devem permanecer no arquivo `.env` local.

## Histórico

### 29 de julho de 2026 — 11:50 (horário de Brasília)

- Memória técnica criada e publicada.
- Repositório Git configurado e primeira publicação concluída.
- Base Node.js, autenticação inicial e plano fiscal entregues.

### 29 de julho de 2026 — 12:26 (horário de Brasília)

- Usuários e permissões concluídos na API inicial, incluindo correção de isolamento entre empresas.
- Testes automatizados adicionados e aprovados.
- Migração do cadastro de clientes iniciada.

### 29 de julho de 2026 — 12:30 (horário de Brasília)

- Cadastros de clientes, fornecedores, produtos e serviços adicionados à API inicial.
- Consultas e baixa financeira adicionadas com proteção contra duplicidade.
- Suíte ampliada e aprovada; aplicação continua carregando corretamente.
- Validação integrada com MySQL pendente porque não há servidor MySQL ativo neste ambiente.

### 29 de julho de 2026 — 13:56 (horário de Brasília)

- Branch de usuários, cadastros e financeiro publicada para revisão sem alterar `main`.
- Vendas e estoque migrados com operações transacionais.
- Ordens de serviço, orçamentos, relatórios e job de vencimentos adicionados.
- Infraestrutura de integrações sem segredos no código.
- Frontend inicial entregue e resposta HTTP local validada.
- Suíte ampliada para 23 testes, todos aprovados.

### 29 de julho de 2026 — 15:42 (horário de Brasília)

- Backup legado carregado em um MySQL 8.4 local e descartável, sem acesso à produção.
- Estrutura real validada com 62 tabelas e dados multiempresa.
- Testes integrados aprovados para consultas, clientes, estoque, vendas e permissões, com limpeza dos registros temporários.
- Compatibilidade corrigida para período de teste da empresa, tabelas administrativas do SaaS, produtos sem controle de estoque e job de vencimentos.
- Endpoints autenticados dos módulos migrados responderam com sucesso usando o banco de teste.
- Suíte unitária aprovada: 25 testes; suíte integrada aprovada: 4 testes.
- Sintaxe validada em 43 arquivos JavaScript e auditoria de dependências concluída sem vulnerabilidades conhecidas.
- Varredura de segredos concluída; nenhuma credencial real foi encontrada nos arquivos versionados.
- Limitação identificada: o backup legado contém valores vazios em campos numéricos ou de data e não importa diretamente com o modo estrito do MySQL.
- Cobertura atual e trabalho restante documentados em `COBERTURA_MIGRACAO.md`.
