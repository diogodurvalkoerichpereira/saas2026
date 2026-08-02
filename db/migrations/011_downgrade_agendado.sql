-- Downgrade de plano: diferente do upgrade, não cobra nada e não vale na hora. O ciclo atual já
-- foi pago, então o cliente mantém o acesso contratado até o vencimento e a troca é AGENDADA para
-- a próxima renovação. Estas colunas guardam esse agendamento.
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plano_agendado INT NULL;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plano_agendado_em DATE NULL;
