# Análise de fatoração — telas, perfis de acesso e senha

**Data:** 31 de julho de 2026. **Escopo:** verificar se **todas as telas e funcionalidades de todos os perfis de acesso e senha** do ERP PHP legado foram fatoradas (migradas) para a aplicação Node.js.

## Método e fontes

A análise cruza três fontes:

1. **Catálogo canônico do legado** (`erp.sql`, 66 tabelas) — a verdade de escopo:
   - `acessos` — **55** telas/permissões do ERP interno (tenant).
   - `acessos_sas` — **27** telas/permissões da administração SaaS.
   - `grupo_acessos` — grupos de menu (Pessoas, Cadastros, Financeiro, Caixas, Produtos, Contratos, Marketing, Orçamentos, Tarefas, OS).
   - `usuarios` — níveis de acesso + flags `acessar_painel` e `mostrar_registros`.
   - `config` — ~60 parâmetros de negócio da tela "Configurações".
2. **Código Node atual** — `src/modules/*`, middlewares de segurança, `public/{index,admin,portal,store}.*`, `migrations/00{1,2}`.
3. **Confronto chave a chave** — cada `acessos.chave` vs. `permit('<chave>')` no código e a tela correspondente em `public/`.

## Veredito

**A fatoração NÃO está 100% completa.** As telas **operacionais** foram fatoradas em grande parte (4 frontends, sem stubs, cobrindo inclusive muito do que a documentação anterior listava como "fora de escopo"). As lacunas concretas concentram-se em cinco frentes:

| Frente | Situação |
|---|---|
| **Telas operacionais (tenant)** | ✅ ~45 de 55 permissões fatoradas; 3 parciais; 7 ausentes |
| **Administração SaaS** | ✅ P1 corrigido nesta entrega — CRUD e permissões de usuários SaaS agora completos |
| **Senha** | ✅ P0 corrigido nesta entrega (troca self-service do staff, rate limiting, credenciais hardcoded); recuperação/reset por e-mail e MFA seguem ausentes (fora do que é responsável fabricar sem provedor real) |
| **Perfis de acesso** | ✅ P1 corrigido nesta entrega — `acessar_painel`/`mostrar_registros` com enforcement real |
| **Configurações / Relatórios** | ✅ P2 corrigido nesta entrega — Configurações ampliadas e aplicadas (multa/juros, textos padrão); todos os relatórios legados com equivalente |

---

## A. Telas do ERP interno (tenant) — `acessos`

De **55** permissões de tela do legado: **~45 fatoradas**, **3 parciais**, **7 ausentes**.

### A.1 Lacunas (ausentes e parciais)

| Chave legada | Tela | Grupo | Status Node |
|---|---|---|---|
| `acessos` (id 4) | Gestão do catálogo de permissões | Cadastros | ❌ ausente (gated por `config.alterar_acessos`) |
| `grupo_acessos` (id 5) | Grupos/menus de permissão | Cadastros | ❌ ausente |
| `rel_sintetico_despesas` (id 17) | Relatório sintético de despesas | Financeiro | ❌ ausente |
| `rel_sintetico_receber` (id 18) | Relatório sintético a receber | Financeiro | ❌ ausente |
| `rel_balanco` (id 19) | Balanço anual | Financeiro | ❌ ausente |
| `rel_prod_vendidos` (id 55) | Produtos mais vendidos | Produtos | ❌ ausente |
| `upgrade` (id 81) | Upgrade de plano (self-service) | — | ❌ ausente |
| `configuracoes` (id 2) | Configurações | — | ⚠️ parcial (ver seção E) |
| `mensalidades` (id 37) | Mensalidades | — | ⚠️ parcial (assinatura só-leitura + cobranças recorrentes) |
| `editar_conta_paga` (id 39) | Editar baixa de conta | — | ⚠️ parcial (há reabrir/cancelar, não edição da baixa) |

> Observação: as sub-telas de status de OS (`os_abertas`, `os_iniciadas`, …) e de orçamentos (`orcamentos_pendentes/aprovados/vencidos`) foram **consolidadas** em listas filtráveis por status no Node — cobertura funcional equivalente, por design.

### A.2 Telas fatoradas (referência)

home, usuarios, funcionarios (RH), fornecedores, formas_pgto, cargos, frequencias, receber, pagar, clientes, rel_financeiro, caixas, rel_caixas, tarefas, lancar_tarefas, rel_inadimplementes, dispositivos, marketing, chamados, cobrancas, modelos_contratos, rel_contratos, modelos, equipamentos, servicos, marcas, categorias, sub_categorias, produtos, entradas, saidas, estoque, vendas, compras, lista_vendas, orcamentos, os (+sub-status), comissoes, minhas_comissoes, rh, site, rel_vendas, grupos_disparos, listar_contratos, tarefas_clientes, cupom.

---

## B. Administração SaaS — `acessos_sas`

**Fatoradas** (em `admin.html`): dashboard (home), empresas, planos, recursos, alertas, mensalidades/billing (`receber_sas`).

**Lacunas:**

