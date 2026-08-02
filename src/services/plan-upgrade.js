'use strict';

const { pool } = require('../config/database');
const { provisionCompanyResources } = require('./plan-provisioning');

// Upgrade de plano pelo painel do lojista, espelhando o legado:
//   programar_upgrade.php → calcula a diferença pro-rata e gera a cobrança de ajuste
//   aprovar_plano.php     → ao pagar, troca o plano, reaplica os recursos e refaz a mensalidade
//
// Regra do legado mantida: só UPGRADE (plano de valor maior), e a cobrança é proporcional aos dias
// que faltam até o vencimento da mensalidade em aberto. Mensalidade vencida bloqueia o upgrade.

const round2 = (value) => Math.round(Number(value) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
// O driver devolve DATE como objeto Date; String(Date) daria "Sat Aug 22 2026" e quebraria o
// slice/comparação. Normaliza qualquer forma (Date ou string) para 'YYYY-MM-DD'.
const isoDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};
const daysBetween = (fromISO, toISO) =>
  Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86400000);

async function currentSubscription(companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT e.id, e.plano, e.mensalidade, p.nome AS plano_nome, p.valor AS plano_valor
       FROM empresas e LEFT JOIN planos p ON p.id = e.plano WHERE e.id = ? LIMIT 1`,
    [companyId]
  );
  return rows[0] || null;
}

// Mensalidade em aberto que serve de base para o rateio (a mais recente, como no legado).
async function openInvoice(companyId, db = pool) {
  const [rows] = await db.execute(
    `SELECT id, valor, frequencia, vencimento FROM receber_sas
      WHERE cliente = ? AND referencia = 'Mensalidade' AND (pago IS NULL OR pago <> 'Sim')
      ORDER BY id DESC LIMIT 1`,
    [companyId]
  );
  return rows[0] || null;
}

// Diferença proporcional aos dias restantes do ciclo. Devolve { diferenca, diasRestantes }.
function proRata({ valorBase, frequencia, vencimento, valorNovo }) {
  const freq = Number(frequencia) > 0 ? Number(frequencia) : 30;
  const hoje = today();
  let diasRestantes = freq;
  const venc = isoDate(vencimento);
  if (venc) {
    if (venc < hoje) return { vencida: true, diferenca: 0, diasRestantes: 0 };
    diasRestantes = Math.max(daysBetween(hoje, venc), 1);
  }
  const diariaBase = Number(valorBase) / freq;
  const diariaNova = Number(valorNovo) / freq;
  return { vencida: false, diferenca: round2((diariaNova - diariaBase) * diasRestantes), diasRestantes };
}

// Planos disponíveis para troca. Upgrade (valor maior) cobra a diferença proporcional hoje;
// downgrade (valor menor) não gera cobrança e passa a valer na próxima renovação — o cliente já
// pagou o ciclo atual, então não faz sentido reduzir o acesso no meio dele nem devolver valor.
async function listUpgrades(companyId, db = pool) {
  const sub = await currentSubscription(companyId, db);
  const valorAtual = Number(sub?.plano_valor ?? sub?.mensalidade ?? 0);
  const [plans] = await db.execute(
    `SELECT id, nome, valor, clientes, usuarios, dispositivos FROM planos
      WHERE ativo = 'Sim' AND valor <> ? AND id <> COALESCE(?, -1) ORDER BY valor ASC, id ASC`,
    [valorAtual, sub?.plano ?? null]
  );
  if (!plans.length) return { current: sub, plans: [] };

  const invoice = await openInvoice(companyId, db);
  const [items] = await db.query('SELECT plano, nome FROM planos_itens WHERE plano IN (?) ORDER BY id', [plans.map((p) => p.id)]);
  const byPlan = {};
  for (const item of items) (byPlan[item.plano] = byPlan[item.plano] || []).push(item.nome);

  return {
    current: sub,
    invoice: invoice ? { vencimento: invoice.vencimento, valor: invoice.valor } : null,
    plans: plans.map((plan) => {
      const tipo = Number(plan.valor) > valorAtual ? 'upgrade' : 'downgrade';
      if (tipo === 'downgrade') {
        // Sem cobrança: vale a partir da próxima renovação (fim do ciclo já pago).
        return { ...plan, itens: byPlan[plan.id] || [], tipo, diferenca: 0, diasRestantes: null, valeApartirDe: isoDate(invoice?.vencimento) };
      }
      // Base = valor do PLANO atual (o que a empresa paga por ciclo). A fatura em aberto entra só
      // com o vencimento e a frequência — usar o valor dela quebraria se estivesse dessincronizada.
      const calc = invoice
        ? proRata({ valorBase: valorAtual, frequencia: invoice.frequencia, vencimento: invoice.vencimento, valorNovo: plan.valor })
        : { vencida: false, diferenca: round2(Number(plan.valor) - valorAtual), diasRestantes: null };
      return { ...plan, itens: byPlan[plan.id] || [], tipo, diferenca: Math.max(calc.diferenca, 0), diasRestantes: calc.diasRestantes };
    })
  };
}

// Solicita o upgrade: valida e gera a cobrança de ajuste (o plano só troca quando ela for paga).
async function requestUpgrade({ companyId, planId, userId, db = pool }) {
  const sub = await currentSubscription(companyId, db);
  if (!sub) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 });

  const [plans] = await db.execute("SELECT id, nome, valor FROM planos WHERE id = ? AND ativo = 'Sim' LIMIT 1", [planId]);
  const plano = plans[0];
  if (!plano) throw Object.assign(new Error('Plano de destino indisponível.'), { status: 404 });

  const valorAtual = Number(sub.plano_valor ?? sub.mensalidade ?? 0);
  if (Number(plano.id) === Number(sub.plano)) {
    throw Object.assign(new Error('Este já é o plano atual da empresa.'), { status: 409 });
  }

  // Downgrade: sem cobrança. Agenda a troca para a próxima renovação — o ciclo atual já foi pago,
  // então o cliente mantém o acesso que contratou até o vencimento.
  if (Number(plano.valor) < valorAtual) {
    const invoiceAtual = await openInvoice(companyId, db);
    const vigenciaEm = isoDate(invoiceAtual?.vencimento) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await db.execute('UPDATE empresas SET plano_agendado = ?, plano_agendado_em = ? WHERE id = ?', [plano.id, vigenciaEm, companyId]);
    return { tipo: 'downgrade', plano: { id: plano.id, nome: plano.nome, valor: plano.valor }, diferenca: 0, vigenciaEm };
  }

  const [pending] = await db.execute(
    "SELECT id FROM receber_sas WHERE cliente = ? AND referencia = 'Upgrade' AND (pago IS NULL OR pago <> 'Sim') LIMIT 1",
    [companyId]
  );
  if (pending[0]) {
    throw Object.assign(new Error('Já existe um upgrade aguardando pagamento.'), { status: 409, upgradeId: pending[0].id });
  }

  const invoice = await openInvoice(companyId, db);
  let diferenca;
  if (invoice) {
    // Mesma base da listagem: valor do plano atual, com o ciclo/vencimento da fatura em aberto.
    const calc = proRata({ valorBase: valorAtual, frequencia: invoice.frequencia, vencimento: invoice.vencimento, valorNovo: plano.valor });
    if (calc.vencida) throw Object.assign(new Error('Mensalidade vencida: regularize o pagamento antes de fazer o upgrade.'), { status: 409 });
    diferenca = calc.diferenca;
  } else {
    // Sem mensalidade em aberto: cobra a diferença cheia entre os planos.
    diferenca = round2(Number(plano.valor) - valorAtual);
  }
  if (!(diferenca > 0)) throw Object.assign(new Error('Não há diferença a cobrar para este upgrade.'), { status: 409 });

  const vencimento = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const [result] = await db.execute(
    `INSERT INTO receber_sas (descricao, cliente, valor, subtotal, vencimento, data_lanc, referencia, id_ref, pago, usuario_lanc, empresa)
     VALUES (?, ?, ?, ?, ?, CURRENT_DATE, 'Upgrade', ?, 'Não', ?, 0)`,
    [`Upgrade de Plano — ${plano.nome} (ajuste proporcional)`, companyId, diferenca, diferenca, vencimento, plano.id, userId ?? null]
  );
  return { id: result.insertId, plano: { id: plano.id, nome: plano.nome, valor: plano.valor }, diferenca, vencimento };
}

// Efetiva o upgrade quando a cobrança de ajuste é paga (espelha aprovar_plano.php).
// Troca o plano, reaplica os recursos e refaz a mensalidade com o novo valor e o mesmo vencimento.
async function applyUpgrade({ companyId, planId, db = pool }) {
  const [plans] = await db.execute('SELECT id, nome, valor FROM planos WHERE id = ? LIMIT 1', [planId]);
  const plano = plans[0];
  if (!plano) throw Object.assign(new Error('Plano de destino não encontrado.'), { status: 404 });

  const invoice = await openInvoice(companyId, db);
  const vencimento = isoDate(invoice?.vencimento) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const frequencia = invoice?.frequencia ?? 30;

  await db.execute('UPDATE empresas SET plano = ?, mensalidade = ? WHERE id = ?', [plano.id, plano.valor, companyId]);
  // Reaplica os recursos do novo plano (núcleo + premium) — o acesso muda na hora.
  await provisionCompanyResources({ companyId, planId: plano.id, db });
  // Substitui as mensalidades em aberto do valor antigo por uma com o valor novo.
  await db.execute("DELETE FROM receber_sas WHERE cliente = ? AND referencia = 'Mensalidade' AND (pago IS NULL OR pago <> 'Sim')", [companyId]);
  await db.execute(
    `INSERT INTO receber_sas (descricao, cliente, valor, subtotal, vencimento, data_lanc, referencia, frequencia, pago, empresa)
     VALUES (?, ?, ?, ?, ?, CURRENT_DATE, 'Mensalidade', ?, 'Não', 0)`,
    [`Mensalidade SAAS — ${plano.nome}`, companyId, plano.valor, plano.valor, vencimento, frequencia]
  );
  return { plano };
}

// Cancela um downgrade agendado (o cliente mudou de ideia antes da renovação).
async function cancelScheduled(companyId, db = pool) {
  await db.execute('UPDATE empresas SET plano_agendado = NULL, plano_agendado_em = NULL WHERE id = ?', [companyId]);
}

// Aplica os downgrades cujo agendamento já chegou. Chamado pelo job diário: na data marcada, a
// empresa passa para o plano menor e os recursos são reaplicados.
async function applyScheduledDowngrades(db = pool) {
  const [rows] = await db.execute(
    'SELECT id, plano_agendado FROM empresas WHERE plano_agendado IS NOT NULL AND plano_agendado_em <= CURRENT_DATE'
  );
  const aplicados = [];
  for (const empresa of rows) {
    await applyUpgrade({ companyId: empresa.id, planId: empresa.plano_agendado, db });
    await cancelScheduled(empresa.id, db);
    aplicados.push({ empresa: empresa.id, plano: empresa.plano_agendado });
  }
  return aplicados;
}

module.exports = { listUpgrades, requestUpgrade, applyUpgrade, proRata, cancelScheduled, applyScheduledDowngrades };
