'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertWithinPlanLimit } = require('../src/services/plan-limits');

// db falso: primeira consulta devolve o limite do plano; a segunda, a contagem atual.
const fakeDb = (limite, total) => ({
  execute: async (sql) => {
    if (/FROM empresas/.test(sql)) return [[{ limite }]];
    return [[{ total }]];
  }
});

test('bloqueia quando a contagem atingiu o limite do plano', async () => {
  await assert.rejects(
    () => assertWithinPlanLimit({ companyId: 1, kind: 'usuarios', db: fakeDb(2, 2) }),
    (e) => e.status === 403 && e.code === 'LIMITE_PLANO' && /2 usuários/.test(e.message)
  );
});

test('permite quando ainda há folga', async () => {
  await assert.doesNotReject(() => assertWithinPlanLimit({ companyId: 1, kind: 'usuarios', db: fakeDb(5, 3) }));
});

test('limite nulo ou zero = ilimitado (não bloqueia)', async () => {
  await assert.doesNotReject(() => assertWithinPlanLimit({ companyId: 1, kind: 'clientes', db: fakeDb(null, 9999) }));
  await assert.doesNotReject(() => assertWithinPlanLimit({ companyId: 1, kind: 'clientes', db: fakeDb(0, 9999) }));
});

test('painel do sistema (empresa 0) não é limitado', async () => {
  let consultou = false;
  const db = { execute: async () => { consultou = true; return [[{}]]; } };
  await assertWithinPlanLimit({ companyId: 0, kind: 'usuarios', db });
  assert.equal(consultou, false);
});

test('tipo desconhecido não bloqueia', async () => {
  await assert.doesNotReject(() => assertWithinPlanLimit({ companyId: 1, kind: 'dispositivos', db: fakeDb(1, 99) }));
});
