const { test, expect, request } = require('@playwright/test');
const crypto = require('node:crypto');
const { Client } = require('pg');
require('dotenv').config();

// Webhook de pagamento. O endpoint é público — quem chama é o servidor do provedor — então o que
// estes testes protegem é a RECUSA: sem assinatura válida ninguém quita mensalidade nenhuma.
// Um webhook que aceita qualquer POST é dinheiro de graça para quem descobrir a URL.

const conectar = async () => {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
  });
  await client.connect();
  return client;
};

const assinar = (paymentId, requestId, ts, segredo) =>
  crypto.createHmac('sha256', segredo).update(`id:${paymentId};request-id:${requestId};ts:${ts};`).digest('hex');

// Cria uma mensalidade em aberto amarrada a uma cobrança fictícia do provedor.
async function mensalidadeEmAberto(db, cobrancaId) {
  const { rows: empresas } = await db.query('SELECT id FROM empresas WHERE id > 0 ORDER BY id LIMIT 1');
  const { rows } = await db.query(
    `INSERT INTO receber_sas (descricao, cliente, valor, subtotal, vencimento, data_lanc, referencia, pago, empresa, cobranca_id)
     VALUES ('Mensalidade de teste (webhook)', $1, 29.90, 29.90, CURRENT_DATE, CURRENT_DATE, 'Mensalidade', 'Não', 0, $2)
     RETURNING id`,
    [empresas[0].id, cobrancaId]
  );
  return rows[0].id;
}

async function limpar(db, billingId) {
  await db.query("DELETE FROM node_audit_log WHERE entidade = 'receber_sas' AND entidade_id = $1", [billingId]);
  await db.query('DELETE FROM receber_sas WHERE id = $1', [billingId]);
}

test('notificação sem assinatura válida não quita mensalidade nenhuma', async () => {
  const db = await conectar();
  const cobranca = `pay_spec_${Date.now()}`;
  const billingId = await mensalidadeEmAberto(db, cobranca);
  const ctx = await request.newContext();

  const corpo = { type: 'payment', data: { id: cobranca } };
  const ts = Math.floor(Date.now() / 1000);

  // Sem cabeçalho de assinatura.
  const nua = await ctx.post('/api/webhooks/payments/mercadopago', { data: corpo });
  expect(nua.status(), 'sem assinatura tem de ser recusado').toBe(401);

  // Assinatura calculada com outro segredo.
  const chutada = await ctx.post('/api/webhooks/payments/mercadopago', {
    headers: { 'x-request-id': 'req-1', 'x-signature': `ts=${ts},v1=${assinar(cobranca, 'req-1', ts, 'segredo-errado')}` },
    data: corpo
  });
  expect(chutada.status(), 'segredo errado tem de ser recusado').toBe(401);

  // Assinatura legítima de OUTRO pagamento, reaproveitada neste corpo.
  const reaproveitada = await ctx.post('/api/webhooks/payments/mercadopago', {
    headers: { 'x-request-id': 'req-1', 'x-signature': `ts=${ts},v1=${assinar('outro-pagamento', 'req-1', ts, 'segredo-errado')}` },
    data: corpo
  });
  expect(reaproveitada.status(), 'assinatura de outro pagamento não vale para este').toBe(401);

  const { rows } = await db.query('SELECT pago FROM receber_sas WHERE id = $1', [billingId]);
  expect(rows[0].pago, 'nenhuma das tentativas pode ter quitado a mensalidade').toBe('Não');

  await limpar(db, billingId);
  await db.end();
  await ctx.dispose();
});

test('provedor desconhecido na URL é recusado', async () => {
  const ctx = await request.newContext();
  const resposta = await ctx.post('/api/webhooks/payments/qualquercoisa', { data: {} });
  expect(resposta.status()).toBe(404);
  await ctx.dispose();
});

test('o webhook não expõe se o segredo existe nem detalha o erro', async () => {
  const ctx = await request.newContext();
  const resposta = await ctx.post('/api/webhooks/payments/mercadopago', { data: { type: 'payment', data: { id: 'x' } } });
  const corpo = await resposta.json();
  // Mensagem curta e sem eco do que foi enviado: a resposta vai para quem chamou, que pode não
  // ser o provedor.
  expect(Object.keys(corpo)).toEqual(['error']);
  expect(String(corpo.error).length).toBeLessThan(60);
  await ctx.dispose();
});
