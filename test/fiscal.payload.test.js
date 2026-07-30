'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateNfse, buildDps } = require('../src/modules/fiscal/nfse-payload');

const base = {
  ambiente: 'homologacao',
  numero: 1,
  serie: '1',
  dhEmi: '2026-07-30T10:00:00-03:00',
  competencia: '2026-07-30',
  emitente: { cnpj: '12.345.678/0001-99', inscricaoMunicipal: '123456', codigoIbge: '4211900', regime: 'Simples Nacional' },
  tomador: { cnpj: '98.765.432/0001-00', nome: 'Cliente Teste' },
  servico: { codigoTributacaoNacional: '0107', descricao: 'Atendimento receptivo', valor: 100, aliquotaIss: 2 }
};

test('validateNfse não retorna erros para dados completos', () => {
  assert.deepEqual(validateNfse(base), []);
});

test('validateNfse acusa emitente sem CNPJ', () => {
  const errors = validateNfse({ ...base, emitente: { ...base.emitente, cnpj: '' } });
  assert.ok(errors.some((e) => /CNPJ do emitente/.test(e)));
});

test('validateNfse acusa código IBGE inválido', () => {
  const errors = validateNfse({ ...base, emitente: { ...base.emitente, codigoIbge: '421' } });
  assert.ok(errors.some((e) => /Código IBGE/.test(e)));
});

test('validateNfse acusa tomador com documento inválido', () => {
  const errors = validateNfse({ ...base, tomador: { nome: 'X', cpf: '123' } });
  assert.ok(errors.some((e) => /CPF ou CNPJ do tomador/.test(e)));
});

test('buildDps gera XML com os campos principais', () => {
  const xml = buildDps(base);
  assert.match(xml, /<tpAmb>2<\/tpAmb>/);
  assert.match(xml, /<CNPJ>12345678000199<\/CNPJ>/);
  assert.match(xml, /<opSimpNac>1<\/opSimpNac>/);
  assert.match(xml, /<vServ>100\.00<\/vServ>/);
  assert.match(xml, /<pAliq>2\.00<\/pAliq>/);
  assert.match(xml, /Cliente Teste/);
});

test('buildDps escapa caracteres especiais na descrição', () => {
  const xml = buildDps({ ...base, servico: { ...base.servico, descricao: 'A & B <teste>' } });
  assert.match(xml, /A &amp; B &lt;teste&gt;/);
});

test('buildDps recusa dados incompletos com status 422', () => {
  try {
    buildDps({ ...base, servico: { ...base.servico, valor: 0 } });
    assert.fail('deveria ter lançado');
  } catch (error) {
    assert.equal(error.status, 422);
    assert.ok(Array.isArray(error.errors));
  }
});
