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

// Formas de pagamento oferecidas no checkout, com o nome de cada uma em cada provedor.
// `UNDEFINED` no Asaas deixa o próprio cliente escolher na página de pagamento.
const METODOS = {
  pix: { label: 'Pix', asaas: 'PIX' },
  boleto: { label: 'Boleto', asaas: 'BOLETO' },
  cartao: { label: 'Cartão de crédito', asaas: 'CREDIT_CARD' }
};

const soDigitos = (valor) => String(valor || '').replace(/\D/g, '');

// A ordem de declaração é a ordem do select na tela — a mesma do legado.
const providers = {
  'Mercado Pago': {
    label: 'Mercado Pago',
    secretField: 'access_token',
    // Preferência de checkout: o cliente paga na página do Mercado Pago. Os dados do cartão são
    // digitados lá, nunca aqui — ver a nota sobre PCI no topo de createCharge().
    async createCharge({ secret, descricao, valor, vencimento, cliente, retornoUrl }) {
      const data = await requestJson(`${MERCADOPAGO_URL}/checkout/preferences`, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}` },
        body: {
          items: [{ title: descricao, quantity: 1, currency_id: 'BRL', unit_price: Number(valor) }],
          // Documento e endereço vão junto: o Mercado Pago pré-preenche o checkout com eles e a
          // taxa de aprovação sobe quando o pagador vem identificado.
          payer: {
            name: cliente.nome,
            email: cliente.email,
            identification: cliente.cpf
              ? { type: soDigitos(cliente.cpf).length > 11 ? 'CNPJ' : 'CPF', number: soDigitos(cliente.cpf) }
              : undefined,
            address: cliente.cep
              ? { zip_code: soDigitos(cliente.cep), street_name: cliente.endereco || undefined, street_number: cliente.numero || undefined }
              : undefined
          },
          external_reference: cliente.referencia,
          expires: Boolean(vencimento),
          expiration_date_to: vencimento ? `${vencimento}T23:59:59.000-03:00` : undefined,
          back_urls: retornoUrl ? { success: retornoUrl, pending: retornoUrl, failure: retornoUrl } : undefined
        }
      });
      return { provider: 'Mercado Pago', id: data?.id ?? null, url: data?.init_point || data?.sandbox_init_point || null };
    },
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
    // Duas chamadas: cria (ou reaproveita) o cliente e abre a cobrança. Devolve `invoiceUrl`, a
    // página de pagamento hospedada pelo Asaas — é lá que o cartão é digitado, nunca aqui.
    async createCharge({ secret, descricao, valor, vencimento, metodo, cliente }) {
      const headers = { access_token: secret };
      const documento = soDigitos(cliente.cpf);
      const customer = await requestJson(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers,
        body: {
          name: cliente.nome,
          email: cliente.email,
          cpfCnpj: documento || undefined,
          mobilePhone: soDigitos(cliente.telefone) || undefined,
          postalCode: soDigitos(cliente.cep) || undefined,
          address: cliente.endereco || undefined,
          addressNumber: cliente.numero || undefined,
          province: cliente.bairro || undefined,
          externalReference: cliente.referencia
        }
      });
      const payment = await requestJson(`${ASAAS_URL}/payments`, {
        method: 'POST',
        headers,
        body: {
          customer: customer?.id,
          billingType: METODOS[metodo]?.asaas || 'UNDEFINED',
          value: Number(valor),
          dueDate: vencimento,
          description: descricao,
          externalReference: cliente.referencia
        }
      });
      return {
        provider: 'Asaas',
        id: payment?.id ?? null,
        url: payment?.invoiceUrl || payment?.bankSlipUrl || null
      };
    },
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

// Opções de forma de pagamento para o checkout público.
const metodoOptions = Object.entries(METODOS).map(([value, { label }]) => ({ value, label }));
const isMetodo = (valor) => Object.hasOwn(METODOS, String(valor));

module.exports = { providers, providerOptions, isDisabled, METODOS, metodoOptions, isMetodo };
