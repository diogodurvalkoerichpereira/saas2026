'use strict';

const { z } = require('zod');

// Mensagens de validação em português. Sem isto, o Zod devolve os textos padrão em inglês
// ("String must contain at least 2 character(s)", "Invalid email") — regressão em relação ao
// legado, que falava português. Aplicado globalmente em app.js via z.setErrorMap.

const errorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'Campo obrigatório.' };
      if (issue.expected === 'number') return { message: 'Informe um número.' };
      if (issue.expected === 'string') return { message: 'Informe um texto.' };
      return { message: 'Valor inválido.' };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: issue.minimum === 1 ? 'Campo obrigatório.' : `Deve ter ao menos ${issue.minimum} caracteres.` };
      }
      if (issue.type === 'number') return { message: `Deve ser no mínimo ${issue.minimum}.` };
      if (issue.type === 'array') return { message: `Selecione ao menos ${issue.minimum}.` };
      return { message: 'Valor muito pequeno.' };
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Deve ter no máximo ${issue.maximum} caracteres.` };
      if (issue.type === 'number') return { message: `Deve ser no máximo ${issue.maximum}.` };
      return { message: 'Valor muito grande.' };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'E-mail inválido.' };
      if (issue.validation === 'url') return { message: 'URL inválida.' };
      return { message: 'Formato inválido.' };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Opção inválida. Use uma das: ${issue.options.join(', ')}.` };
    case z.ZodIssueCode.invalid_date:
      return { message: 'Data inválida.' };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: 'Há campos não reconhecidos.' };
    default:
      return { message: ctx.defaultError };
  }
};

module.exports = { errorMap };
