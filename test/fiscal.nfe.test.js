'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { chaveDv, montarChave, validateNfe, buildNfe } = require('../src/modules/fiscal/nfe-payload');

const base = {
  ambiente: 'homologacao',
  numero: 1,
  serie: '1',
  aamm: '2607',
  cNF: '12345678',
  dhEmi: '2026-07-30T10:00:00-03:00',
  emitente: {
    cnpj: '12.345.678/0001-99', razaoSocial: 'Empresa Teste LTDA', codigoIbge: '4211900', uf: 'SC',
    inscricaoEstadual: 'ISENTO', cidade: 'Palhoca', logradouro: 'Rua A', numero: '100', bairro: 'Centro', cep: '88130-000'
  },
  destinatario: { cnpj: '98.765.432/0001-00', nome: 'Cliente Teste' },
  itens: [{ codigo: 'P1', descricao: 'Headset', ncm: '85183000', cfop: '5102', unidade: 'UN', quantidade: 2, valorUnitario: 50, origem: '0', cstCsosn: '102' }]
};

test('montarChave gera 44 dígitos começando pelo código da UF', () => {
  const chave = montarChave({ codigoIbge: '4211900', aamm: '2607', cnpj: '12345678000199', serie: '1', numero: 1, cNF: '12345678' });
  assert.equal(chave.length, 44);
  assert.equal(chave.slice(0, 2), '42');
});

test('o dígito verificador da chave é consistente', () => {
  const chave = montarChave({ codigoIbge: '4211900', aamm: '2607', cnpj: '12345678000199', serie: '1', numero: 1, cNF: '12345678' });
  assert.equal(Number(chave.slice(-1)), chaveDv(chave.slice(0, 43)));
});

test('validateNfe não retorna erros para dados completos', () => {
  assert.deepEqual(validateNfe(base), []);
});

test('validateNfe acusa NCM e CFOP inválidos', () => {
  const errors = validateNfe({ ...base, itens: [{ ...base.itens[0], ncm: '123', cfop: 'XX' }] });
  assert.ok(errors.some((e) => /NCM/.test(e)));
  assert.ok(errors.some((e) => /CFOP/.test(e)));
});

test('buildNfe monta a NFe 4.00 com chave no Id, CSOSN e total corretos', () => {
  const { xml, chave } = buildNfe(base);
  assert.equal(chave.length, 44);
  assert.match(xml, new RegExp(`Id="NFe${chave}"`));
  assert.match(xml, /versao="4\.00"/);
  assert.match(xml, /<CSOSN>102<\/CSOSN>/);
  assert.match(xml, /<CRT>1<\/CRT>/);
  assert.match(xml, /<vNF>100\.00<\/vNF>/);
});
