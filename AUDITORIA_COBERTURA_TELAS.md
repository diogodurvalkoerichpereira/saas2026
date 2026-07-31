# Auditoria de cobertura: ERP legado (erp.sql) vs sistema Node atual

Data: 31 de julho de 2026.

Este documento substitui a visão de `COBERTURA_MIGRACAO.md` (29/07), que já lista como "fora de escopo" módulos que hoje existem (RH, compras, caixa, contratos, chamados, tarefas, campanhas, site, anexos, fiscal). Também corrige uma inconsistência interna do `ANALISE_FATORACAO.md` (31/07): a tabela A.1 daquele arquivo listava rel_sintetico_despesas/receber, rel_balanco e rel_prod_vendidos como ausentes, mas as próprias seções F/H do mesmo arquivo — e o código — já os davam como entregues na mesma noite.

## Método e fontes

1. Catálogo canônico do legado (`erp.sql`, 66 tabelas): `acessos` (82 telas/permissões do ERP), `acessos_sas` (26 do painel SaaS), `grupo_acessos` (10 grupos de menu).
2. Inventário real do app Node: endpoints por módulo (`src/modules/*`), rotas e abas do frontend (`public/js/router.mjs`, `pages.js`, `extra-pages.js`), telas de Portal/Loja/Admin.
3. Verificação direta no código dos pontos duvidosos (abas de Relatórios, status de OS/orçamento, campos de Configurações, ação de Comissões).
4. Conferência dos commits de 31/07 madrugada (`ANALISE_FATORACAO.md`, `ENTREGAS.md`, `CLAUDE.md`) contra o estado atual do código.

Legenda: OK = coberto; PARCIAL = existe com lacuna; AUSENTE = não migrado.

## Matriz tela a tela (legado → Node)

### Grupo Avulsos (grupo 0)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Home | OK | Dashboard |
| Configurações | OK | Configurações (inclui multa/juros e textos padrão ORC/OS) |
| Mensalidades | OK | Admin SaaS · Mensalidades + tela Assinatura no ERP |
| Dispositivos | OK | Marketing, aba Dispositivos |
| Editar Baixa Conta | OK | Coberto por reabrir + baixar de novo (sem edição direta da baixa) |
| Marketing | OK | Marketing, aba Campanhas |
| Chamados | OK | Chamados (com respostas) |
| Vendas | OK | Vendas/PDV (+ NFS-e/NF-e, que o legado não tinha) |
| RH | OK | RH: abas Ponto e Folha estimada |
| Dados do Site | OK | Site: abas Conteúdo, Recursos, Perguntas |
| Upgrade Plano | AUSENTE | Tela Assinatura é só informativa; upgrade só via Admin SaaS |

### Grupo Pessoas (1)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Usuários | OK | Usuários (+ permissões por usuário, troca de senha) |
| Funcionários | PARCIAL | Sem tela própria; dados (salário, jornada, PIX) no cadastro de Usuários + RH |
| Fornecedores | OK | Fornecedores |
| Clientes | OK | Clientes (+ Portal do cliente, extra) |

### Grupo Cadastros (2)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Acessos | AUSENTE | Catálogo de permissões é fixo (seed); atribuição por usuário existe |
| Grupos Acesso | AUSENTE | Idem (grupos fixos no menu) |
| Formas de Pagamento | OK | Formas de pagamento |
| Cargos | OK | Cargos |
| Frequências | OK | Frequências |
| Modelos | OK | Modelos |
| Equipamentos | OK | Equipamentos |
| Serviços | OK | Serviços |
| Marcas | OK | Marcas |
| Cupom de Desconto | PARCIAL | CRUD + validação na loja OK; sem histórico/relatório de usos (legado: `cupons_usados`) |

### Grupo Financeiro (4)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Contas à Receber | OK | Financeiro · Contas a receber (baixa, reabertura, cancelamento, auditoria) |
| Contas à Pagar | OK | Financeiro · Contas a pagar |
| Relatório Financeiro | OK | Dashboard + Relatórios · Fluxo de caixa |
| Rel. Sintético Despesas | OK | Relatórios · Sintético de despesas |
| Rel. Sintético Receber | OK | Relatórios · Sintético a receber |
| Rel. Balanço Anual | OK | Relatórios · Balanço anual |
| Rel. Inadimplentes | OK | Relatórios · Inadimplência |
| Cobranças Recorrentes | OK | Cobranças recorrentes (com gerar recebível) |
| Lista de Vendas | OK | Vendas + Relatórios · Vendas |
| Comissões | PARCIAL | Listagem/cálculo OK; sem ação de marcar comissão como paga |
| Minhas Comissões | PARCIAL | Permissão existe; falta visão restrita "só as minhas" |
| Relatório de Vendas | OK | Relatórios · Vendas |

