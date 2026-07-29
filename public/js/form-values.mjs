export function normalizeFormValues(values, fields) {
  const normalized = { ...values };
  for (const field of fields) {
    if (field.numeric && normalized[field.name] !== '') normalized[field.name] = Number(normalized[field.name]);
    if (field.boolean) normalized[field.name] = normalized[field.name] === 'true';
    if (field.optional && normalized[field.name] === '') delete normalized[field.name];
  }
  return normalized;
}

export function validateFormValues(values, fields) {
  const errors = [];
  for (const field of fields) {
    const value = values[field.name];
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.label} é obrigatório.`);
    }
    if (field.numeric && value !== undefined && value !== '' && !Number.isFinite(Number(value))) {
      errors.push(`${field.label} deve ser um número válido.`);
    }
    if (field.min !== undefined && value !== undefined && value !== '' && Number(value) < Number(field.min)) {
      errors.push(`${field.label} deve ser maior ou igual a ${field.min}.`);
    }
  }
  return errors;
}
