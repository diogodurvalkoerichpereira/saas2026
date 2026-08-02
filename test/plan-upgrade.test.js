'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { proRata } = require('../src/services/plan-upgrade');

const emDias = (dias) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

test('cobra a diferença proporcional aos dias restantes do ciclo', () => {
  // Essencial 69 → Profissional 139, ciclo de 30 dias, 20 dias restantes.
  // (139-69)/30 * 20 = 46,67
  const calc = proRata({ valorBase: 69, frequencia: 30, vencimento: emDias(20), valorNovo: 139 });
  assert.equal(calc.vencida, false);
  assert.equal(calc.diasRestantes, 20);
  assert.equal(calc.diferenca, 46.67);
});

test('aceita vencimento como objeto Date (como o driver devolve)', () => {
  const calc = proRata({ valorBase: 69, frequencia: 30, vencimento: new Date(Date.now() + 20 * 86400000), valorNovo: 139 });
  assert.equal(calc.diasRestantes, 20);
  assert.equal(calc.diferenca, 46.67);
});

test('mensalidade vencida bloqueia o upgrade', () => {
  const calc = proRata({ valorBase: 69, frequencia: 30, vencimento: emDias(-1), valorNovo: 139 });
  assert.equal(calc.vencida, true);
  assert.equal(calc.diferenca, 0);
});

test('quanto mais perto do vencimento, menor a diferença', () => {
  const longe = proRata({ valorBase: 69, frequencia: 30, vencimento: emDias(30), valorNovo: 139 });
  const perto = proRata({ valorBase: 69, frequencia: 30, vencimento: emDias(3), valorNovo: 139 });
  assert.ok(longe.diferenca > perto.diferenca);
  assert.equal(longe.diferenca, 70); // ciclo inteiro = diferença cheia
});

test('plano de valor menor não gera diferença a cobrar', () => {
  const calc = proRata({ valorBase: 139, frequencia: 30, vencimento: emDias(20), valorNovo: 69 });
  assert.ok(calc.diferenca < 0); // a rota recusa quando não é positivo
});

test('sem frequência definida assume ciclo de 30 dias', () => {
  const calc = proRata({ valorBase: 69, frequencia: null, vencimento: emDias(30), valorNovo: 139 });
  assert.equal(calc.diferenca, 70);
});
