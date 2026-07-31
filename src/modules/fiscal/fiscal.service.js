'use strict';

const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const forge = require('node-forge');
const { pool } = require('../../config/database');
const { buildDps } = require('./nfse-payload');
const { buildNfe } = require('./nfe-payload');
const { encrypt, decrypt } = require('./crypto');
const provider = require('./providers/nfse-nacional');
const nfeProvider = require('./providers/nfe-sefaz');

const uploadRoot = path.resolve(__dirname, '..', '..', '..', 'uploads');

// Config fiscal por empresa. Guarda apenas referencias ao certificado, nunca o segredo.
async function getFiscalConfig(companyId, db = pool) {
  const [rows] = await db.execute('SELECT * FROM node_fiscal_config WHERE empresa = ? LIMIT 1', [companyId]);
  return rows[0] || null;
}

async function upsertFiscalConfig(companyId, userId, data, db = pool) {
  await db.execute(
    `INSERT INTO node_fiscal_config
       (empresa, ambiente, emite_nfse, emite_nfe, certificado_ref, certificado_senha_ref, certificado_validade, regime_especial, incentivo_fiscal, atualizado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ambiente = VALUES(ambiente), emite_nfse = VALUES(emite_nfse), emite_nfe = VALUES(emite_nfe),
       certificado_ref = VALUES(certificado_ref), certificado_senha_ref = VALUES(certificado_senha_ref),
       certificado_validade = VALUES(certificado_validade), regime_especial = VALUES(regime_especial),
       incentivo_fiscal = VALUES(incentivo_fiscal), atualizado_por = VALUES(atualizado_por)`,
    [
      companyId, data.ambiente || 'homologacao', data.emiteNfse || 'Sim', data.emiteNfe || 'Nao',
      data.certificadoRef || null, data.certificadoSenhaRef || null, data.certificadoValidade || null,
      data.regimeEspecial || null, data.incentivoFiscal || 'Nao', userId
    ]
  );
  // Dados do emitente ficam em `empresas`, que é a origem lida pela emissão. Só grava os
  // campos fiscais informados, sem apagar o restante do cadastro da empresa.
  const emit = data.emitente || {};
  const map = {
    cnpj: emit.cnpj, razao_social: emit.razaoSocial, inscricao_estadual: emit.inscricaoEstadual,
    inscricao_municipal: emit.inscricaoMunicipal, codigo_ibge: emit.codigoIbge,
    regime_tributario: emit.regimeTributario, cnae: emit.cnae
  };
  const set = Object.entries(map).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (set.length) {
    await db.execute(
      `UPDATE empresas SET ${set.map(([col]) => `${col} = ?`).join(', ')} WHERE id = ?`,
      [...set.map(([, value]) => value), companyId]
    );
  }
  return getFiscalConfig(companyId, db);
}

// Recebe o certificado A1 (.pfx), valida abrindo com a senha, extrai a validade, salva o
// arquivo em pasta protegida (uploads/ não é servida publicamente) e grava no config o
// caminho, a senha CIFRADA e a validade. A senha nunca é gravada em texto.
async function saveCertificate(companyId, buffer, senha, nomeOriginal, userId, db = pool) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw Object.assign(new Error('Arquivo do certificado vazio.'), { status: 400 });
  if (!senha) throw Object.assign(new Error('Informe a senha do certificado.'), { status: 400 });
  let validade = null;
  try {
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(buffer.toString('binary')), senha);
    const certBag = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [])[0];
    if (!certBag) throw new Error('sem certificado');
    validade = certBag.cert.validity.notAfter.toISOString().slice(0, 10);
  } catch {
    throw Object.assign(new Error('Não foi possível abrir o certificado: arquivo inválido ou senha incorreta.'), { status: 422, code: 'CERT_INVALIDO' });
  }
  const folder = path.join(uploadRoot, String(companyId), 'fiscal');
  await fs.promises.mkdir(folder, { recursive: true });
  const absolutePath = path.join(folder, 'certificado.pfx');
  await fs.promises.writeFile(absolutePath, buffer);
  const nome = String(nomeOriginal || 'certificado.pfx').slice(0, 180);
  await db.execute(
    `INSERT INTO node_fiscal_config (empresa, certificado_ref, certificado_senha_cifrada, certificado_validade, certificado_nome, atualizado_por)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE certificado_ref = VALUES(certificado_ref), certificado_senha_cifrada = VALUES(certificado_senha_cifrada),
       certificado_validade = VALUES(certificado_validade), certificado_nome = VALUES(certificado_nome), atualizado_por = VALUES(atualizado_por)`,
    [companyId, absolutePath, encrypt(senha), validade, nome, userId || null]
  );
  return { validade, nome };
}

