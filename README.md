# SaaS 2026 — ERP em Node.js

Migração do núcleo operacional do ERP legado para Node.js, Express, MySQL e um frontend JavaScript modular, sem etapa de build.

## Teste local com Docker

Pré-requisito: Docker Desktop em execução.

```powershell
docker compose -f compose.test.yml up --build -d
```

Acesse [http://localhost:3000](http://localhost:3000) e use somente a credencial local:

- E-mail: `teste.local@saas2026.local`
- Senha: `Teste@2026`

O ambiente expõe o MySQL de teste em `127.0.0.1:3308`, contém apenas fixtures fictícias e não acessa produção. Para encerrar e remover os dados descartáveis:

```powershell
docker compose -f compose.test.yml down -v
```

## Desenvolvimento sem Docker

1. Copie `.env.example` para `.env`.
2. Configure um MySQL local e uma chave JWT própria.
3. Instale as dependências com `npm.cmd install`.
4. Aplique `migrations/001_node_frontend_operations.sql` uma vez sobre uma cópia compatível do banco legado.
5. Inicie com `npm.cmd run dev`.

Nunca versione `.env`, backups, certificados, tokens ou chaves de API.

## Módulos disponíveis

- autenticação, usuários e permissões;
- clientes, fornecedores, produtos e serviços;
- estoque e movimentos compensatórios;
- vendas/PDV com vários produtos;
- contas a pagar e receber;
- ordens de serviço e orçamentos com produtos, serviços e transições;
- painel e resumos operacionais/financeiros.

As telas possuem roteamento por hash, busca, filtros, paginação, formulários, estados vazios, mensagens de erro e layout responsivo.

## Rotas principais

- `POST /api/auth/login`
- CRUD e inativação em `/api/users`, `/api/clients` e `/api/catalog/{suppliers|products|services}`
- permissões em `/api/users/:id/permissions`
- estoque em `/api/inventory/movements`
- vendas em `/api/sales`
- financeiro em `/api/finance/{payables|receivables}`
- formas de pagamento em `/api/finance/payment-methods`
- ordens e orçamentos em `/api/work/{orders|quotes}`
- relatórios em `/api/reports/{financial|operational}`

Listagens operacionais retornam `{ items, pagination }` e preservam o filtro pela empresa autenticada.

## Validação

```powershell
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run test:browser
npm.cmd audit
```

O teste de navegador usa Microsoft Edge por padrão (`PLAYWRIGHT_CHANNEL=msedge`). Os testes integrados usam apenas bancos locais/de teste. Consulte `CONFIGURACAO_AMBIENTE.md`, `ENTREGAS.md` e `COBERTURA_MIGRACAO.md` para detalhes.