| Chave legada | Tela | Status Node |
|---|---|---|
| `usuarios` | Usuários SaaS | ✅ **corrigido** — CRUD completo + atribuição de permissões (`editUserPermissions` em `admin.js`, reaproveitando `/api/users` e `/api/users/:id/permissions`, já companyId-aware) |
| `acessos` / `grupo_acessos` | Catálogo/grupos de permissão SaaS | ❌ ausente (fora do escopo do P1; gestão do catálogo em si, não das atribuições) |
| `tarefas` / `lancar_tarefas` | Tarefas SaaS (`tarefas_sas`) | ❌ ausente (tabela não consumida) |
| `site` / `configuracoes` | Site/config da plataforma | ❌ ausente |

---

## C. Senha

| Item | Status |
|---|---|
| Login do staff (`POST /api/auth/login`) | ✅ |
| Login do cliente do portal (`POST /api/client/login`), separado por `kind` | ✅ |
| Hash bcrypt (custo 12) e hash nunca retornado nas respostas | ✅ |
| Isolamento cruzado staff ↔ cliente (middlewares) | ✅ |
| Troca de senha self-service do **cliente** (`PATCH /api/client/me`) | ✅ |
| Troca de senha self-service do **staff** | ✅ **corrigido** — `PATCH /api/users/me/password` (exige senha atual), com tela em `index.html`/`admin.html` ("Alterar senha") |
| Rate limiting de login / bloqueio por tentativas | ✅ **corrigido** — `src/middlewares/login-rate-limit.js`, aplicado a `/api/auth/login` e `/api/client/login` |
| Credenciais de demonstração hardcoded nos formulários de login | ✅ **corrigido** — removidas de `admin.html` e `portal.html` |
| **Recuperação de senha** ("esqueci minha senha") | ❌ ausente em todos os frontends (requer decisão sobre provedor de e-mail) |
| **Redefinição por token / e-mail** | ❌ ausente |
| **Primeiro acesso / convite / senha temporária** | ❌ ausente — cliente criado no checkout fica sem `senha_crip` e sem caminho para ativar o portal |
| **MFA / 2FA** | ❌ ausente |
| **Logout / revogação server-side de token** | ❌ ausente (só client-side; token válido até expirar em 8h) |

`MEMORIA_PROJETO.md` lista explicitamente "Autenticação, **recuperação e alteração de senha**" como módulo a migrar — a alteração (staff) foi corrigida nesta entrega; a recuperação por e-mail permanece não fatorada.

---

## D. Perfis de acesso

**Modelo sólido e bem fatorado:**

- 6 níveis internos (`usuarios.nivel`): `Administrador`, `Gerente`, `Comum`, `Técnico`, `Tesoureiro`, `Financeiro`.
- Master/SaaS = `Administrador` com `empresa = 0` (tabelas espelho `_sas`).
- Cliente = `role: 'Cliente'`, `kind: 'client'`.
- Dois eixos independentes de controle: `authorize(...papéis)` (hardcoded por rota) + `permit(...chaves)` (ACL data-driven em `acessos`/`acessos_sas`). Isolamento multi-tenant por `empresa` em praticamente todas as queries.

**Lacunas:**

- ✅ **corrigido — `acessar_painel` e `mostrar_registros` agora com enforcement.** `acessar_painel='Não'` bloqueia o login no painel (`auth.service.js`); `mostrar_registros='Não'` é embarcado no JWT e escopa as listagens de clientes, vendas e OS/orçamentos ao próprio usuário (`clients.service.js`, `sales.service.js`, `work.service.js`).
- ✅ **corrigido — CRUD de permissões de usuários SaaS** na administração (`admin.js`).
- ⚠️ Sem o conceito de "grupos de acesso" (templates de permissão reutilizáveis) — não fazia parte do escopo do P1.

---

## E. Configurações — `config` (ampliado nesta entrega: ~34 de ~60 campos)

**Editáveis no Node** (`content.routes.js`): nome, email, telefone, endereco, instagram, cnpj, cidade_sistema, marca_dagua, assinatura_recibo, impressao_automatica, abertura_caixa, dias_comissao, assinatura_cliente, cobrar_automaticamente, cobrar_duas_vezes, pagina_entrada, url_site, meta_descricao, **multa_atraso, juros_atraso, dias_lembrete, mao_obra_orc/os, senha_aparelho_orc/os, defeito_orc/os, avarias_orc/os, acessorios_orc/os, laudo_orc/os** (12 campos novos ✅ corrigidos).

- ✅ **`multa_atraso`/`juros_atraso` agora aplicados automaticamente**: `finance.service.js#settleEntry` calcula multa (% fixo) e juros (% ao dia de atraso) sobre o valor quando a baixa ocorre após o vencimento e nenhum valor manual é informado; o operador pode sobrepor via `PATCH .../settle { multa, juros }`.
- ✅ **Textos padrão de OS/orçamento agora aplicados**: `work.service.js#createWork` usa os textos de `config` (`defeito_*`, `laudo_*`, `acessorios_*`, `senha_aparelho_*`, e `avarias_*`+`mao_obra_*` mesclados em `condicoes`) como valor inicial quando o campo não é informado na criação.