### Grupo Caixas (7)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Caixas | OK | Caixas (abrir, sangria, fechar, quebra) |
| Relatório de Caixas | OK | Relatórios · Caixas |

### Grupo Produtos (28)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Categorias | OK | Categorias |
| SubCategorias | OK | Subcategorias |
| Produtos | OK | Produtos |
| Entradas | OK | Estoque (movimentos imutáveis) |
| Saídas | OK | Estoque |
| Estoque Baixo | OK | Relatórios · Estoque + métrica no dashboard |
| Produtos Mais Vendidos | OK | Relatórios · Produtos mais vendidos |
| Compras | OK | Compras (transacional, com itens) |

### Grupo Contratos (29)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Modelos de Contratos | OK | Modelos de contrato |
| Gerar Contratos | OK | Contratos (gera de template com variáveis) |
| Listar Contratos | OK | Contratos (+ assinatura pelo portal, extra) |

### Grupo Marketing (30)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Marketing | OK | Campanhas (agendar, disparos, falhas) |
| Grupos disparos | OK | Marketing · aba Grupos (com clientes por grupo) |

### Grupo Orçamentos (31)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Orçamentos | OK | Orçamentos (itens, técnico, status) |
| Orçamentos Pendentes | OK | Filtro status Pendente |
| Orçamentos Aprovados | OK | Filtro status Aprovado |
| Orçamentos Vencidos | PARCIAL | Não há filtro/indicador de vencido (data + dias_validade) |

### Grupo Tarefas (32)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| Tarefas | OK | Tarefas · aba Equipe |
| Lançar Tarefas | OK | Criação na própria tela |
| Tarefas Clientes | OK | Tarefas · aba Clientes |

### Grupo OS (33)
| Tela legado | Status | Onde está / lacuna |
|---|---|---|
| OS | OK | Ordens de serviço (status: Aberta, Iniciada, Em andamento, Aguardando Peça, Aguardando Aprovação, Finalizada, Entregue, Sem Reparo, Não Aprovada, Cancelada) |
| OS Abertas / Iniciadas / Aguardando / Aprovação / Finalizadas / Entregues / Sem Reparo / Não Aprovadas | OK | Cobertas pelo filtro de status (8 visões) |
| OS Entregues Hoje | PARCIAL | Sem atalho por data de hoje |

### Tabelas do legado sem tela própria
| Tabela | Status | Observação |
|---|---|---|
| arquivos | OK | Anexos (`node_attachments`) em 10 entidades |
| carrinho | OK | Loja online (carrinho + checkout + rastreio por token) |
| os_imagens | OK | Anexos em OS |
| jornada / sangrias | OK | RH ponto / Caixas sangria |
| perguntas_site / recursos_site / site / videos | OK | Site + Tutoriais |
| planos / planos_itens / planos_recursos / recursos / clientes_recursos / alertas_sas | OK | Admin SaaS |
| grupos_clientes / disparos | OK | Marketing grupos / `node_marketing_dispatch` |
| receber_sas | OK | Admin SaaS · faturamento |
| pagar_sas | AUSENTE | Contas a pagar do próprio SaaS sem tela no admin |
| tarefas_sas | AUSENTE | Tarefas do painel SaaS |
| cupons_usados | PARCIAL | Código gravado no pedido; sem histórico dedicado |
| compra_venda | AUSENTE | Texto de termo de compra/venda; confirmar uso com o negócio antes de migrar |
| temp_texto | — | Tabela temporária do legado, ignorar |

### Painel SaaS legado (`acessos_sas`, 26 telas)
O legado dava ao dono do SaaS um mini-ERP completo (fornecedores, formas de pagamento, cargos, frequências, receber/pagar, caixas, relatórios, tarefas, dispositivos, site). O Admin SaaS atual cobre dashboard, empresas, planos, recursos, mensalidades, alertas e usuários SaaS. O restante é um gap consciente: o dono pode operar como uma empresa normal dentro do próprio ERP.

