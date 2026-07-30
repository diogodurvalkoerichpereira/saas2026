'use strict';

// Monta e valida o DPS (Documento de Prestação de Serviços) do Padrão Nacional da NFS-e.
// A estrutura segue o layout nacional do DPS. Os nomes de elementos e o XSD exato (versão
// 1.00) devem ser conferidos contra a documentação oficial durante a homologação em
// sefin.producaorestrita.nfse.gov.br antes de emitir com valor fiscal.
// Funções puras: sem acesso a rede, banco, relógio nem certificado.

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

// Retorna a lista de erros de dados obrigatórios. Vazia quando o DPS pode ser montado.
function validateNfse({ emitente, tomador, servico } = {}) {
  const errors = [];
  if (!emitente) {
    errors.push('Emitente ausente.');
  } else {
    if (!onlyDigits(emitente.cnpj)) errors.push('CNPJ do emitente ausente.');
    if (!emitente.inscricaoMunicipal) errors.push('Inscrição municipal do emitente ausente.');
    if (!/^\d{7}$/.test(String(emitente.codigoIbge || ''))) errors.push('Código IBGE do município do emitente inválido.');
  }
  if (!tomador) {
    errors.push('Tomador ausente.');
  } else {
    const doc = onlyDigits(tomador.cnpj || tomador.cpf);
    if (doc.length !== 11 && doc.length !== 14) errors.push('CPF ou CNPJ do tomador inválido.');
    if (!tomador.nome) errors.push('Nome do tomador ausente.');
  }
  if (!servico) {
    errors.push('Serviço ausente.');
  } else {
    if (!servico.codigoTributacaoNacional) errors.push('Código de tributação nacional (LC 116) ausente.');
    if (!(Number(servico.valor) > 0)) errors.push('Valor do serviço deve ser maior que zero.');
    if (servico.aliquotaIss === undefined || servico.aliquotaIss === null) errors.push('Alíquota de ISS ausente.');
    if (!servico.descricao) errors.push('Descrição do serviço ausente.');
  }
  return errors;
}

// Monta o XML do DPS. Lança erro 422 com a lista de campos quando faltam dados obrigatórios.
// dhEmi e competencia são injetados pelo chamador para manter a função determinística.
function buildDps(data) {
  const errors = validateNfse(data);
  if (errors.length) {
    throw Object.assign(new Error('Dados fiscais incompletos: ' + errors.join(' ')), { status: 422, errors });
  }
  const { ambiente, emitente, tomador, servico, numero, serie, dhEmi, competencia } = data;
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const tomDoc = onlyDigits(tomador.cnpj || tomador.cpf);
  const tomadorDocTag = tomDoc.length === 14 ? `<CNPJ>${tomDoc}</CNPJ>` : `<CPF>${tomDoc}</CPF>`;
  const opSimpNac = emitente.regime === 'Simples Nacional' ? '1' : '2';
  const valor = Number(servico.valor).toFixed(2);
  const aliq = Number(servico.aliquotaIss).toFixed(2);
  const id = `DPS${onlyDigits(emitente.codigoIbge)}${onlyDigits(emitente.cnpj).padStart(14, '0')}${String(serie).padStart(5, '0')}${String(numero).padStart(15, '0')}`;

  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse">' +
    `<infDPS Id="${esc(id)}">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<dhEmi>${esc(dhEmi)}</dhEmi>` +
    '<verAplic>saas2026-1.0</verAplic>' +
    `<serie>${esc(serie)}</serie>` +
    `<nDPS>${esc(numero)}</nDPS>` +
    `<dCompet>${esc(competencia)}</dCompet>` +
    '<tpEmit>1</tpEmit>' +
    `<cLocEmi>${esc(emitente.codigoIbge)}</cLocEmi>` +
    `<prest><CNPJ>${onlyDigits(emitente.cnpj)}</CNPJ><IM>${esc(emitente.inscricaoMunicipal)}</IM><regTrib><opSimpNac>${opSimpNac}</opSimpNac></regTrib></prest>` +
    `<toma>${tomadorDocTag}<xNome>${esc(tomador.nome)}</xNome></toma>` +
    '<serv><locPrest>' +
    `<cLocPrestacao>${esc(emitente.codigoIbge)}</cLocPrestacao></locPrest><cServ>` +
    `<cTribNac>${esc(servico.codigoTributacaoNacional)}</cTribNac>` +
    (servico.codigoTributacaoMunicipio ? `<cTribMun>${esc(servico.codigoTributacaoMunicipio)}</cTribMun>` : '') +
    `<xDescServ>${esc(servico.descricao)}</xDescServ></cServ></serv>` +
    `<valores><vServPrest><vServ>${valor}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><pAliq>${aliq}</pAliq></tribMun></trib></valores>` +
    '</infDPS>' +
    '</DPS>';
}

module.exports = { validateNfse, buildDps, esc, onlyDigits };
