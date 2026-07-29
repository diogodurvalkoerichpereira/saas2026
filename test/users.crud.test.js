const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createUser, setUserActive } = require('../src/modules/users/users.service');

test('createUser grava somente senha criptografada', async () => {
  const calls = [];
  const db = {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT')) return [[]];
      return [{ insertId: 10 }];
    }
  };
  const id = await createUser({ nome: 'Teste', email: 'teste@example.invalid', password: 'Senha@123', nivel: 'Comum' }, 7, db);
  assert.equal(id, 10);
  const insert = calls[1];
  assert.equal(insert.params.includes('Senha@123'), false);
  assert.equal(await bcrypt.compare('Senha@123', insert.params[2]), true);
});

test('setUserActive impede que o usuário inative a si mesmo', async () => {
  await assert.rejects(() => setUserActive(5, false, 5, 1, {}), (error) => error.status === 409);
});
