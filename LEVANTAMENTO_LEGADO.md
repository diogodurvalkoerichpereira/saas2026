# Levantamento — Legado (PHP) × Node

Comparação funcional entre o ERP legado (`diogodurvalkoerichpereira/saaslegado`, PHP/PDO) e a
versão Node, feita a partir do **código-fonte real do legado**. Foco em funcionalidades e telas.

## Cobertura de telas — visão geral

Quase todas as ~50 telas do legado (`painel/paginas/*.php`) têm módulo correspondente no Node,
inclusive os relatórios (o Node tem 10+ em `src/modules/reports`). As lacunas relevantes **não são
telas inteiras faltando**, e sim **funcionalidades dentro de três telas**: cadastro de produto,
cadastro de serviço e o PDV/caixa.

## Lacunas confirmadas (com evidência no legado)

### 1. Cadastro de Produto
| Funcionalidade | Evidência no legado | Node hoje |
|---|---|---|
| Upload de imagem | `painel/paginas/produtos/salvar.php`: `move_uploaded_file` → `images/produtos/`, apaga foto antiga, valida extensão e máx. 1400px | ❌ `foto` fica sempre `'sem-foto.jpg'` — sem upload no formulário |
| Gerar código de barras (etiqueta) | `painel/paginas/produtos/gerar-codigo.php` → `bar128()` (Code128) | ❌ ausente |

### 2. Cadastro de Serviço
| Funcionalidade | Evidência | Node hoje |
|---|---|---|
| Upload de imagem | `painel/paginas/servicos/salvar.php`: `move_uploaded_file` → `images/servicos/` | ❌ campo `foto` nem existe no formulário |

### 3. PDV / Caixa do operador (`painel/paginas/vendas.php`)
| Funcionalidade | Evidência (linhas) | Node hoje |
|---|---|---|
| Exige caixa aberto | 10-20: sem caixa aberto → alerta e redireciona | ❌ venda não é vinculada a caixa |
| Leitor de código de barras com bip | 810-842: Enter → busca por `codigo` → adiciona → toca `barCode.wav` | ❌ só lista suspensa (`<select>`) |
| Imagem do produto no PDV | grid com `foto` | ❌ sem imagem |
| Checkout de caixa: valor pago, **troco**, desconto, total restante ao vivo | 171-216 | ❌ só "pagamento imediato Sim/Não", sem troco nem total ao vivo |

O legado tinha um **PDV de operador de caixa completo**; o Node tem hoje um **formulário de
lançamento de venda** de retaguarda (funciona, integra estoque e financeiro, mas não é a tela de caixa).

## Plano de implementação (ordem de impacto)

1. **Imagem em produto e serviço** — upload no cadastro, armazenamento no volume `/app/uploads`,
   gravar nome em `produtos.foto`/`servicos.foto`, servir e exibir. Reaproveita a infra de
   `src/modules/files`.
2. **PDV de caixa** — campo de código de barras que busca produto por `codigo` e adiciona, imagem,
   total e troco ao vivo, desconto.
3. **Vínculo venda ↔ caixa** — exigir/усar caixa aberto e gravar `receber.caixa` em `createSale`
   (espelha `vendas.php:10-20`).
4. **Gerar código de barras** — Code128 do campo `codigo` para etiqueta.

## Auditoria da sidebar / navbar / APIs

Verificado empiricamente (navegando como admin e como perfil comum):

- **Por perfil não falta guia**: admin e "comum" veem exatamente as mesmas 51 entradas. As
  permissões (`acessos` + `usuarios_permissoes`) estão completas; o admin ignora permissões
  (`app.js:108-110`).
- **As 39 rotas do menu renderizam e chamam a API sem erro** — nenhuma guia quebrada.

Diferenças de organização em relação ao legado:

- **"Grupos de disparos" e "Dispositivos"** existem, mas como **abas dentro de Marketing**
  (`#/marketing?tab=groups` / `?tab=devices`). No legado eram itens de menu separados
  ("Conectar Whatsapp" abria `dispositivos`).
- **"Grupo de acessos"** (grupos de permissão) do legado (`painel/paginas/grupo_acessos`) não foi
  portado — o Node gerencia permissão por usuário, não por grupo.

## 5. Configuração de integrações por empresa (WhatsApp e pagamento) — regressão multiempresa

No **legado**, cada empresa configurava suas próprias integrações **pela interface**, salvas na
tabela `config` por empresa:

- **WhatsApp**: navbar "Conectar Whatsapp" → `painel/paginas/dispositivos/appkey.php` grava
  `config.token_whatsapp` e `config.instancia_whatsapp`.
- **Pagamento**: modal "Alterar Configurações" (`painel/index.php:1160`) com dados/chaves de pagamento.

No **Node**:

- As colunas por empresa **existem** em `config` (`token_whatsapp`, `instancia_whatsapp`,
  `chave_api_asaas`, `access_token`, `public_key`, `api_whatsapp`) — vieram do schema.
- **Mas o app não as usa**: lê WhatsApp/pagamento de **variável de ambiente global** (a própria tela
  diz "Integração configurada por ambiente"), e a tela de Configurações não expõe esses campos.

**Consequência:** funciona para uma empresa só. Num SaaS multiempresa, hoje **todas as empresas
compartilham a mesma configuração** de WhatsApp/pagamento — cada empresa não consegue conectar o seu.
É a lacuna mais relevante para o modelo SaaS, embora não bloqueie um deploy de empresa única.

## Notas

- O legado usa interpolação direta de `$_POST` em SQL (injeção) — **não** replicar; o Node já usa
  parâmetros. Portamos a *funcionalidade*, não a implementação insegura.
- `produtos.foto`/`servicos.foto` já existem no schema — só falta o app usá-las.
- O módulo de caixa (`operations`) já existe; falta apenas a venda alimentá-lo.
- Guardar chaves de pagamento/WhatsApp por empresa no banco exige cuidado de segurança
  (criptografia em repouso, nunca exibir a chave de volta) — o legado guardava em texto puro.
