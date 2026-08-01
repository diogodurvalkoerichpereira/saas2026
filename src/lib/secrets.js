'use strict';

const crypto = require('node:crypto');

// Cofre de segredos da aplicação: chaves de pagamento, token de WhatsApp e senha do certificado A1.
// AES-256-GCM, chave derivada por SHA-256 e nunca gravada no banco.
// Saída em base64 no formato [iv 12][authTag 16][dados]. Sem a chave, o dado é inútil.
//
// A derivação segue FISCAL_ENCRYPTION_KEY → JWT_SECRET, a mesma ordem que o módulo fiscal já usava.
// O nome "FISCAL" ficou por compatibilidade: mudar a variável re-chaveia TUDO que está cifrado,
// e os segredos precisariam ser digitados de novo. Não introduza outra variável na frente desta.

function key() {
  const secret = process.env.FISCAL_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!secret) throw new Error('Defina FISCAL_ENCRYPTION_KEY ou JWT_SECRET para cifrar segredos.');
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

// Para colunas que podem conter segredo em texto puro gravado antes da cifragem existir.
// A tag GCM rejeita qualquer coisa que não tenha sido cifrada por nós, então o texto puro
// cai no catch e volta como está — a leitura continua funcionando durante a transição.
function decryptMaybe(value) {
  if (value === null || value === undefined || value === '') return '';
  try { return decrypt(value); } catch { return String(value); }
}

module.exports = { encrypt, decrypt, decryptMaybe };
