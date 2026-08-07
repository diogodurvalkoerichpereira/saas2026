-- Teste grátis passa de 3 para 14 dias, e os textos da landing acompanham.
--
-- Motivo: migrar para um ERP exige cadastrar produtos, clientes e saldo de estoque. Três dias dão
-- para OLHAR, não para trocar de sistema — e quem não termina a migração não vira cliente, por
-- melhor que o produto seja. Catorze dias é o padrão do mercado e é tempo de a empresa colocar
-- dado real dentro, que é o momento em que ela decide ficar.
--
-- O prazo em si agora vive em src/config/trial.js (TRIAL_DAYS, ajustável por ambiente). Esta
-- migração só acerta o CONTEÚDO já gravado, que é editável pelo painel.
--
-- Cada UPDATE compara com o texto exato semeado na migração 013. Se o administrador já reescreveu
-- a frase, o WHERE não casa e a edição dele fica intacta — atualizar conteúdo de tela sem essa
-- guarda é apagar trabalho alheio em silêncio.

UPDATE site SET subtitulo = 'ERP completo — vendas, financeiro, estoque e muito mais. Comece com 14 dias grátis, sem cartão. Cancele quando quiser.'
 WHERE empresa = 0
   AND subtitulo = 'ERP completo — vendas, financeiro, estoque e muito mais. Comece com 3 dias grátis, sem cartão. Cancele quando quiser.';

UPDATE site SET item1 = '14 dias grátis'
 WHERE empresa = 0 AND item1 = '3 dias grátis';

UPDATE site SET descricao_rodape = 'Crie sua conta em menos de um minuto e teste o sistema completo por 14 dias, sem cartão de crédito.'
 WHERE empresa = 0
   AND descricao_rodape = 'Crie sua conta em menos de um minuto e teste o sistema completo por 3 dias, sem cartão de crédito.';

UPDATE config SET meta_descricao = 'ERP completo: vendas, financeiro, estoque, fiscal e mais. Comece com 14 dias grátis.'
 WHERE empresa = 0
   AND meta_descricao = 'ERP completo: vendas, financeiro, estoque, fiscal e mais. Comece com 3 dias grátis.';

UPDATE perguntas_site SET descricao_pergunta = 'Não. O teste de 14 dias começa assim que você cria a conta, sem informar cartão. A cobrança só existe se você decidir continuar.'
 WHERE empresa = 0
   AND descricao_pergunta = 'Não. O teste de 3 dias começa assim que você cria a conta, sem informar cartão. A cobrança só existe se você decidir continuar.';

-- Quem assinou nos últimos dias entrou com 3 dias e ainda está dentro do período: estende para os
-- 14, para ninguém ser cortado por uma regra que mudou depois de a pessoa entrar. Empresas cujo
-- teste já venceu não são reabertas — isso seria devolver acesso que alguém pode ter encerrado
-- de propósito.
UPDATE empresas
   SET dias_teste = 14,
       data_teste = data_cad + INTERVAL '14 days'
 WHERE id > 0
   AND dias_teste = 3
   AND data_teste >= CURRENT_DATE;
