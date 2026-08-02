const test = require('node:test');
const assert = require('node:assert/strict');
const { loginRateLimit, clearLoginAttempts } = require('../src/middlewares/login-rate-limit');

function makeResponse() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test('loginRateLimit libera tentativas dentro do limite', () => {
  const req = { ip: '10.0.0.1', body: { email: 'livre@example.invalid' } };
  const res = makeResponse();
  let nextCalled = 0;
  for (let i = 0; i < 5; i += 1) loginRateLimit(req, res, () => { nextCalled += 1; });
  assert.equal(nextCalled, 5);
  assert.equal(res.statusCode, 0);
});

test('loginRateLimit bloqueia após exceder o limite de tentativas', () => {
  const req = { ip: '10.0.0.2', body: { email: 'bloqueado@example.invalid' } };
  const res = makeResponse();
  let nextCalled = 0;
  for (let i = 0; i < 25; i += 1) loginRateLimit(req, res, () => { nextCalled += 1; });
  assert.ok(nextCalled < 25);
  assert.equal(res.statusCode, 429);
});

test('login bem-sucedido zera o contador — só erro de senha conta para o bloqueio', () => {
  const req = { ip: '10.0.0.4', body: { email: 'certo@example.invalid' } };
  const res = makeResponse();
  let nextCalled = 0;
  // Quem acerta a senha pode entrar quantas vezes precisar: a cada acerto o contador volta a zero.
  for (let i = 0; i < 50; i += 1) {
    loginRateLimit(req, res, () => { nextCalled += 1; });
    clearLoginAttempts(req);
  }
  assert.equal(nextCalled, 50);
  assert.equal(res.statusCode, 0);
});

test('loginRateLimit isola tentativas por e-mail dentro do mesmo IP', () => {
  const resA = makeResponse();
  const resB = makeResponse();
  for (let i = 0; i < 25; i += 1) loginRateLimit({ ip: '10.0.0.3', body: { email: 'a@example.invalid' } }, resA, () => {});
  loginRateLimit({ ip: '10.0.0.3', body: { email: 'b@example.invalid' } }, resB, () => {});
  assert.equal(resA.statusCode, 429);
  assert.equal(resB.statusCode, 0);
});
