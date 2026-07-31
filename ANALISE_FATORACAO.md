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
| **Administração SaaS** | ⚠️ núcleo fatorado; gestão de usuários/permissões SaaS ausente ou só-leitura |
| **Senha** | ❌ pilar mais incompleto (recuperação, reset, troca self-service do staff, MFA, rate limiting ausentes) |
| **Perfis de acesso** | ⚠️ modelo sólido, mas `acessar_painel`/`mostrar_registros` sem enforcement |
| **Configurações / Relatórios** | ⚠️ Configurações ~18 de ~60 campos; 4 relatórios legados ausentes |

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
| `usuarios` | Usuários SaaS | ⚠️ **somente leitura** — sem CRUD nem atribuição de permissões, apesar de existirem `acessos_sas`/`usuarios_permissoes_sas` |
| `acessos` / `grupo_acessos` | Catálogo/grupos de permissão SaaS | ❌ ausente |
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
| **Troca de senha self-service do staff** | ❌ ausente — só admin/gerente altera a de terceiros via `PATCH /api/users/:id`; usuário Comum/Técnico não muda a própria senha |
| **Recuperação de senha** ("esqueci minha senha") | ❌ ausente em todos os frontends |
| **Redefinição por token / e-mail** | ❌ ausente (não há cliente de e-mail no projeto) |
| **Primeiro acesso / convite / senha temporária** | ❌ ausente — cliente criado no checkout fica sem `senha_crip` e sem caminho para ativar o portal |
| **MFA / 2FA** | ❌ ausente |
| **Rate limiting de login / bloqueio por tentativas** | ❌ ausente |
| **Logout / revogação server-side de token** | ❌ ausente (só client-side; token válido até expirar em 8h) |
| Credenciais de demonstração hardcoded nos formulários de login | ⚠️ `admin.html:14` e `portal.html:15` (`value="Teste@2026"`) |

`MEMORIA_PROJETO.md` lista explicitamente "Autenticação, **recuperação e alteração de senha**" como módulo a migrar — recuperação e alteração (staff) permanecem não fatoradas.

---

## D. Perfis de acesso

**Modelo sólido e bem fatorado:**

- 6 níveis internos (`usuarios.nivel`): `Administrador`, `Gerente`, `Comum`, `Técnico`, `Tesoureiro`, `Financeiro`.
- Master/SaaS = `Administrador` com `empresa = 0` (tabelas espelho `_sas`).
- Cliente = `role: 'Cliente'`, `kind: 'client'`.
- Dois eixos independentes de controle: `authorize(...papéis)` (hardcoded por rota) + `permit(...chaves)` (ACL data-driven em `acessos`/`acessos_sas`). Isolamento multi-tenant por `empresa` em praticamente todas as queries.

**Lacunas:**

- ❌ **`acessar_painel` e `mostrar_registros` sem enforcement.** São persistidos (`users.service.js:35,51`), têm campo no formulário (`pages.js:101-102`) e `mostrar_registros` é lido no login (`auth.service.js:8`) — mas **nenhuma query ou middleware os aplica**. No legado, `acessar_painel='Não'` bloqueia o acesso ao painel e `mostrar_registros='Não'` limita as listagens aos registros do próprio usuário. **Hoje todos os usuários da empresa veem todos os registros.**
- ⚠️ Sem tela para gerir permissões de usuários **SaaS**.
- ⚠️ Sem o conceito de "grupos de acesso" (templates de permissão reutilizáveis).

---

## E. Configurações — `config` (parcial: ~18 de ~60 campos)

**Editáveis no Node** (`content.routes.js:29-38`): nome, email, telefone, endereco, instagram, cnpj, cidade_sistema, marca_dagua, assinatura_recibo, impressao_automatica, abertura_caixa, dias_comissao, assinatura_cliente, cobrar_automaticamente, cobrar_duas_vezes, pagina_entrada, url_site, meta_descricao.

**Não fatorados (destaques):**