// Reserva o proximo numero de forma atomica dentro da conexao/transacao do chamador.
async function reserveNumero(conn, companyId, modelo, serie) {
  await conn.execute(
    `INSERT INTO node_fiscal_numeracao (empresa, modelo, serie, ultimo_numero)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE ultimo_numero = ultimo_numero + 1`,
    [companyId, modelo, serie]
  );
  const [rows] = await conn.execute(
    'SELECT ultimo_numero FROM node_fiscal_numeracao WHERE empresa = ? AND modelo = ? AND serie = ?',
    [companyId, modelo, serie]
  );
  return rows[0].ultimo_numero;
}

async function getDocument(id, companyId, db = pool) {
  const [docs] = await db.execute('SELECT * FROM node_fiscal_documentos WHERE id = ? AND empresa = ? LIMIT 1', [id, companyId]);
  if (!docs[0]) throw Object.assign(new Error('Documento fiscal não encontrado.'), { status: 404 });
  const [items] = await db.execute('SELECT * FROM node_fiscal_documento_itens WHERE documento = ? ORDER BY id', [id]);
  return { ...docs[0], itens: items };
}

async function listDocuments(companyId, db = pool) {
  const [rows] = await db.execute(
    'SELECT id, modelo, venda, cliente, numero, serie, chave_acesso, status, ambiente, valor_total, data_emissao, criado_em FROM node_fiscal_documentos WHERE empresa = ? ORDER BY criado_em DESC, id DESC',
    [companyId]
  );
  return rows;
}

