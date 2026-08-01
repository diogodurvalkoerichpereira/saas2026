const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/database');
const { createWork } = require('../src/modules/work/work.service');
const { annualBalanceReport } = require('../src/modules/reports/reports.service');

// Guardas da migração MySQL -> PostgreSQL.
//
// Cada teste aqui cobre um defeito que NÃO falha alto: o código roda, devolve 200 e grava dados
// errados. Testes unitários com mock passam em todos eles, por isso precisam de banco real.
// Rodar com INTEGRATION_DB=1 contra o banco de teste.

const enabled = process.env.INTEGRATION_DB === '1';

test('transação reverte de fato em vez de virar autocommit', { skip: !enabled }, async () => {
  // work.service.js decide se transaciona com `if (connection.beginTransaction)`. Se o driver não
  // expuser esses métodos, o feature-detect falha aberto: tudo é gravado sem transação e sem
  // rollback — e os testes com mock continuam verdes, porque o mock define os métodos.
  const [antesOs] = await pool.execute('SELECT COUNT(*) AS n FROM os WHERE empresa = 1');
  const [antesItens] = await pool.execute('SELECT COUNT(*) AS n FROM produtos_orc');

  await assert.rejects(
    () => createWork('orders', {
      cliente: 1,
      data: new Date().toISOString().slice(0, 10),
      status: 'Aberta',
      items: [
        { kind: 'product', itemId: 1, quantity: 1 },
        { kind: 'product', itemId: 999999, quantity: 1 }
      ]
    }, 1, 1),
    'o item inexistente precisa derrubar a operação'
  );

  const [depoisOs] = await pool.execute('SELECT COUNT(*) AS n FROM os WHERE empresa = 1');
  const [depoisItens] = await pool.execute('SELECT COUNT(*) AS n FROM produtos_orc');
  assert.equal(Number(depoisOs[0].n), Number(antesOs[0].n), 'sobrou OS órfã: a transação não reverteu');
  assert.equal(Number(depoisItens[0].n), Number(antesItens[0].n), 'sobraram itens órfãos');

  // Um cliente devolvido ao pool com transação aberta envenena as próximas requisições.
  const [vivo] = await pool.execute('SELECT 1 AS v');
  assert.equal(vivo[0].v, 1, 'pool ficou inutilizável após o erro');
});

test('EXTRACT devolve inteiro e o balanço anual não zera os meses', { skip: !enabled }, async () => {
  // EXTRACT() devolve numeric no PostgreSQL. Sem ::int a chave vira string, o Map.get(mes) do
  // relatório não casa e todos os doze meses voltam zerados — sem erro nenhum.
  const ano = 2099; // ano isolado, para não colidir com dados de outros testes
  await pool.execute(
    `INSERT INTO receber (descricao, cliente, valor, subtotal, vencimento, data_pgto, pago, empresa, data_lanc, usuario_lanc, forma_pgto)
     VALUES ('Regressao marco', 1, 100, 100, ?, ?, 'Sim', 1, CURRENT_DATE, 1, 0),
            ('Regressao julho', 1, 200, 200, ?, ?, 'Sim', 1, CURRENT_DATE, 1, 0)`,
    [`${ano}-03-10`, `${ano}-03-10`, `${ano}-07-10`, `${ano}-07-10`]
  );
  try {
    const balanco = await annualBalanceReport(1, ano);
    const marco = balanco.find((linha) => linha.mes === 3);
    const julho = balanco.find((linha) => linha.mes === 7);
    assert.ok(marco, 'mês 3 não veio como inteiro na chave');
    assert.ok(Number(marco.receitas) > 0, 'março zerado: EXTRACT provavelmente voltou string');
    assert.ok(Number(julho.receitas) > 0, 'julho zerado: EXTRACT provavelmente voltou string');
  } finally {
    await pool.execute("DELETE FROM receber WHERE descricao LIKE 'Regressao %' AND empresa = 1");
  }
});

test('join de cobrança recorrente casa com frequência de id >= 10', { skip: !enabled }, async () => {
  // O MySQL usava CAST(f.id AS CHAR) para pontear INT com VARCHAR. No PostgreSQL CHAR é char(1):
  // truncaria todo id >= 10 e o join passaria a falhar só a partir da décima frequência — por isso
  // este teste precisa de id >= 10, um com id 1 passaria enquanto produção quebrava.
  await pool.execute("DELETE FROM frequencias WHERE frequencia LIKE 'Regressao freq%'");
  let freqId = 0;
  for (let i = 0; i < 12; i++) {
    const [inserida] = await pool.execute(
      'INSERT INTO frequencias (frequencia, dias, empresa) VALUES (?, ?, 1)',
      [`Regressao freq ${i}`, 30]
    );
    freqId = inserida.insertId;
  }
  assert.ok(freqId >= 10, 'o cenário exige uma frequência com id >= 10');

  const [cobranca] = await pool.execute(
    `INSERT INTO cobrancas (descricao, cliente, valor, frequencia, data, data_venc, empresa, node_status, usuario)
     VALUES ('Regressao cobranca', 1, 50, ?, CURRENT_DATE, ?, 1, 'ativo', 1)`,
    [freqId, new Date().toISOString().slice(0, 10)]
  );
  try {
    const [linhas] = await pool.execute(
      `SELECT f.frequencia AS nome FROM cobrancas c
         LEFT JOIN frequencias f ON f.id = c.frequencia AND f.empresa = c.empresa
        WHERE c.id = ?`,
      [cobranca.insertId]
    );
    assert.ok(linhas[0].nome, `join não casou para frequência id ${freqId}`);
  } finally {
    await pool.execute('DELETE FROM cobrancas WHERE id = ?', [cobranca.insertId]);
    await pool.execute("DELETE FROM frequencias WHERE frequencia LIKE 'Regressao freq%'");
  }
});

