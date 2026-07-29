const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const moduleUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'public', 'js', name)).href;

test('roteador reconhece módulos, consulta e fallback', async () => {
  const { parseRoute } = await import(moduleUrl('router.mjs'));
  assert.deepEqual(parseRoute('#/finance?type=payables'), {
    name: 'finance',
    title: 'Financeiro',
    query: { type: 'payables' }
  });
  assert.equal(parseRoute('#/nao-existe').name, 'dashboard');
});

test('formatadores tratam reais, datas e sentinelas do legado', async () => {
  const { money, date, text } = await import(moduleUrl('format.mjs'));
  assert.match(money(1234.5), /1\.234,50/);
  assert.equal(date('2026-07-29'), '29/07/2026');
  assert.equal(date('0000-00-00'), 'Não informado');
  assert.equal(date('1111-11-11'), 'Não informado');
  assert.equal(text(''), 'Não informado');
});

test('mapeamento de formulário converte números, booleanos e opcionais', async () => {
  const { normalizeFormValues } = await import(moduleUrl('form-values.mjs'));
  const result = normalizeFormValues(
    { quantidade: '2', pago: 'true', observacao: '' },
    [
      { name: 'quantidade', numeric: true },
      { name: 'pago', boolean: true },
      { name: 'observacao', optional: true }
    ]
  );
  assert.deepEqual(result, { quantidade: 2, pago: true });
});

test('validação de formulário aponta obrigatórios, números e mínimos', async () => {
  const { validateFormValues } = await import(moduleUrl('form-values.mjs'));
  const fields = [
    { name: 'nome', label: 'Nome', required: true },
    { name: 'quantidade', label: 'Quantidade', numeric: true, min: 1 }
  ];
  assert.deepEqual(validateFormValues({ nome: '', quantidade: 'x' }, fields), [
    'Nome é obrigatório.',
    'Quantidade deve ser um número válido.'
  ]);
  assert.deepEqual(validateFormValues({ nome: 'Item', quantidade: '0' }, fields), [
    'Quantidade deve ser maior ou igual a 1.'
  ]);
});
