const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middlewares/authorize');

test('authorize aceita função permitida', () => {
  let nextCalled = false;
  authorize('Administrador')({ auth: { role: 'Administrador' } }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('authorize bloqueia função não permitida', () => {
  const response = { statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  authorize('Administrador')({ auth: { role: 'Comum' } }, response, () => {});
  assert.equal(response.statusCode, 403);
});
