-- Configuração de pagamento por empresa (espelha o legado: config.api_pagamento).
-- Cada empresa escolhe o próprio provedor e guarda as próprias credenciais.

ALTER TABLE config ADD COLUMN IF NOT EXISTS api_pagamento VARCHAR(30) NULL;
ALTER TABLE config ADD COLUMN IF NOT EXISTS dados_pagamento TEXT NULL;

-- Segredos passam a ser gravados cifrados (AES-256-GCM em base64), o que é bem maior que o
-- valor original: VARCHAR(70)/(255) estouraria e truncaria a chave em silêncio.
-- public_key NÃO entra aqui: a chave pública do Mercado Pago não é segredo e continua em texto.
ALTER TABLE config ALTER COLUMN token_whatsapp TYPE TEXT;
ALTER TABLE config ALTER COLUMN access_token TYPE TEXT;
ALTER TABLE config ALTER COLUMN chave_api_asaas TYPE TEXT;
