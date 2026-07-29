const test = require('node:test');
const assert = require('node:assert/strict');
const { listResponse, normalizeDate } = require('../src/lib/list-response');

test('listResponse pesquisa, ordena e pagina sem perder o total', () => {
  const result = listResponse([
    { id: 1, nome: 'Zulu', ativo: 'Sim' },
    { id: 2, nome: 'Cliente Alfa', ativo: 'Sim' },
    { id: 3, nome: 'Cliente Beta', ativo: 'Não' }
  ], { page: '1', pageSize: '5', search: 'cliente', status: 'Sim' }, { searchFields: ['nome'], defaultSort: 'nome' });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.items[0].nome, 'Cliente Alfa');
});

test('datas sentinela do legado são apresentadas como ausentes', () => {
  assert.equal(normalizeDate('0000-00-00'), null);
  assert.equal(normalizeDate('1111-11-11T00:00:00.000Z'), null);
  assert.equal(normalizeDate('2026-07-29T03:00:00.000Z'), '2026-07-29');
  assert.equal(normalizeDate(new Date('2026-07-29T03:00:00.000Z')), '2026-07-29');
});
