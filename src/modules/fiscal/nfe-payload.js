'use strict';

// Monta e valida a NF-e modelo 55, leiaute 4.00, para emitente do Simples Nacional (CSOSN).
// Inclui o cálculo da chave de acesso de 44 posições com dígito verificador (módulo 11).
// A estrutura segue o leiaute nacional da NF-e; o XSD exato e o autorizador da UF devem ser
// conferidos na homologação antes de emitir com valor fiscal. Funções puras.

const { esc, onlyDigits } = require('./nfse-payload');

// Dígito verificador da chave de acesso: módulo 11, pesos 2..9 da direita para a esquerda.
function chaveDv(chave43) {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

// Monta a chave de 44 posições. cUF vem dos dois primeiros dígitos do código IBGE do município.
function montarChave({ codigoIbge, aamm, cnpj, modelo = '55', serie, numero, tpEmis = '1', cNF }) {
  const cUF = String(codigoIbge).slice(0, 2);
  const base = `${cUF}${aamm}${onlyDigits(cnpj).padStart(14, '0')}${modelo}${String(serie).padStart(3, '0')}${String(numero).padStart(9, '0')}${tpEmis}${String(cNF).padStart(8, '0')}`;
  return base + String(chaveDv(base));
}

function validateNfe({ emitente, destinatario, itens } = {}) {
  const errors = [];
  if (!emitente) {
    errors.push('Emitente ausente.');
  } else {
    if (!onlyDigits(emitente.cnpj)) errors.push('CNPJ do emitente ausente.');
    if (!/^\d{7}$/.test(String(emitente.codigoIbge || ''))) errors.push('Código IBGE do município do emitente inválido.');
    if (!emitente.uf) errors.push('UF do emitente ausente.');
  }
  if (!destinatario) {
    errors.push('Destinatário ausente.');
  } else {
    const doc = onlyDigits(destinatario.cnpj || destinatario.cpf);
    if (doc.length !== 11 && doc.length !== 14) errors.push('CPF ou CNPJ do destinatário inválido.');
    if (!destinatario.nome) errors.push('Nome do destinatário ausente.');
  }
  if (!Array.isArray(itens) || !itens.length) {
    errors.push('NF-e sem itens de mercadoria.');
  } else {
    itens.forEach((item, index) => {
      if (!/^\d{8}$/.test(String(item.ncm || ''))) errors.push(`Item ${index + 1}: NCM inválido.`);
      if (!/^\d{4}$/.test(String(item.cfop || ''))) errors.push(`Item ${index + 1}: CFOP inválido.`);
      if (!(Number(item.valorUnitario) > 0)) errors.push(`Item ${index + 1}: valor unitário deve ser maior que zero.`);
    });
  }
  return errors;
}

function buildNfe(data) {
  const errors = validateNfe(data);
  if (errors.length) {
    throw Object.assign(new Error('Dados fiscais incompletos: ' + errors.join(' ')), { status: 422, errors });
  }
  const { ambiente, emitente, destinatario, itens, numero, serie, dhEmi, aamm, cNF } = data;
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const cUF = String(emitente.codigoIbge).slice(0, 2);
  const chave = montarChave({ codigoIbge: emitente.codigoIbge, aamm, cnpj: emitente.cnpj, modelo: '55', serie, numero, tpEmis: '1', cNF });
  const cDV = chave.slice(-1);
  const destDoc = onlyDigits(destinatario.cnpj || destinatario.cpf);
  const destTag = destDoc.length === 14 ? `<CNPJ>${destDoc}</CNPJ>` : `<CPF>${destDoc}</CPF>`;
  const vNF = itens.reduce((sum, item) => sum + Number(item.valorUnitario) * Number(item.quantidade || 1), 0);

  const det = itens.map((item, index) => {
    const qtd = Number(item.quantidade || 1);
    const vProd = (Number(item.valorUnitario) * qtd).toFixed(2);
    return `<det nItem="${index + 1}">` +
      '<prod>' +
      `<cProd>${esc(item.codigo || index + 1)}</cProd>` +
      '<cEAN>SEM GTIN</cEAN>' +
      `<xProd>${esc(item.descricao)}</xProd>` +
      `<NCM>${esc(item.ncm)}</NCM>` +
      `<CFOP>${esc(item.cfop)}</CFOP>` +
      `<uCom>${esc(item.unidade || 'UN')}</uCom>` +
      `<qCom>${qtd.toFixed(4)}</qCom>` +
      `<vUnCom>${Number(item.valorUnitario).toFixed(2)}</vUnCom>` +
      `<vProd>${vProd}</vProd>` +
      '<cEANTrib>SEM GTIN</cEANTrib>' +
      `<uTrib>${esc(item.unidade || 'UN')}</uTrib>` +
      `<qTrib>${qtd.toFixed(4)}</qTrib>` +
      `<vUnTrib>${Number(item.valorUnitario).toFixed(2)}</vUnTrib>` +
      '<indTot>1</indTot>' +
      '</prod>' +
      '<imposto>' +
      `<ICMS><ICMSSN102><orig>${esc(item.origem || '0')}</orig><CSOSN>${esc(item.cstCsosn || '102')}</CSOSN></ICMSSN102></ICMS>` +
      '<PIS><PISNT><CST>07</CST></PISNT></PIS>' +
      '<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>' +
      '</imposto>' +
      '</det>';
  }).join('');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">' +
    `<infNFe versao="4.00" Id="NFe${chave}">` +
    '<ide>' +
    `<cUF>${cUF}</cUF>` +
    `<cNF>${String(cNF).padStart(8, '0')}</cNF>` +
    '<natOp>Venda</natOp>' +
    '<mod>55</mod>' +
    `<serie>${esc(serie)}</serie>` +
    `<nNF>${esc(numero)}</nNF>` +
    `<dhEmi>${esc(dhEmi)}</dhEmi>` +
    '<tpNF>1</tpNF>' +
    '<idDest>1</idDest>' +
    `<cMunFG>${esc(emitente.codigoIbge)}</cMunFG>` +
    '<tpImp>1</tpImp>' +
    '<tpEmis>1</tpEmis>' +
    `<cDV>${cDV}</cDV>` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    '<finNFe>1</finNFe>' +
    '<indFinal>1</indFinal>' +
    '<indPres>1</indPres>' +
    '<procEmi>0</procEmi>' +
    '<verProc>saas2026-1.0</verProc>' +
    '</ide>' +
    `<emit><CNPJ>${onlyDigits(emitente.cnpj)}</CNPJ><xNome>${esc(emitente.razaoSocial || emitente.nome)}</xNome>` +
    `<enderEmit><xLgr>${esc(emitente.logradouro || 'Nao informado')}</xLgr><nro>${esc(emitente.numero || 'S/N')}</nro><xBairro>${esc(emitente.bairro || 'Centro')}</xBairro><cMun>${esc(emitente.codigoIbge)}</cMun><xMun>${esc(emitente.cidade || '')}</xMun><UF>${esc(emitente.uf)}</UF><CEP>${onlyDigits(emitente.cep) || '00000000'}</CEP></enderEmit>` +
    `<IE>${esc(emitente.inscricaoEstadual || 'ISENTO')}</IE><CRT>1</CRT></emit>` +
    `<dest>${destTag}<xNome>${esc(destinatario.razaoSocial || destinatario.nome)}</xNome><indIEDest>9</indIEDest></dest>` +
    det +
    `<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vProd>${vNF.toFixed(2)}</vProd><vNF>${vNF.toFixed(2)}</vNF></ICMSTot></total>` +
    '<transp><modFrete>9</modFrete></transp>' +
    `<pag><detPag><tPag>01</tPag><vPag>${vNF.toFixed(2)}</vPag></detPag></pag>` +
    '</infNFe>' +
    '</NFe>';

  return { xml, chave };
}

module.exports = { chaveDv, montarChave, validateNfe, buildNfe };