test('gravar uma OS não produz NaN nas colunas financeiras', { skip: !enabled }, async () => {
  // Este é o teste que realmente importa: work.service.js lê `rows[0].unitPrice` de um alias
  // camelCase. Sem aspas no alias o PostgreSQL devolve `unitprice`, o JS lê undefined, o cálculo
  // vira NaN — e o tipo numeric ACEITA NaN em silêncio. Precisa exercitar a escrita de verdade,
  // não só inspecionar dados já existentes.
  const hoje = new Date().toISOString().slice(0, 10);
  // createWork devolve o id da OS diretamente, não um objeto.
  const osId = await createWork('orders', {
    cliente: 1,
    data: hoje,
    data_entrega: hoje,
    status: 'Aberta',
    items: [{ kind: 'product', itemId: 1, quantity: 2 }]
  }, 1, 1);

  try {
    const [itens] = await pool.execute(
      'SELECT valor, total FROM produtos_orc WHERE os = ?',
      [osId]
    );
    assert.ok(itens.length > 0, 'a OS não gravou itens');
    for (const item of itens) {
      assert.ok(Number.isFinite(Number(item.valor)), `valor não é finito: ${item.valor}`);
      assert.ok(Number(item.total) > 0, `total inválido: ${item.total}`);
    }

    const [naoNumericos] = await pool.execute(
      `SELECT COUNT(*) AS n FROM produtos_orc WHERE os = ? AND (valor = 'NaN'::numeric OR total = 'NaN'::numeric)`,
      [osId]
    );
    assert.equal(Number(naoNumericos[0].n), 0, 'gravou NaN — alias camelCase provavelmente perdeu as aspas');
  } finally {
    await pool.execute('DELETE FROM produtos_orc WHERE os = ?', [osId]);
    await pool.execute('DELETE FROM servicos_orc WHERE os = ?', [osId]);
    await pool.execute('DELETE FROM os WHERE id = ? AND empresa = 1', [osId]);
  }
});

test('aliases camelCase chegam ao JS com a grafia original', { skip: !enabled }, async () => {
  // Verificação direta do contrato que o frontend consome.
  const [linhas] = await pool.execute('SELECT 1 AS "unitPrice", 2 AS "itemId", 3 AS "employeeId"');
  assert.deepEqual(Object.keys(linhas[0]).sort(), ['employeeId', 'itemId', 'unitPrice']);
});

test('sequências ficam sincronizadas depois do seed com id explícito', { skip: !enabled }, async () => {
  // As fixtures inserem id explícito; sem setval() a sequência fica em 1 e o primeiro INSERT da
  // aplicação colide na chave primária.
  const [novo] = await pool.execute(
    "INSERT INTO clientes (nome, ativo, empresa, data_cad) VALUES ('Regressao sequencia', 'Sim', 1, CURRENT_DATE)"
  );
  assert.ok(novo.insertId > 0);
  await pool.execute('DELETE FROM clientes WHERE id = ?', [novo.insertId]);
});

test('numeração fiscal reserva números sem repetir', { skip: !enabled }, async () => {
  // O upsert com RETURNING substitui o par INSERT + SELECT do MySQL, que abria janela para duas
  // transações lerem o mesmo número.
  const reservar = async () => {
    const [linhas] = await pool.execute(
      `INSERT INTO node_fiscal_numeracao (empresa, modelo, serie, ultimo_numero) VALUES (1, '99', '1', 1)
       ON CONFLICT (empresa, modelo, serie)
       DO UPDATE SET ultimo_numero = node_fiscal_numeracao.ultimo_numero + 1
       RETURNING ultimo_numero`
    );
    return Number(linhas[0].ultimo_numero);
  };
  try {
    const primeiro = await reservar();
    const segundo = await reservar();
    assert.equal(segundo, primeiro + 1, 'a numeração fiscal repetiu ou pulou');
  } finally {
    await pool.execute("DELETE FROM node_fiscal_numeracao WHERE empresa = 1 AND modelo = '99'");
  }
});

test('COUNT(*) chega ao JS como número, não string', { skip: !enabled }, async () => {
  // O PostgreSQL tipa COUNT como int8, que o driver devolveria como string; o mysql2 devolvia
  // número. O shim alinha o comportamento para não quebrar os pontos que fazem conta com o total.
  const [linhas] = await pool.execute('SELECT COUNT(*) AS total FROM usuarios');
  assert.equal(typeof linhas[0].total, 'number');
});
