'use strict';

const { pool } = require('../config/database');

// Limites de quantidade do plano (usuários e clientes ativos). Recusa criar/reativar acima da faixa
// contratada. É um limite da EMPRESA — vale inclusive para o Administrador dela. O painel do sistema
// (empresa 0) e empresa sem plano/limite não são limitados.
//
// Dispositivos ficam de fora: não são criados pela API (vêm da integração de WhatsApp), só exibidos.
const KINDS = {
  usuarios: { table: 'usuarios', filtro: "ativo = 'Sim'", coluna: 'usuarios', rotulo: 'usuários' },
  clientes: { table: 'clientes', filtro: "ativo = 'Sim'", coluna: 'clientes', rotulo: 'clientes' }
};

async function assertWithinPlanLimit({ companyId, kind, db = pool }) {
  const cfg = KINDS[kind];
  if (!cfg || !companyId || Number(companyId) === 0) return;
  const [plans] = await db.execute(
    `SELECT p.${cfg.coluna} AS limite FROM empresas e JOIN planos p ON p.id = e.plano WHERE e.id = ? LIMIT 1`,
    [Number(companyId)]
  );
  const limite = plans[0]?.limite;
  // Sem plano ou limite ausente/zero = ilimitado (não bloqueia).
  if (limite == null || Number(limite) <= 0) return;
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total FROM ${cfg.table} WHERE empresa = ? AND ${cfg.filtro}`,
    [Number(companyId)]
  );
  if (Number(rows[0].total) >= Number(limite)) {
    throw Object.assign(
      new Error(`O seu plano permite até ${limite} ${cfg.rotulo}. Faça upgrade do plano para adicionar mais.`),
      { status: 403, code: 'LIMITE_PLANO' }
    );
  }
}

module.exports = { assertWithinPlanLimit };