### Impressões (transversal)
O legado imprimia recibo, OS e orçamento (campos `assinatura_recibo` e `impressao_automatica` na configuração). No Node, impressão hoje só existe em Relatórios (`window.print`) e nas notas fiscais. Falta impressão individual de recibo de venda, OS e orçamento.

### Extras do Node que o legado não tinha
Fiscal (NFS-e/NF-e), Portal do cliente com assinatura de contrato, Loja online com pedidos e status, auditoria (`node_audit_log`), anexos genéricos, rate limit de login, troca de senha self-service.

## Conferência dos commits de 31/07 madrugada (01:35–02:03)

- P0 Senha (`7d82a62`, 01:49): troca de senha self-service do staff (`PATCH /api/users/me/password`, exige senha atual) com tela "Alterar senha" no ERP e no admin; rate limiting nos logins (`src/middlewares/login-rate-limit.js`, 20 tentativas/15min por IP+e-mail); credenciais demo hardcoded removidas de `admin.html`/`portal.html`.
- P1 Perfis (`24b9f10`, 02:03): enforcement real de `acessar_painel` (bloqueia login no painel) e `mostrar_registros` (escopa listagens de clientes, vendas e OS/orçamentos ao próprio usuário via JWT); CRUD e permissões de usuários SaaS no admin.
- P2 Configurações/Relatórios (`24b9f10`): `settingsSchema` ampliado (~34 de ~60 campos do legado), com multa/juros aplicados automaticamente na baixa em atraso e textos padrão de ORC/OS aplicados na criação; 4 relatórios novos (balanço anual, mais vendidos, 2 sintéticos).
- `d8e2668` (01:35): a própria análise de fatoração. `0af38bc` (01:40): preferência de fluxo git (sempre main) registrada no `CLAUDE.md`.

Verificado contra o código nesta auditoria (não apenas contra os relatórios): os 4 relatórios existem como abas em `extra-pages.js`, os campos de configuração existem, o rate limit existe. Consistente.

Divergência corrigida: a tabela A.1 do `ANALISE_FATORACAO.md` estava desatualizada dentro do próprio commit (marcava como ausentes 4 relatórios que o mesmo arquivo, em outra seção, já dava como entregues). Este documento reflete o estado real.

## Backlog proposto

### P1 — funcional relevante
1. Fiscal: aba Configuração + upload do certificado A1 + classificação fiscal dos produtos. Sem isso a emissão de NFS-e/NF-e não é utilizável pela interface.
2. Comissões: ação de marcar como paga + visão "Minhas comissões".
3. Impressão de recibo de venda, OS e orçamento, respeitando `assinatura_recibo`/`impressao_automatica`.
4. Orçamentos: filtro/badge "Vencido". OS: atalho "Entregues hoje".

### P2 — menor
5. Primeiro acesso do cliente da loja: hoje o cliente criado no checkout fica sem senha e sem caminho para ativar o portal.
6. Assinatura: ação de upgrade de plano self-service (ou decisão de manter só via Admin).
7. Cupons: histórico/relatório de usos.
8. Admin SaaS: contas a pagar do SaaS (`pagar_sas`); tarefas SaaS.
9. `compra_venda`: confirmar com o negócio o que era e migrar se ainda usado.
10. Branding: upload de logo/ícone/fundo de login.
11. Campos restantes do `config` legado (avaliar um a um; parte é obsoleta).

### P3 — dependem de decisão ou infraestrutura externa
12. Recuperação de senha por e-mail e MFA (exigem provedor de e-mail e decisão de segurança).
13. Logout / revogação server-side de token.
14. Integrações WhatsApp/Asaas configuráveis por empresa (hoje variáveis de ambiente globais) + webhooks.
15. Conciliação bancária; folha de pagamento completa (rubricas/encargos).
16. CRUD de Acessos/Grupos de acesso — recomendação: manter catálogo fixo em seed, mais seguro e auditável.
17. Tela separada "Funcionários" — recomendação: manter unificado em Usuários + RH.

## Como validar esta auditoria

- Cobertura de permissões: cada `acessos`/`acessos_sas.chave` do `erp.sql` foi conferida contra `permit('<chave>')` em `src/modules/*` e a tela correspondente em `public/*`.
- Pontos duvidosos foram lidos diretamente no código-fonte (não apenas relatados por terceiros): abas de `renderReports`, `statuses`/`transitions` de `work.service.js`, `companySettingsFields`, ações de `renderCommissions`.
- Após qualquer item do backlog: `node --test`, suíte de integração e smoke visual da tela afetada.
