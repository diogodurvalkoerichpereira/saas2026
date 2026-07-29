# SaaS 2026 — Node.js

Base da migração do ERP legado em PHP para Node.js com Express e MySQL.

## Preparação

1. Copie `.env.example` para `.env`.
2. Preencha as variáveis de banco e uma chave JWT própria.
3. Importe o backup MySQL legado antes de executar a API.
4. Instale dependências com `npm.cmd install`.
5. Inicie em desenvolvimento com `npm.cmd run dev`.

## Estrutura

- `src/config`: ambiente e pool MySQL.
- `src/modules`: módulos de negócio migrados por domínio.
- `src/middlewares`: tratamento consistente de erros.

## Primeiro endpoint migrado

`POST /api/auth/login` recebe `email` e `password`, valida o usuário ativo e retorna um token temporário. O endpoint substitui o fluxo de `autenticar.php` sem gravar senhas no navegador.

## Migração planejada

1. Autenticação, usuários e configurações.
2. Cadastros: clientes, fornecedores, produtos e serviços.
3. Financeiro, cobranças, recorrências e relatórios.
4. Carrinho, planos, assinaturas, integrações e jobs.
