'use strict';

// Define a chave antes de importar o módulo (crypto.js lê o env em cada chamada, mas garantimos).
process.env.FISCAL_ENCRYPTION_KEY = 'chave-de-teste-fiscal-suficientemente-longa';

const test = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../src/modules/fiscal/crypto');

test('encrypt/decrypt recupera o texto original', () => {
  const senha = 'S3nh@-C3rt!ficado';
  const cifrado = encrypt(senha);
  assert.notEqual(cifrado, senha);
  assert.equal(decrypt(cifrado), senha);
});

test('cada cifra usa IV aleatório (saídas diferentes para a mesma entrada)', () => {
  assert.notEqual(encrypt('mesma-senha'), encrypt('mesma-senha'));
});

test('decrypt rejeita conteúdo adulterado (authTag do GCM)', () => {
  const cifrado = encrypt('abc');
  const raw = Buffer.from(cifrado, 'base64');
  raw[raw.length - 1] ^= 0xff;
  assert.throws(() => decrypt(raw.toString('base64')));
});
