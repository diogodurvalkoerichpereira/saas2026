'use strict';

// Provedores de pagamento suportados, espelhando o legado (config.api_pagamento), onde cada
// empresa escolhia o seu: '' (nenhuma), 'Mercado Pago' ou 'Asaas'.
//
// Credenciais por empresa, com nomes diferentes em cada API:
//   Asaas        → chave_api_asaas, enviada no cabeçalho `access_token`
//   Mercado Pago → access_token (segredo, Bearer) + public_key (pública, usada no checkout)

const { requestJson } = require('./http-client');

const ASAAS_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const MERCADOPAGO_URL = process.env.MERCADOPAGO_API_URL || 'https://api.mercadopago.com';

// Traduz o vocabulário de cada provedor para um formato único, para o resto do app não
// precisar saber quem processou o pagamento.
const asaasPaid = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const mpTypes = {
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  ticket: 'Boleto',
  bank_transfer: 'Pix',
  account_money: 'Saldo Mercado Pago'
};

// A ordem de declaração é a ordem do select na tela — a mesma do legado.
const providers = {
  'Mercado Pago': {
    label: 'Mercado Pago',
    secretField: 'access_token',
    async getPayment({ secret, paymentId }) {
      const data = await requestJson(`${MERCADOPAGO_URL}/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { authorization: `Bearer ${secret}` }
      });
      return {
        provider: 'Mercado Pago',
        id: data?.id ?? paymentId,
        status: data?.status ?? null,
        paid: data?.status === 'approved',
        amount: data?.transaction_amount ?? null,
        method: mpTypes[data?.payment_type_id] || data?.payment_method_id || null
      };
    }
  },
  Asaas: {
    label: 'Asaas',
    secretField: 'chave_api_asaas',
    async getPayment({ secret, paymentId }) {
      const data = await requestJson(`${ASAAS_URL}/payments/${encodeURIComponent(paymentId)}`, {
        headers: { access_token: secret }
      });
      return {
        provider: 'Asaas',
        id: data?.id ?? paymentId,
        status: data?.status ?? null,
        paid: asaasPaid.has(String(data?.status)),
        amount: data?.value ?? null,
        method: data?.billingType ?? null
      };
    }
  }
};

// Opções da tela de configurações — '' é "não usar API de pagamento", como no legado.
const providerOptions = [
  { value: '', label: 'Nenhuma (cobrança manual)' },
  ...Object.entries(providers).map(([value, { label }]) => ({ value, label }))
];

const isDisabled = (name) => !name || !providers[name];

module.exports = { providers, providerOptions, isDisabled };
