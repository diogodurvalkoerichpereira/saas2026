# Configuração de Ambiente

Crie um arquivo `.env` local a partir de `.env.example`. Nunca envie o `.env` ao Git.

## Ambiente Docker descartável

`compose.test.yml` inicia a aplicação e um PostgreSQL 16 com fixtures fictícias. A aplicação fica disponível em `http://localhost:3000` e o banco em `127.0.0.1:5433`.

Credencial exclusiva de teste: `teste.local@saas2026.local` / `Teste@2026`.

Esse ambiente não lê o backup real e não deve ser reutilizado em produção.

## Aplicação

| Variável | Uso |
|---|---|
| `NODE_ENV` | Ambiente: `development`, `test` ou `production`. |
| `PORT` | Porta HTTP da API. |
| `CORS_ORIGIN` | URL permitida do frontend. |
| `JWT_SECRET` | Chave longa e exclusiva para assinar sessões. |

## Banco PostgreSQL

| Variável | Uso |
|---|---|
| `DATABASE_HOST` | Servidor PostgreSQL. |
| `DATABASE_PORT` | Porta PostgreSQL (5432). |
| `DATABASE_NAME` | Nome do banco do ERP. |
| `DATABASE_USER` | Usuário do banco. |
| `DATABASE_PASSWORD` | Senha do banco. |

## Pagamentos

| Variável | Uso |
|---|---|
| `ASAAS_API_KEY` | Chave da integração Asaas. |
| `MERCADO_PAGO_ACCESS_TOKEN` | Token privado Mercado Pago, se a integração for mantida. |
| `MERCADO_PAGO_PUBLIC_KEY` | Chave pública Mercado Pago. |
| `PAYMENT_WEBHOOK_SECRET` | Segredo para validar webhooks de pagamento. |

## WhatsApp

| Variável | Uso |
|---|---|
| `WHATSAPP_API_URL` | Endereço do provedor de WhatsApp. |
| `WHATSAPP_API_TOKEN` | Token do provedor. |
| `WHATSAPP_INSTANCE_ID` | Identificador da instância, quando aplicável. |

## Nota fiscal

| Variável | Uso |
|---|---|
| `FISCAL_PROVIDER` | Provedor fiscal selecionado. |
| `FISCAL_API_URL` | Endpoint do provedor. |
| `FISCAL_API_KEY` | Credencial de emissão fiscal. |
| `FISCAL_WEBHOOK_SECRET` | Segredo para eventos fiscais. |
| `FISCAL_CERTIFICATE_PATH` | Caminho local do certificado, quando exigido. |
| `FISCAL_CERTIFICATE_PASSWORD` | Senha do certificado, quando exigido. |

## Rotação de credenciais

1. Revogue as chaves antigas nos painéis dos respectivos provedores.
2. Gere novas chaves e grave-as somente no ambiente de execução.
3. Reinicie a aplicação após a atualização.
4. Verifique logs e webhooks sem registrar tokens ou senhas.
