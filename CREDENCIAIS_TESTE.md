# Credenciais de teste (ambiente local)

Estas são credenciais de TESTE do ambiente local de homologação (docker compose), com
dados fictícios e descartáveis. NÃO são de produção e não devem existir em produção. Servem
para validar o sistema e o controle de acesso por perfil.

Ambiente: `http://localhost:3000` (ou `http://127.0.0.1:3000`), banco MySQL local via
`docker compose -f compose.test.yml`. Todos os usuários usam a mesma senha de teste.

Senha para todos: `Teste@2026`

## ERP (painel administrativo, empresa de teste)

Login em `http://localhost:3000` (tela inicial).

| Perfil (nível) | E-mail | Observação |
|---|---|---|
| Administrador | `teste.local@saas2026.local` | Acesso total |
| Gerente | `gerente.local@saas2026.local` | Gerência (sem ações restritas a Administrador) |
| Comum | `comum.local@saas2026.local` | Operacional |
| Técnico | `tecnico.local@saas2026.local` | Foco em OS/serviços |
| Tesoureiro | `tesoureiro.local@saas2026.local` | Foco em caixa/financeiro |
| Financeiro | `financeiro.local@saas2026.local` | Foco em financeiro |

Todos os perfis acima estão na mesma empresa (empresa 1) e têm todas as permissões de módulo
atribuídas, para que a diferença observada entre eles seja apenas o controle por nível
(`authorize`) nas ações. Para testar o escopo "ver só os próprios registros", altere
`mostrar_registros` para `Não` no usuário desejado (tabela `usuarios`).

## Portal do cliente

Login em `http://localhost:3000/portal.html`.

| Perfil | E-mail | Empresa | Observação |
|---|---|---|---|
| Cliente | `cliente@exemplo.local` | 1 | Portal do cliente (OS, orçamentos, contratos, faturas) |

No portal, informe o código da empresa (empresa 1) além do e-mail e senha.

## Administração SaaS (multi-empresa)

Login em `http://localhost:3000/admin.html`.

| Perfil | E-mail | Observação |
|---|---|---|
| Administrador SaaS | `sas.local@saas2026.local` | Empresas, planos, recursos, alertas, usuários SaaS |

## Como os usuários de teste são criados

- Seed inicial (bancos novos): `docker/mysql/init/001-test-schema.sql`.
- Bancos já existentes: `migrations/006_usuarios_teste.sql` (perfis Gerente, Comum, Técnico,
  Tesoureiro e Financeiro) — executar uma única vez.
- Todos com o mesmo hash bcrypt da senha `Teste@2026`.