**Ainda não fatorados:**

- Logos e branding: `logo`, `icone`, `logo_rel`, `logo_painel`, `imagem_assinatura`, `fundo_login` — sem upload.
- Integrações por empresa: `api_whatsapp`/`token_whatsapp`/`instancia_whatsapp`, `api_pagamento`/`chave_api_asaas`/`access_token`/`public_key` — Node usa apenas variáveis de ambiente, não configuração por tenant.
- Outros: `taxa_cartao_api`, `alterar_acessos`, `limitar_recursos`, `multi_empresas`, `entrar_automatico`, `mostrar_preloader`, `ocultar_mobile`, `endereco_checkout`.

> `marca_dagua`, `assinatura_recibo` e `impressao_automatica` continuam graváveis mas sem geração de PDF/recibo que os consuma — ver seção G (P3).

---

## F. Relatórios

Todos os 9 relatórios legados agora têm equivalente no Node. O Node também adicionou fluxo de caixa e inventário, que não existiam no legado.

| Relatório legado | Node |
|---|---|
| `rel_financeiro` | ✅ `financialSummary` |
| `rel_vendas` | ✅ `salesReport` |
| `rel_caixas` | ✅ `cashReport` |
| `rel_inadimplementes` | ✅ `delinquencyReport` |
| `rel_contratos` | ⚠️ parcial (via `operations/contracts`) |
| `rel_sintetico_despesas` | ✅ **corrigido** — `syntheticPayablesReport` (agrupado por plano de contas) |
| `rel_sintetico_receber` | ✅ **corrigido** — `syntheticReceivablesReport` (agrupado por referência) |
| `rel_balanco` (balanço anual) | ✅ **corrigido** — `annualBalanceReport` (receita/despesa/saldo por mês) |
| `rel_prod_vendidos` (mais vendidos) | ✅ **corrigido** — `topProductsReport` |
| — | ➕ `operationalSummary`, `cashFlowReport`, `inventoryReport` (novos) |

---

## G. Módulos/funcionalidades legadas ainda ausentes ou parciais

- **Emissão fiscal / NF-e** — ❌ ausente (existe apenas `PLANO_INTEGRACAO_NOTA_FISCAL.md`).
- **Geração de PDF / impressão / exportações avançadas** — ❌ ausente (só exportação CSV nos relatórios).
- **Conciliação bancária** — ❌ ausente.
- **Folha de pagamento completa** — ⚠️ parcial (só ponto + estimativa, sem rubricas/encargos).
- **Webhooks de Asaas/WhatsApp e homologação das integrações** — ❌ ausente.
- **Multa/juros de atraso automáticos** — ✅ **corrigido** (ver seção E) — não estava mais ausente ao chegar em P3.
- **Upgrade de plano self-service** e **upload de logos/assinatura** — ❌ ausente.

---

## H. Backlog priorizado de remediação

- **P0 — Senha/segurança — ✅ concluído em 31/07/2026:** troca de senha self-service do staff (`PATCH /api/users/me/password` + tela "Alterar senha" em `index.html`/`admin.html`); rate limiting em memória nos logins (`src/middlewares/login-rate-limit.js`, 20 tentativas/15min por IP+e-mail); credenciais demo hardcoded removidas de `admin.html`/`portal.html`. *(Recuperação de senha por e-mail continua pendente — exige decidir provedor de e-mail antes.)*
- **P1 — Perfis — ✅ concluído em 31/07/2026:** `mostrar_registros` escopando listagens de clientes/vendas/OS/orçamentos ao usuário; `acessar_painel` bloqueando login no painel; CRUD + atribuição de permissões de usuários SaaS em `admin.js`.
- **P2 — Configurações/Relatórios — ✅ concluído em 31/07/2026:** `settingsSchema` ampliado com multa/juros, textos padrão de OS/orçamento e `dias_lembrete`, todos aplicados (não só armazenados); relatórios `rel_balanco`, `rel_prod_vendidos` e os dois sintéticos implementados.
- **P3 — Módulos amplos — ver seção J.** Fiscal/NF-e, PDF/impressão, conciliação bancária, folha completa e webhooks — parte foi endereçada nesta entrega (dentro do que é honesto entregar sem infraestrutura externa real); a emissão fiscal segue como scaffold não homologado.

## I. Como validar

- **Cobertura de permissões:** conferir que cada `acessos`/`acessos_sas.chave` do `erp.sql` tem (ou não) um `permit('<chave>')` em `src/modules/*` e uma tela em `public/*` — as seções A/B são o resultado.
- **Ausência de enforcement de perfil:** `grep -rn "mostrar_registros\|acessar_painel" src/` mostra apenas persistência/leitura, sem cláusula `WHERE` nem bloqueio.
- **Ausência de multa/juros:** `grep -rn "multa\|juros" src/` só encontra leitura por registro em recorrências, não a regra de configuração.
- **Após qualquer remediação:** `npm test`, `npm run test:integration`, `npm run test:e2e` e revisão visual das telas afetadas.
