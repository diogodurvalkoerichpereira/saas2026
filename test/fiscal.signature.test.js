'use strict';

// Valida o encadeamento de assinatura do DPS usando um par de chaves DESCARTAVEL gerado
// na hora. Nao usa o certificado real nem a senha: prova que a assinatura funciona sem
// tocar em segredo algum.

const test = require('node:test');
const assert = require('node:assert/strict');
const forge = require('node-forge');
const { buildDps } = require('../src/modules/fiscal/nfse-payload');
const { signDps } = require('../src/modules/fiscal/providers/nfse-nacional');

function throwawayKeyPair() {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(2020, 0, 1);
  cert.validity.notAfter = new Date(2035, 0, 1);
  const attrs = [{ name: 'commonName', value: 'Certificado Descartavel de Teste' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certificatePem: forge.pki.certificateToPem(cert)
  };
}

const dps = buildDps({
  ambiente: 'homologacao',
  numero: 1,
  serie: '1',
  dhEmi: '2026-07-30T10:00:00-03:00',
  competencia: '2026-07-30',
  emitente: { cnpj: '12.345.678/0001-99', inscricaoMunicipal: '123456', codigoIbge: '4211900', regime: 'Simples Nacional' },
  tomador: { cnpj: '98.765.432/0001-00', nome: 'Cliente Teste' },
  servico: { codigoTributacaoNacional: '0107', descricao: 'Atendimento receptivo', valor: 100, aliquotaIss: 2 }
});

test('signDps adiciona uma Signature ao DPS', () => {
  const signed = signDps(dps, throwawayKeyPair());
  assert.match(signed, /<(\w+:)?Signature/);
});

test('signDps usa SHA-256 e inclui o X509Certificate', () => {
  const signed = signDps(dps, throwawayKeyPair());
  assert.match(signed, /sha256/i);
  assert.match(signed, /X509Certificate/);
});

test('signDps preserva o conteúdo original do DPS', () => {
  const signed = signDps(dps, throwawayKeyPair());
  assert.match(signed, /<vServ>100\.00<\/vServ>/);
  assert.match(signed, /Cliente Teste/);
});
