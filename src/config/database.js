'use strict';

const { Pool, types } = require('pg');
const { env } = require('./env');

// Camada de compatibilidade sobre o driver `pg` que preserva a superfície do `mysql2/promise`
// usada em todo o projeto: placeholders `?`, retorno em tupla `[rows, fields]`, `insertId`,
// `affectedRows` e o par `getConnection()` / `beginTransaction()`.
//
// A tradução acontece aqui embaixo, então os 338 pontos de consulta e os mocks dos testes
// continuam escritos em `?`. É dívida técnica consciente: dá para migrar módulo a módulo para
// `pg` nativo depois, com a suíte verde o tempo todo.

// O `pg` tipa COUNT(*) e BIGINT como int8 e devolve string; o mysql2 devolve número. Alinhamos ao
// comportamento atual para não quebrar os 19 pontos que consomem COUNT(*). Perde precisão acima de
// 2^53, exatamente como o mysql2 já perdia. DECIMAL/NUMERIC (OID 1700) continua string nos dois.
types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

// Percorre o SQL trocando `?` por `$n`, sem tocar em `?` dentro de literais, identificadores
// entre aspas ou comentários. Parâmetros do tipo array viram uma lista de placeholders, que é
// como o `mysql2.query()` expande `IN (?)`.
function toPositional(sql, params = []) {
  const values = [];
  let out = '';
  let index = 0;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (char === "'") {
      const end = closingQuote(sql, i, "'");
      out += sql.slice(i, end);
      i = end;
      continue;
    }
    if (char === '"') {
      const end = closingQuote(sql, i, '"');
      out += sql.slice(i, end);
      i = end;
      continue;
    }
    if (char === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (char === '?') {
      const value = params[index];
      index += 1;
      if (Array.isArray(value)) {
        // `IN (?)` com array: expande para `$1, $2, ...`. Array vazio vira NULL, que não casa com
        // nada — mesmo resultado que o mysql2 produz.
        if (value.length === 0) {
          out += 'NULL';
        } else {
          out += value.map((item) => `$${values.push(item)}`).join(', ');
        }
      } else {
        out += `$${values.push(value)}`;
      }
      i += 1;
      continue;
    }

    out += char;
    i += 1;
  }

  return { text: out, values };
}

// Devolve o índice logo após o literal iniciado em `start`. Aspas dobradas ('' ou "") são escape
// e não encerram o literal.
function closingQuote(sql, start, quote) {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

const INSERT_START = /^\s*INSERT\s/i;
const READS_ROWS = /^\s*(?:SELECT|WITH|SHOW|TABLE|VALUES)\b/i;
const HAS_RETURNING = /\bRETURNING\b/i;

function isPlainInsert(sql) {
  return INSERT_START.test(sql) && !HAS_RETURNING.test(sql);
}

// Executa e devolve a tupla no formato do mysql2.
//
// SELECT (e qualquer comando com RETURNING escrito à mão) devolve o array de linhas, porque é
// isso que `const [rows] = ...` espera. INSERT/UPDATE/DELETE devolvem um cabeçalho com
// `insertId` e `affectedRows`, que é o que `const [result] = ...` espera.
async function run(client, sql, params = []) {
  const readsRows = READS_ROWS.test(sql) || HAS_RETURNING.test(sql);
  const text = isPlainInsert(sql) ? `${sql.trimEnd().replace(/;\s*$/, '')} RETURNING id` : sql;
  const query = toPositional(text, params);
  const result = await client.query(query);

  if (readsRows) {
    return [result.rows, result.fields];
  }

  // `ON CONFLICT DO NOTHING` que não inseriu nada não devolve linha: `insertId` fica undefined,
  // que é a leitura correta para quem checa se houve inserção.
  const header = {
    insertId: result.rows.length > 0 ? result.rows[0].id : undefined,
    affectedRows: result.rowCount,
    rowCount: result.rowCount
  };
  return [header, result.fields];
}

// Espalha a config inteira para não perder campos opcionais como `ssl`, que o deploy gerenciado usa.
const pool = new Pool({ ...env.database, max: 10 });

// Conexão dedicada para transações. Espelha a API do `PoolConnection` do mysql2 — inclusive a
// presença dos métodos, de que `work.service.js` depende para detectar se pode transacionar.
function wrapConnection(client) {
  let released = false;
  let inTransaction = false;

  return {
    execute: (sql, params) => run(client, sql, params),
    query: (sql, params) => run(client, sql, params),
    beginTransaction: async () => {
      await client.query('BEGIN');
      inTransaction = true;
    },
    commit: async () => {
      await client.query('COMMIT');
      inTransaction = false;
    },
    rollback: async () => {
      await client.query('ROLLBACK');
      inTransaction = false;
    },
    release: () => {
      if (released) return;
      released = true;
      // Diferença crítica em relação ao mysql2: um cliente devolvido ao pool com transação ainda
      // aberta (rollback que falhou, ou caminho de erro que esqueceu o rollback) envenena o pool —
      // a próxima requisição que pegar esse cliente recebe "current transaction is aborted".
      // Passar um erro ao release() descarta o cliente em vez de reaproveitá-lo.
      client.release(inTransaction ? new Error('conexão liberada com transação aberta') : undefined);
    }
  };
}

const db = {
  execute: (sql, params) => run(pool, sql, params),
  query: (sql, params) => run(pool, sql, params),
  getConnection: async () => wrapConnection(await pool.connect()),
  end: () => pool.end()
};

// `rawPool` é o Pool do `pg` sem o shim — para DDL/migração, que roda SQL cru multi-statement.
module.exports = { pool: db, rawPool: pool, toPositional };
