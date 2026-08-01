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

1. ✅ **Imagem em produto e serviço** — upload no cadastro, armazenamento no volume `/app/uploads`,
   gravar nome em `produtos.foto`/`servicos.foto`, servir e exibir. Reaproveita a infra de
   `src/modules/files`. *(commit `fdaa2bd`)*
2. ✅ **PDV de caixa** — campo de código de barras que busca produto por `codigo` e adiciona, imagem,
   total e troco ao vivo, desconto. *(commit `dae87d8`)*
3. ✅ **Vínculo venda ↔ caixa** — usar o caixa aberto do operador e gravar `receber.caixa` em
   `createSale` (espelha `vendas.php:10-20`). Sem caixa aberto a venda ainda é registrada, com
   `caixa = NULL`. *(commit `18b468d`)*
4. ✅ **Gerar código de barras** — Code128-B do campo `codigo` na etiqueta do produto, com escolha de
   cópias e impressão. Encoder próprio em `public/js/barcode.mjs`, sem dependência externa,
   validado por round-trip de decodificação. *(commit `8585a82`)*
5. ✅ **Provedor de WhatsApp por empresa** — ver seção 5 abaixo.

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

**Consequência:** funcionava para uma empresa só. Num SaaS multiempresa, **todas as empresas
compartilhavam a mesma configuração** de WhatsApp/pagamento.

### Provedores de WhatsApp — o legado deixava a empresa escolher

`config.api_whatsapp` no legado **não é uma URL**: é o **provedor escolhido**, com quatro valores
(`painel/index.php:1288-1292`), e cada um tem endpoint, codificação e nomes de campo próprios
(`painel/apis/texto.php`):

| Valor | Provedor | Endpoint | Corpo | Credenciais |
|---|---|---|---|---|
| `Não` | — | — | — | envio desligado |
| `menuia` | Menuia | `POST chatbot.menuia.com/api/create-message` | form-urlencoded | `appkey` = token, `authkey` = instância |
| `wm` | WordMensagens | `POST api.wordmensagens.com.br/send-text` | form-urlencoded | `token`, `instance` |
| `newtek` | NewTek | `POST webapi.newteksoft.com.br/enviar-texto` | JSON | `token`, `instancia`, `para: [tel]` |

O Node tratava `api_whatsapp` como texto livre ("URL da API") e mandava um corpo genérico
(`/messages` + `Bearer`) que **não casa com nenhum dos três** — não funcionaria com nenhum provedor real.

**Implementado** (`src/integrations/whatsapp.providers.js` + `whatsapp.client.js`):

- Os três provedores reais, cada um no formato que a sua API espera, com testes que travam o
  formato do corpo (`test/whatsapp.providers.test.js`).
- `api_whatsapp` virou **seleção** na tela de Configurações, validada no backend contra a mesma lista.
- Cada disparo sai pelo provedor **da empresa dona da campanha** (`marketing.job.js` passa
  `dispatch.empresa`), com fallback para a config por ambiente quando a empresa não escolheu nada.
- `GET /api/marketing/status` passou a reportar o provedor **daquela empresa**, e
  `POST /api/marketing/test-message` envia um teste para o telefone do próprio usuário
  (espelha `teste_whatsapp.php`).
- O token continua **write-only**: nunca é devolvido pela API, só o indicador de configurado.

Pendências conscientes desta parte:

- `alterar_api_whatsapp` — flag de plataforma do legado (em `config WHERE empresa = 0`) que decide se
  o lojista pode escolher o provedor ou herda o da plataforma. Não portada: hoje toda empresa escolhe.
- O endpoint do WordMensagens é **http://** no legado (token em texto puro). Mantido como padrão para
  não quebrar quem já usa, mas sobrescrevível por `WHATSAPP_WM_URL`.
- `licence` da menuia variava por instalação no legado; virou `WHATSAPP_MENUIA_LICENCE`.
- Chaves de **pagamento** por empresa (`chave_api_asaas`, `access_token`, `public_key`) continuam
  pendentes — e exigem criptografia em repouso antes de sair do ambiente.

## Cabeçalho (navbar) — auditado em todos os perfis

O navbar do legado tinha, no menu do perfil: **Perfil · Configurações · Painel SAAS · Sair**
(`painel/index.php:457-485`). O Node tinha saudação, sinos, tema, "Alterar senha" e "Sair", mas
**nenhum atalho para Configurações** — justamente a tela onde o WhatsApp é conectado.

- Adicionado o atalho **Configurações** ao cabeçalho, com a mesma regra de permissão da sidebar
  (`data-permission="configuracoes,home"`).
- "Painel SAAS" não foi replicado: no Node o painel do SaaS é uma aplicação à parte (`/admin.html`)
  com login próprio — isolamento melhor que o do legado, mantido de propósito.

**Bug encontrado e corrigido durante a auditoria:** a Visão geral chamava `/api/reports/financial`,
restrito a Administrador/Gerente/Tesoureiro/Financeiro. Nos perfis **Comum** e **Técnico** a chamada
dava 403 e, por estar num `Promise.all`, derrubava a tela inteira — os dois perfis viam
*"Não foi possível abrir este módulo"* como página inicial. Agora os indicadores financeiros são
opcionais e cada perfil vê o que pode. Coberto por `e2e/header.spec.js`, que exercita os 6 perfis.

## Notas

- O legado usa interpolação direta de `$_POST` em SQL (injeção) — **não** replicar; o Node já usa
  parâmetros. Portamos a *funcionalidade*, não a implementação insegura.
- `produtos.foto`/`servicos.foto` já existem no schema — só falta o app usá-las.
- O módulo de caixa (`operations`) já existe; falta apenas a venda alimentá-lo.
- Guardar chaves de pagamento/WhatsApp por empresa no banco exige cuidado de segurança
  (criptografia em repouso, nunca exibir a chave de volta) — o legado guardava em texto puro.
