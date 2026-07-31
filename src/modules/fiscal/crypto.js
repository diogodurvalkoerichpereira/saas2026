'use strict';

const crypto = require('node:crypto');

// Cifra segredos fiscais (senha do certificado A1) com AES-256-GCM. A chave deriva de
// FISCAL_ENCRYPTION_KEY (ou JWT_SECRET como fallback) via SHA-256 e nunca é gravada no banco.
// Saída em base64 no formato [iv 12][authTag 16][dados]. Sem a chave, o dado é inútil.

function key() {
  const secret = process.env.FISCAL_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!secret) throw new Error('Defina FISCAL_ENCRYPTION_KEY ou JWT_SECRET para cifrar segredos fiscais.');
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decrypt(payload) {
  const raw = Buffer.from(String(payload), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
