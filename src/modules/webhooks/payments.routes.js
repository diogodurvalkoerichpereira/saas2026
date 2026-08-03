'use strict';

// Webhook de pagamento: o provedor avisa quando o dinheiro entra, e a mensalidade é quitada sozinha
// (aplicando a troca de plano, quando a cobrança é de upgrade).
//
// Este endpoint é PÚBLICO — quem chama é o servidor do provedor, sem sessão. Duas regras seguem
// disso, e as duas são obrigatórias:
//
// 1. AUTENTICIDADE. Qualquer um pode fazer POST aqui. Mercado Pago assina a notificação (HMAC
//    SHA-256 no cabeçalho `x-signature`) e o Asaas manda um token fixo em `asaas-access-token`.
//    Sem segredo configurado o webhook é RECUSADO, em vez de aceitar qualquer chamada: um endpoint
//    que quita mensalidade sem verificar quem chamou é dinheiro de graça para quem descobrir a URL.
//
// 2. NUNCA CONFIAR NO CORPO. Mesmo assinado, o payload só é usado para saber QUAL pagamento
//    consultar. Status e valor vêm de uma consulta à API do provedor, com a nossa credencial.
//    Assim uma notificação forjada — ou repetida com o corpo adulterado — não quita nada.

const express = require('express');
const crypto = require('node:crypto');
const router = express.Router();
const { pool } = require('../../config/database');
const { loadIntegrations } = require('../../services/company-integrations');
const { providers } = require('../../integrations/payment.providers');
const { confirmarPagamento } = require('../../services/billing-confirm.service');

const SAAS = 0;

// Comparação em tempo constante, para o tempo de resposta não revelar o segredo caractere a
// caractere. Comprimentos diferentes já saem como falso, sem vazar nada.
function segredoConfere(recebido, esperado) {
  const a = Buffer.from(String(recebido || ''), 'utf8');
  const b = Buffer.from(String(esperado || ''), 'utf8');
  if (!a.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Mercado Pago: x-signature vem como "ts=1699999999,v1=<hmac>". O HMAC é calculado sobre
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com o segredo do webhook.
function mercadoPagoAutentico({ headers, paymentId, secret }) {
  const assinatura = String(headers['x-signature'] || '');
  const partes = Object.fromEntries(assinatura.split(',').map((p) => p.split('=').map((s) => s.trim())));
  if (!partes.ts || !partes.v1) return false;
  const requestId = String(headers['x-request-id'] || '');
  const manifest = `id:${paymentId};request-id:${requestId};ts:${partes.ts};`;
  const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return segredoConfere(partes.v1, esperado);
}

// Identifica o pagamento citado na notificação. Só o ID: o resto vem da consulta à API.
function extrairPagamento(provedor, req) {
  if (provedor === 'Mercado Pago') {
    return req.body?.data?.id || req.query['data.id'] || req.query.id || null;
  }
  return req.body?.payment?.id || req.body?.id || null;
}

router.post('/payments/:provedor', express.json({ limit: '256kb' }), async (req, res) => {
  // Sempre 200 para o provedor quando a notificação é legítima mas não temos o que fazer com ela:
  // 4xx/5xx fazem o Mercado Pago e o Asaas reenviarem por horas. Recusa mesmo (401) fica reservada
  // para assinatura inválida, que é o caso em que queremos que ele pare.
  const responder = (motivo) => res.status(200).json({ recebido: true, motivo });
  try {
    const slug = String(req.params.provedor || '').toLowerCase();
    const provedor = slug === 'mercadopago' ? 'Mercado Pago' : slug === 'asaas' ? 'Asaas' : null;
    if (!provedor) return res.status(404).json({ error: 'Provedor desconhecido.' });

    const config = await loadIntegrations(SAAS);
    if (config?.api_pagamento !== provedor) return responder('provedor não configurado');

    // `loadIntegrations` já devolve os segredos decifrados.
    const segredo = config.webhook_pagamento;
    if (!segredo) return res.status(401).json({ error: 'Webhook não configurado.' });

    const paymentId = extrairPagamento(provedor, req);
    if (!paymentId) return responder('notificação sem id de pagamento');

    const autentico = provedor === 'Mercado Pago'
      ? mercadoPagoAutentico({ headers: req.headers, paymentId, secret: segredo })
      : segredoConfere(req.headers['asaas-access-token'], segredo);
    if (!autentico) return res.status(401).json({ error: 'Assinatura inválida.' });

    // A partir daqui a notificação é legítima. O status vem da API, nunca do corpo recebido.
    const credencial = config[providers[provedor].secretField];
    if (!credencial) return responder('sem credencial para consultar o pagamento');
    const pagamento = await providers[provedor].getPayment({ secret: credencial, paymentId });
    if (!pagamento?.paid) return responder(`pagamento em ${pagamento?.status || 'status desconhecido'}`);

    const [contas] = await pool.execute(
      "SELECT id FROM receber_sas WHERE cobranca_id = ? AND pago = 'Não' ORDER BY id DESC LIMIT 1",
      [String(paymentId)]
    );
    if (!contas[0]) return responder('nenhuma mensalidade em aberto para esta cobrança');

    const resultado = await confirmarPagamento({ billingId: contas[0].id, userId: null, origem: `webhook:${provedor}` });
    return res.status(200).json({
      recebido: true,
      mensalidade: resultado.id,
      jaEstavaPaga: resultado.jaEstavaPaga,
      upgrade: resultado.upgrade?.nome ?? null
    });
  } catch (error) {
    // Erro nosso (banco fora, provedor fora): 500 faz o provedor reenviar, que é o que queremos.
    // O motivo vai para o log do servidor — um 500 silencioso aqui é impossível de investigar
    // depois, e o cliente do outro lado é o provedor, que não deve receber detalhe interno.
    console.error('[webhook] falha ao processar notificação de pagamento:', error);
    return res.status(500).json({ error: 'Falha ao processar a notificação.' });
  }
});

module.exports = router;
