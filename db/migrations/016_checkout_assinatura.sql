-- Dados de cobrança da assinatura, coletados quando o visitante clica em Assinar.
--
-- `receber_sas` guarda a mensalidade do SaaS. Faltava onde anotar a cobrança aberta no provedor:
-- sem o id não dá para conciliar o pagamento depois, e sem o link o cliente não tem como pagar
-- fora do momento do cadastro (fechou a aba, quer pagar amanhã, quer mandar o boleto ao contador).
--
-- Não há coluna para dado de cartão, e isso é deliberado: número e CVV nunca chegam ao servidor.
-- O cliente digita o cartão na página de pagamento do próprio provedor (Asaas invoiceUrl,
-- Mercado Pago init_point). Ver a nota no topo de src/services/checkout.service.js.

ALTER TABLE receber_sas ADD COLUMN IF NOT EXISTS cobranca_id VARCHAR(60) NULL;
ALTER TABLE receber_sas ADD COLUMN IF NOT EXISTS cobranca_url VARCHAR(500) NULL;
ALTER TABLE receber_sas ADD COLUMN IF NOT EXISTS cobranca_metodo VARCHAR(20) NULL;

-- Achar a mensalidade a partir do aviso do provedor (webhook ou consulta de status).
CREATE INDEX IF NOT EXISTS idx_receber_sas_cobranca ON receber_sas (cobranca_id);
