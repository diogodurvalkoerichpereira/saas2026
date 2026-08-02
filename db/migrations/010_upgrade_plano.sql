-- Upgrade de plano pelo painel do lojista (espelha programar_upgrade.php + aprovar_plano.php).
-- A cobrança de ajuste precisa saber para QUAL plano o upgrade aponta: o legado guardava em
-- receber_sas.id_ref. A coluna não veio na migração do schema; criada aqui.
ALTER TABLE receber_sas ADD COLUMN IF NOT EXISTS id_ref INT NULL;
ALTER TABLE receber_sas ADD COLUMN IF NOT EXISTS frequencia INT NULL;

-- Índice para achar rapidamente a cobrança de upgrade em aberto de uma empresa.
CREATE INDEX IF NOT EXISTS idx_receber_sas_cliente_ref ON receber_sas (cliente, referencia);
