'use strict';

// Período de teste grátis da assinatura — fonte única.
//
// Era 3 dias, cravado em seis lugares diferentes (rota de assinatura, textos da página, seed do
// conteúdo, FAQ). Migrar para um ERP exige cadastrar produtos, clientes e saldo de estoque: três
// dias dão para OLHAR, não para trocar de sistema, e quem não termina a migração não converte.
// Catorze dias é o padrão do mercado para software de gestão e é tempo de a empresa colocar dado
// real dentro — que é o momento em que ela decide ficar.
//
// Configurável por ambiente para dar espaço a teste de conversão sem deploy.
const TRIAL_DAYS = Math.max(0, Number(process.env.TRIAL_DAYS) || 14);

// Data em que o teste termina — é também o vencimento da primeira mensalidade, para a cobrança
// cair depois do período grátis, como a página promete.
const trialEndDate = (from = new Date()) =>
  new Date(from.getTime() + TRIAL_DAYS * 86400000).toISOString().slice(0, 10);

// Texto pronto para a interface, no singular ou plural certo.
const trialLabel = () => (TRIAL_DAYS === 1 ? '1 dia grátis' : `${TRIAL_DAYS} dias grátis`);

module.exports = { TRIAL_DAYS, trialEndDate, trialLabel };
