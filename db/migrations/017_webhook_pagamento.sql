-- Segredo do webhook de pagamento, por empresa (o do SaaS mora na linha da empresa 0).
--
-- É com ele que a notificação do provedor é verificada: Mercado Pago assina o aviso com HMAC
-- SHA-256 e o Asaas manda um token fixo no cabeçalho. Sem este segredo o webhook é recusado — um
-- endpoint que quita mensalidade sem conferir quem chamou é dinheiro de graça para quem descobrir
-- a URL.
--
-- TEXT porque o valor fica cifrado em repouso (AES-256-GCM/base64), como as demais credenciais:
-- a cifra é bem maior que o segredo original e um VARCHAR curto truncaria em silêncio.

ALTER TABLE config ADD COLUMN IF NOT EXISTS webhook_pagamento TEXT NULL;
