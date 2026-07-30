'use strict';

// Adaptador da NF-e (SEFAZ, autorizador da UF).
// Assina o infNFe (XML-DSig RSA-SHA1, padrão consolidado da NF-e), monta o envelope SOAP do
// serviço NFeAutorizacao4 e transmite com mTLS usando o mesmo certificado A1. O certificado é
// lido do caminho protegido e a senha da variável de ambiente, reutilizando o carregador da NFS-e.
// Autorizador da UF, XSD e cabeçalho SOAP devem ser confirmados na homologação.

const https = require('node:https');
const { SignedXml } = require('xml-crypto');
const endpoints = require('../endpoints');
const { loadCertificate } = require('./nfse-nacional');

const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

function signNfe(xml, { privateKeyPem, certificatePem }, chave) {
  const sig = new SignedXml({ privateKey: privateKeyPem, publicCert: certificatePem });
  sig.signatureAlgorithm = RSA_SHA1;
  sig.canonicalizationAlgorithm = C14N;
  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
    uri: `#NFe${chave}`
  });
  sig.getKeyInfoContent = () => {
    const b64 = certificatePem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
    return `<X509Data><X509Certificate>${b64}</X509Certificate></X509Data>`;
  };
  sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='infNFe']", action: 'after' } });
  return sig.getSignedXml();
}

function buildSoapEnvelope(signedNfe) {
  const nfeSemProlog = signedNfe.replace(/^<\?xml[^>]*\?>/, '');
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap:Body>' +
    '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">' +
    '<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">' +
    '<idLote>1</idLote><indSinc>1</indSinc>' + nfeSemProlog +
    '</enviNFe>' +
    '</nfeDadosMsg>' +
    '</soap:Body>' +
    '</soap:Envelope>';
}

function transmit(soapEnvelope, { ambiente, certificate }) {
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';
  const url = new URL(endpoints.nfeSefaz[env].autorizacao);
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(soapEnvelope) },
        pfx: certificate.pfx,
        passphrase: certificate.password
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(soapEnvelope);
    req.end();
  });
}

async function emit({ xml, chave, ambiente, certConfig }) {
  const certificate = loadCertificate(certConfig);
  const signedXml = signNfe(xml, certificate, chave);
  const envelope = buildSoapEnvelope(signedXml);
  const response = await transmit(envelope, { ambiente, certificate });
  return { signedXml, response };
}

module.exports = { signNfe, buildSoapEnvelope, transmit, emit };
