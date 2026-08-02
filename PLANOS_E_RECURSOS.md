# Planos, recursos e faixas de valor — desenho

Levantamento do legado + estado atual do Node, e a proposta para **planos que dividem recursos
com faixa de preço e bloqueio real**. (Investigado antes de implementar, como combinado.)

## Achado 1 — são DOIS controles diferentes, não um

O sistema tem duas dimensões de acesso, que não se confundem:

| Controle | Escopo | Pergunta que responde | Onde vive |
|---|---|---|---|
| **`acessos`** (permissões) | por **usuário/perfil** | "este funcionário pode abrir esta tela?" | `acessos` + `usuarios_permissoes` |
| **`recursos`** (features do plano) | por **empresa/assinatura** | "a empresa contratou este módulo?" | `recursos` + `clientes_recursos` |

O acesso efetivo é a **interseção**: `recursos_da_empresa ∩ permissões_do_perfil`. Um Gerente com
permissão de "Orçamentos" só vê Orçamentos se **o plano da empresa** incluir esse recurso.

No legado isso estava em `verificar_permissoes_recursos.php`: carregava `clientes_recursos` da
empresa e escondia do menu o que não estava no plano.

## Achado 2 — o modelo de dados JÁ ESTÁ no Node; falta o bloqueio

Portado do legado e já presente:

- Tabelas: `planos`, `planos_itens`, `recursos` (**32 recursos cadastrados**), `planos_recursos`,
  `clientes_recursos`. `empresas.plano` e `empresas.mensalidade`.
- Painel SaaS já tem CRUD: criar/editar **planos** (`/api/admin/plans`), criar/editar **recursos**
  (`/api/admin/resources`) e **marcar quais recursos cada plano libera** (`/api/admin/plans/:id/resources`).

**O que falta (é aqui que "bloquear de verdade" mora):**

1. **Login não carrega os recursos da empresa.** `auth.service.js` devolve as `permissions` (do
   perfil), mas não os `recursos` do plano. Então o front não tem como esconder módulo de plano.
2. **Não há middleware de recurso.** As rotas checam `permit(<permissão>)`, mas nada checa se a
   empresa tem o recurso. Uma empresa do plano básico consegue chamar a API de um módulo premium.
3. **`clientes_recursos` não é preenchido ao atribuir o plano.** Escolher o plano da empresa não
   propaga os `planos_recursos` para `clientes_recursos`.
4. **A sidebar não filtra por recurso** — só por permissão.

Ou seja: hoje o sistema **precifica mas não bloqueia**. O pedido é ligar o bloqueio.

## Achado 3 — o legado como referência de faixa

O legado tinha 4 faixas fixas por pacote de recursos:

| Plano | Valor | Ideia |
|---|---|---|
| Bronze | R$ 120 | núcleo |
| Prata | R$ 140 | + alguns módulos |
| Ouro | R$ 160 | + contratos/orçamentos |
| Diamante | R$ 180 | tudo |

Faixa **por pacote de recursos** (não por volume). Vou seguir a mesma lógica, com preços de mercado
atuais de ERP SaaS pra pequeno negócio (Bling/Tiny/Nex ~R$ 60–360/mês).

---

## Proposta — 4 planos, faixa de mercado, recursos divididos

### Recursos SEMPRE incluídos (núcleo — todo plano tem)
`dashboard`, `clientes`, `fornecedores`, `produtos_servicos`, `vendas_pdv`, `estoque`,
`financeiro`, `cadastros_auxiliares`, `usuarios`, `configuracoes`, `relatorios`, `anexos`,
`tarefas`, `anotacoes`, `assinatura`, `tutoriais`.

### Divisão por plano (add-ons premium)

| Recurso premium | Essencial | Profissional | Avançado | Enterprise |
|---|:--:|:--:|:--:|:--:|
| **Faixa de preço/mês** | **R$ 69** | **R$ 139** | **R$ 249** | **R$ 449** |
| Comissões | · | ✅ | ✅ | ✅ |
| Cupons | · | ✅ | ✅ | ✅ |
| Compras | · | ✅ | ✅ | ✅ |
| Chamados | ✅ | ✅ | ✅ | ✅ |
| Marketing WhatsApp | · | ✅ | ✅ | ✅ |
| Orçamentos | · | ✅ | ✅ | ✅ |
| Ordens de serviço | · | ✅ | ✅ | ✅ |
| Cobranças recorrentes | · | · | ✅ | ✅ |
| Contratos | · | · | ✅ | ✅ |
| Emissão fiscal NF-e/NFS-e | · | · | ✅ | ✅ |
| Portal do cliente | · | · | ✅ | ✅ |
| Loja online | · | · | ✅ | ✅ |
| Recursos humanos | · | · | · | ✅ |
| Auditoria | · | · | · | ✅ |
| Multiusuário (limite) | 2 | 5 | 15 | ilimitado |

Faixas escolhidas para escada clara (~2x entre níveis), alinhadas ao mercado brasileiro de ERP para
micro/pequena empresa. São editáveis no painel SaaS — a tabela é só o ponto de partida.

> Alternativa/【combinável】: **faixa por volume** dentro do mesmo plano (ex.: Profissional até 5
> usuários R$ 139; 6–15 R$ 199). Os campos de limite já cabem em `planos` (`limite_usuarios`). Dá
> para fazer depois sem refazer nada.

---

## Como o BLOQUEIO REAL vai funcionar (plano de implementação)

1. **Recurso ↔ rota.** Mapear cada recurso premium para as chaves de `permit(...)` que ele cobre
   (ex.: recurso `orcamentos` → rotas de orçamento). Uma tabela/objeto de-para no código.
2. **Provisionar `clientes_recursos`.** Ao atribuir/trocar o plano de uma empresa no painel SaaS,
   copiar os `planos_recursos` do plano para `clientes_recursos` da empresa (substituindo). Núcleo
   sempre entra.
3. **Login carrega os recursos.** `auth.service.js` passa a devolver `resources` (chaves de
   `clientes_recursos` da empresa) junto das `permissions`.
4. **Middleware `feature(<recurso>)`.** Nas rotas premium, além do `permit`, exigir que a empresa
   tenha o recurso — senão HTTP 402/403 ("recurso não incluído no seu plano").
5. **Sidebar filtra por recurso.** O front esconde a guia quando o recurso não está no plano da
   empresa (igual já faz com permissão), e mostra um selo "Faça upgrade" opcional.
6. **Admin bypass e empresa 0.** Administrador do sistema e o painel SaaS não são limitados por
   recurso (só o lojista é).

### Verificação prevista
- Sondas: empresa no Essencial recebe 403 na API de Orçamentos e não vê a guia; ao subir para
  Profissional, passa a ver e usar. Empresa sem plano cai num conjunto núcleo seguro.
- Testes unitários do de-para recurso→rota e do middleware; browser test do bloqueio na sidebar.

## Decisões que restam para você
- **Preços**: confirmar as 4 faixas (R$ 69 / 139 / 249 / 449) ou ajustar.
- **Divisão**: mover algum recurso de plano (ex.: fiscal poderia ser add-on avulso).
- **Volume**: incluir limite de usuários por plano já agora, ou só pacote de recursos primeiro.
- **Plano sem assinatura**: empresa sem plano definido = núcleo mínimo, ou bloqueada?