- `multa_atraso` / `juros_atraso` — **não referenciados em `src/`**: não há tela nem **cálculo automático de multa/juros** sobre contas em atraso.
- Logos e branding: `logo`, `icone`, `logo_rel`, `logo_painel`, `imagem_assinatura`, `fundo_login` — sem upload.
- Integrações por empresa: `api_whatsapp`/`token_whatsapp`/`instancia_whatsapp`, `api_pagamento`/`chave_api_asaas`/`access_token`/`public_key` — Node usa apenas variáveis de ambiente, não configuração por tenant.
- Textos padrão de OS/orçamento: `mao_obra_*`, `defeito_*`, `avarias_*`, `acessorios_*`, `laudo_*`, `senha_aparelho_*`.
- Outros: `dias_lembrete`, `taxa_cartao_api`, `alterar_acessos`, `limitar_recursos`, `multi_empresas`, `entrar_automatico`, `mostrar_preloader`, `ocultar_mobile`, `endereco_checkout`.

> `marca_dagua`, `assinatura_recibo` e `impressao_automatica` são graváveis, mas **não há geração de PDF/recibo** que os consuma (o módulo `files` apenas armazena anexos).

---

## F. Relatórios

De 9 relatórios legados, **5 têm equivalente** e **4 estão ausentes**. O Node adicionou fluxo de caixa e inventário no lugar.

| Relatório legado | Node |
|---|---|
| `rel_financeiro` | ✅ `financialSummary` |
| `rel_vendas` | ✅ `salesReport` |
| `rel_caixas` | ✅ `cashReport` |
| `rel_inadimplementes` | ✅ `delinquencyReport` |
| `rel_contratos` | ⚠️ parcial (via `operations/contracts`) |
| `rel_sintetico_despesas` | ❌ ausente |
| `rel_sintetico_receber` | ❌ ausente |
| `rel_balanco` (balanço anual) | ❌ ausente |
| `rel_prod_vendidos` (mais vendidos) | ❌ ausente |
| — | ➕ `operationalSummary`, `cashFlowReport`, `inventoryReport` (novos) |

---

## G. Módulos/funcionalidades legadas ainda ausentes ou parciais

- **Emissão fiscal / NF-e** — ❌ ausente (existe apenas `PLANO_INTEGRACAO_NOTA_FISCAL.md`).
- **Geração de PDF / impressão / exportações avançadas** — ❌ ausente (só exportação CSV nos relatórios).
- **Conciliação bancária** — ❌ ausente.
- **Folha de pagamento completa** — ⚠️ parcial (só ponto + estimativa, sem rubricas/encargos).
- **Webhooks de Asaas/WhatsApp e homologação das integrações** — ❌ ausente.
- **Multa/juros de atraso automáticos** — ❌ ausente.
- **Upgrade de plano self-service** e **upload de logos/assinatura** — ❌ ausente.

---

## H. Backlog priorizado de remediação

- **P0 — Senha/segurança:** troca de senha self-service do staff (`PATCH /api/users/me` + tela); rate limiting nos logins (`express-rate-limit`); remover credenciais demo hardcoded dos HTML. *(Recuperação por e-mail exige decidir provedor de e-mail antes.)*
- **P1 — Perfis:** aplicar `mostrar_registros` (escopar listagens ao `usuario`) e `acessar_painel` (bloquear login no painel); CRUD + atribuição de permissões de usuários SaaS.
- **P2 — Configurações/Relatórios:** ampliar `settingsSchema` para os campos de negócio faltantes (multa/juros, textos padrão de OS/orçamento, `dias_lembrete`) e aplicá-los; relatórios `rel_balanco`, `rel_prod_vendidos` e sintéticos.
- **P3 — Módulos amplos:** fiscal/NF-e, PDF/impressão, conciliação bancária, folha completa, webhooks (esforço maior, fora do "core de fatoração").

## I. Como validar

- **Cobertura de permissões:** conferir que cada `acessos`/`acessos_sas.chave` do `erp.sql` tem (ou não) um `permit('<chave>')` em `src/modules/*` e uma tela em `public/*` — as seções A/B são o resultado.
- **Ausência de enforcement de perfil:** `grep -rn "mostrar_registros\|acessar_painel" src/` mostra apenas persistência/leitura, sem cláusula `WHERE` nem bloqueio.
- **Ausência de multa/juros:** `grep -rn "multa\|juros" src/` só encontra leitura por registro em recorrências, não a regra de configuração.
- **Após qualquer remediação:** `npm test`, `npm run test:integration`, `npm run test:e2e` e revisão visual das telas afetadas.
