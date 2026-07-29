# Configuração de Ambiente

Crie um arquivo `.env` local a partir de `.env.example`. Nunca envie o `.env` ao Git.

## Aplicação

| Variável | Uso |
|---|---|
| `NODE_ENV` | Ambiente: `development`, `test` ou `production`. |
| `PORT` | Porta HTTP da API. |
| `CORS_ORIGIN` | URL permitida do frontend. |
| `JWT_SECRET` | Chave longa e exclusiva para assinar sessões. |

## Banco MySQL

| Variável | Uso |
|---|---|
| `DATABASE_HOST` | Servidor MySQL. |
| `DATABASE_PORT` | Porta MySQL. |
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