// Emite NFS-e a partir de uma venda: monta o DPS com os itens de servico, reserva numero,
// grava o documento e transmite. Se o certificado ainda nao estiver no ambiente, o documento
// fica como pendente com o motivo, sem quebrar a venda. MVP consolida os itens de servico da
// venda em um DPS; cenarios com servicos distintos podem exigir refino para varios DPS.
async function emitNfseFromSale({ saleId, companyId, userId, now = new Date() }, db = pool) {
  const config = await getFiscalConfig(companyId, db);
  if (!config || config.emite_nfse !== 'Sim') {
    throw Object.assign(new Error('Emissão de NFS-e não habilitada para a empresa.'), { status: 400 });
  }
  const [[sale]] = await db.execute(
    "SELECT id, cliente FROM receber WHERE id = ? AND empresa = ? AND referencia = 'Venda' AND node_status <> 'cancelado' LIMIT 1",
    [saleId, companyId]
  );
  if (!sale) throw Object.assign(new Error('Venda não encontrada ou cancelada.'), { status: 404 });

  const [[emp]] = await db.execute('SELECT nome, razao_social, cnpj, inscricao_municipal, codigo_ibge, regime_tributario FROM empresas WHERE id = ? LIMIT 1', [companyId]);
  const [[cli]] = await db.execute('SELECT nome, cpf, cnpj, tipo_pessoa FROM clientes WHERE id = ? AND empresa = ? LIMIT 1', [sale.cliente, companyId]);
  const [items] = await db.execute(
    `SELECT s.nome, s.codigo_lc116, s.codigo_tributacao_municipio, s.aliquota_iss, i.total
       FROM itens_venda i JOIN servicos s ON s.id = i.produto AND s.empresa = i.empresa
      WHERE i.id_venda = ? AND i.empresa = ? AND i.tipo = 'servico'`,
    [saleId, companyId]
  );
  if (!items.length) throw Object.assign(new Error('Venda sem itens de serviço para emitir NFS-e.'), { status: 422 });

  const valor = items.reduce((sum, it) => sum + Number(it.total), 0);
  const first = items[0];
  const dps = {
    ambiente: config.ambiente,
    emitente: {
      cnpj: emp.cnpj,
      inscricaoMunicipal: emp.inscricao_municipal,
      codigoIbge: emp.codigo_ibge,
      regime: emp.regime_tributario
    },
    tomador: { cnpj: cli.cnpj, cpf: cli.cpf, nome: cli.razao_social || cli.nome },
    servico: {
      codigoTributacaoNacional: first.codigo_lc116,
      codigoTributacaoMunicipio: first.codigo_tributacao_municipio,
      descricao: items.map((it) => it.nome).join('; '),
      valor,
      aliquotaIss: first.aliquota_iss
    }
  };

  const serie = '1';
  const referencia = randomUUID();
  const conn = await db.getConnection();
  let docId;
  let xml;
  try {
    await conn.beginTransaction();
    const numero = await reserveNumero(conn, companyId, 'nfse', serie);
    const iso = now.toISOString();
    dps.numero = numero;
    dps.serie = serie;
    dps.dhEmi = iso.replace('Z', '-03:00');
    dps.competencia = iso.slice(0, 10);
    xml = buildDps(dps);
    const [ins] = await conn.execute(
      `INSERT INTO node_fiscal_documentos (empresa, modelo, venda, cliente, referencia, numero, serie, status, ambiente, valor_total, criado_por)
       VALUES (?, 'nfse', ?, ?, ?, ?, ?, 'processando', ?, ?, ?)`,
      [companyId, saleId, sale.cliente, referencia, numero, serie, config.ambiente, valor.toFixed(2), userId]
    );
    docId = ins.insertId;
    for (const it of items) {
      await conn.execute(
        `INSERT INTO node_fiscal_documento_itens (documento, descricao, quantidade, valor_unitario, valor_total, ncm_lc116, aliquota, tributo)
         VALUES (?, ?, 1, ?, ?, ?, ?, 'ISS')`,
        [docId, it.nome, Number(it.total).toFixed(2), Number(it.total).toFixed(2), it.codigo_lc116, it.aliquota_iss]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  // Transmissao fora da transacao: falha aqui nao desfaz o documento, permite reprocesso.
  try {
    const { response } = await provider.emit({
      xml,
      ambiente: config.ambiente,
      certConfig: { path: config.certificado_ref, password: config.certificado_senha_cifrada ? decrypt(config.certificado_senha_cifrada) : undefined, passwordEnv: config.certificado_senha_ref }
    });
    const ok = response.statusCode >= 200 && response.statusCode < 300;
    await pool.execute(
      'UPDATE node_fiscal_documentos SET status = ?, motivo_rejeicao = ?, data_emissao = ?, tentativas = tentativas + 1 WHERE id = ? AND empresa = ?',
      [ok ? 'autorizado' : 'rejeitado', ok ? null : String(response.body).slice(0, 500), ok ? now : null, docId, companyId]
    );
  } catch (error) {
    const pendente = error.code === 'CERT_NAO_CONFIGURADO' || error.code === 'CERT_SENHA_AUSENTE';
    await pool.execute(
      'UPDATE node_fiscal_documentos SET status = ?, motivo_rejeicao = ?, tentativas = tentativas + 1 WHERE id = ? AND empresa = ?',
      [pendente ? 'pendente' : 'erro', error.message.slice(0, 500), docId, companyId]
    );
  }
  return getDocument(docId, companyId);
}

// Emite NF-e (mercadoria) a partir de uma venda: monta a NFe 4.00 com os itens de mercadoria,
// reserva numero, grava e transmite ao autorizador. Sem certificado no ambiente, fica pendente.
async function emitNfeFromSale({ saleId, companyId, userId, now = new Date() }, db = pool) {
  const config = await getFiscalConfig(companyId, db);
  if (!config || config.emite_nfe !== 'Sim') {
    throw Object.assign(new Error('Emissão de NF-e não habilitada para a empresa.'), { status: 400 });
  }
  const [[sale]] = await db.execute(
    "SELECT id, cliente FROM receber WHERE id = ? AND empresa = ? AND referencia = 'Venda' AND node_status <> 'cancelado' LIMIT 1",
    [saleId, companyId]
  );
  if (!sale) throw Object.assign(new Error('Venda não encontrada ou cancelada.'), { status: 404 });

  const [[emp]] = await db.execute('SELECT nome, razao_social, cnpj, inscricao_estadual, codigo_ibge, endereco, numero, bairro, cidade, estado, cep FROM empresas WHERE id = ? LIMIT 1', [companyId]);
  const [[cli]] = await db.execute('SELECT nome, cpf, cnpj FROM clientes WHERE id = ? AND empresa = ? LIMIT 1', [sale.cliente, companyId]);
  const [items] = await db.execute(
    `SELECT p.nome, p.codigo, p.ncm, p.cfop, p.origem, p.cst_csosn, p.unidade_fiscal, i.quantidade, i.valor
       FROM itens_venda i JOIN produtos p ON p.id = i.produto AND p.empresa = i.empresa
      WHERE i.id_venda = ? AND i.empresa = ? AND p.tipo_fiscal = 'mercadoria'`,
    [saleId, companyId]
  );
  if (!items.length) throw Object.assign(new Error('Venda sem itens de mercadoria para emitir NF-e.'), { status: 422 });

  const nfeItens = items.map((it) => ({
    codigo: it.codigo, descricao: it.nome, ncm: it.ncm, cfop: it.cfop, origem: it.origem,
    cstCsosn: it.cst_csosn, unidade: it.unidade_fiscal || 'UN', quantidade: Number(it.quantidade), valorUnitario: Number(it.valor)
  }));
  const emitente = {
    cnpj: emp.cnpj, razaoSocial: emp.razao_social || emp.nome, codigoIbge: emp.codigo_ibge, uf: emp.estado,
    inscricaoEstadual: emp.inscricao_estadual, cidade: emp.cidade, logradouro: emp.endereco, numero: emp.numero, bairro: emp.bairro, cep: emp.cep
  };
  const destinatario = { cnpj: cli.cnpj, cpf: cli.cpf, nome: cli.nome };

  const serie = '1';
  const referencia = randomUUID();
  const iso = now.toISOString();
  const aamm = iso.slice(2, 4) + iso.slice(5, 7);
  const cNF = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const conn = await db.getConnection();
  let docId;
  let built;
  try {
    await conn.beginTransaction();
    const numero = await reserveNumero(conn, companyId, 'nfe', serie);
    built = buildNfe({ ambiente: config.ambiente, emitente, destinatario, itens: nfeItens, numero, serie, dhEmi: iso.replace('Z', '-03:00'), aamm, cNF });
    const valor = nfeItens.reduce((sum, it) => sum + it.valorUnitario * it.quantidade, 0);
    const [ins] = await conn.execute(
      `INSERT INTO node_fiscal_documentos (empresa, modelo, venda, cliente, referencia, numero, serie, chave_acesso, status, ambiente, valor_total, criado_por)
       VALUES (?, 'nfe', ?, ?, ?, ?, ?, ?, 'processando', ?, ?, ?)`,
      [companyId, saleId, sale.cliente, referencia, numero, serie, built.chave, config.ambiente, valor.toFixed(2), userId]
    );
    docId = ins.insertId;
    for (const it of nfeItens) {
      await conn.execute(
        `INSERT INTO node_fiscal_documento_itens (documento, descricao, quantidade, valor_unitario, valor_total, ncm_lc116, cfop, cst_csosn, tributo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ICMS')`,
        [docId, it.descricao, it.quantidade, it.valorUnitario.toFixed(2), (it.valorUnitario * it.quantidade).toFixed(2), it.ncm, it.cfop, it.cstCsosn]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  try {
    const { response } = await nfeProvider.emit({
      xml: built.xml, chave: built.chave, ambiente: config.ambiente,
      certConfig: { path: config.certificado_ref, password: config.certificado_senha_cifrada ? decrypt(config.certificado_senha_cifrada) : undefined, passwordEnv: config.certificado_senha_ref }
    });
    const ok = response.statusCode >= 200 && response.statusCode < 300;
    await pool.execute(
      'UPDATE node_fiscal_documentos SET status = ?, motivo_rejeicao = ?, data_emissao = ?, tentativas = tentativas + 1 WHERE id = ? AND empresa = ?',
      [ok ? 'autorizado' : 'rejeitado', ok ? null : String(response.body).slice(0, 500), ok ? now : null, docId, companyId]
    );
  } catch (error) {
    const pendente = error.code === 'CERT_NAO_CONFIGURADO' || error.code === 'CERT_SENHA_AUSENTE';
    await pool.execute(
      'UPDATE node_fiscal_documentos SET status = ?, motivo_rejeicao = ?, tentativas = tentativas + 1 WHERE id = ? AND empresa = ?',
      [pendente ? 'pendente' : 'erro', error.message.slice(0, 500), docId, companyId]
    );
  }
  return getDocument(docId, companyId);
}

// Config sem os segredos, para devolver ao frontend (nunca expor senha cifrada nem ref).
function publicFiscalConfig(config) {
  if (!config) return null;
  const { certificado_senha_cifrada, certificado_senha_ref, certificado_ref, ...rest } = config;
  return { ...rest, certificado_configurado: Boolean(certificado_ref) };
}

module.exports = { getFiscalConfig, publicFiscalConfig, upsertFiscalConfig, saveCertificate, reserveNumero, getDocument, listDocuments, emitNfseFromSale, emitNfeFromSale };
