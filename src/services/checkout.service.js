'use strict';

// Abertura da cobrança da assinatura.
//
// DECISÃO DE SEGURANÇA — número de cartão e CVV nunca passam por aqui.
//
// O legado recebia o cartão no próprio servidor (sas/asaas/config/blocos/cartao.php mandava
// `cardnumber`, `expdate` e `ccv` por POST para o PHP, que repassava ao provedor). Isso coloca a
// aplicação inteira dentro do escopo do PCI-DSS: qualquer log, backup, dump de banco ou stack trace
// vira um incidente de dados de cartão.
//
// Aqui a cobrança é aberta pela API do provedor com a chave do SaaS, e o cliente é levado para a
// PÁGINA DE PAGAMENTO HOSPEDADA por ele (Asaas `invoiceUrl`, Mercado Pago `init_point`). É lá que o
// cartão é digitado. Nós guardamos apenas o que precisamos para conciliar: o id da cobrança, o
// link e o método escolhido. Pix e boleto saem da mesma página, sem código adicional.
//
// O que coletamos no checkout — nome, e-mail, telefone, CPF/CNPJ e endereço — não é dado de cartão:
// é o cadastro que o provedor exige para abrir uma cobrança no Brasil.

const { pool } = require('../config/database');
const { loadIntegrations } = require('./company-integrations');
const { providers, isDisabled, METODOS } = require('../integrations/payment.providers');

// A cobrança da assinatura é do SaaS, então a credencial usada é a da empresa 0 — não a da empresa
// que está sendo criada, que ainda não configurou nada.
const SAAS = 0;

async function checkoutProvider(db = pool) {
  const config = await loadIntegrations(SAAS, db);
  const nome = config?.api_pagamento;
  if (isDisabled(nome)) return null;
  const provider = providers[nome];
  const secret = config?.[provider.secretField];
  if (!secret) return null;
  return { nome, provider, secret };
}

/**
 * Abre a cobrança da primeira mensalidade no provedor configurado.
 *
 * Devolve `null` quando não há provedor ou credencial — nesse caso a mensalidade fica pendente para
 * cobrança manual, que é exatamente o comportamento que existia antes. A falha do provedor também
 * devolve `null`: a conta do cliente já foi criada e não pode ser desfeita porque o gateway caiu.
 */
async function abrirCobranca({ empresa, plano, mensalidade, vencimento, metodo, db = pool }) {
  if (!Number(mensalidade)) return null;
  const alvo = await checkoutProvider(db);
  if (!alvo) return null;

  try {
    const cobranca = await alvo.provider.createCharge({
      secret: alvo.secret,
      descricao: `Assinatura ${plano.nome}`,
      valor: mensalidade,
      vencimento,
      metodo,
      cliente: {
        nome: empresa.nome,
        email: empresa.email,
        telefone: empresa.telefone,
        cpf: empresa.cpf,
        cep: empresa.cep,
        endereco: empresa.endereco,
        numero: empresa.numero,
        bairro: empresa.bairro,
        referencia: `empresa-${empresa.id}`
      }
    });
    if (!cobranca?.url) return null;
    return { ...cobranca, metodo, metodoLabel: METODOS[metodo]?.label || null };
  } catch {
    // Sem detalhe do erro do provedor para o visitante: a resposta da API externa pode conter
    // dados do cadastro. O cliente vê a conta criada e a mensalidade pendente.
    return null;
  }
}

module.exports = { abrirCobranca, checkoutProvider };
