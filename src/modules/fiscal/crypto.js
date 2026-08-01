'use strict';

// A cifra de segredos virou utilitário compartilhado (chaves de pagamento, WhatsApp e fiscal).
// Este módulo continua exportando a mesma superfície para o código fiscal já existente.
const { encrypt, decrypt, decryptMaybe } = require('../../lib/secrets');

module.exports = { encrypt, decrypt, decryptMaybe };
