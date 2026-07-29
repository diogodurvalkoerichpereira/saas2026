# Entregas

**Última atualização:** 29 de julho de 2026, 12:30 (horário de Brasília).

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

## Em andamento — iniciado em 29 de julho de 2026

- Vendas, ordens de serviço e movimentação de estoque.

## Próximas entregas

- Cadastros de clientes, fornecedores, produtos e serviços.
- Financeiro: contas a pagar, a receber, caixa e cobranças.
- Carrinho, planos, assinaturas e integrações.
- Jobs agendados, relatórios e migração do frontend.

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
