'use strict';

// Adaptador do Padrão Nacional da NFS-e (SEFIN Nacional).
// Fluxo: carregar o certificado A1 -> assinar o DPS (XML-DSig) -> transmitir em homologacao.
// O certificado nunca chega por parametro de rede: e lido de um arquivo em pasta protegida
// e a senha vem de variavel de ambiente. Nada de segredo em codigo, log ou banco.
// Os algoritmos de assinatura e o contrato de transporte seguem o padrao XML-DSig e o
// ambiente nacional; os detalhes finos devem ser conferidos contra o manual na homologacao.

const fs = require('node:fs');
const zlib = require('node:zlib');
const https = require('node:https');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const endpoints = require('../endpoints');

const SIG_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

// Le o certificado A1 (.pfx) do caminho informado e a senha da variavel de ambiente.
// Lanca 428 quando falta configuracao, para o chamador manter o documento como pendente.
function loadCertificate({ path: pfxPath, password, passwordEnv } = {}) {
  if (!pfxPath) {
    throw Object.assign(new Error('Certificado fiscal não configurado: caminho do arquivo ausente.'), { status: 428, code: 'CERT_NAO_CONFIGURADO' });
  }
  const envName = passwordEnv || 'FISCAL_CERT_PASSWORD';
  const senha = password || process.env[envName];
  if (!senha) {
    throw Object.assign(new Error(`Senha do certificado ausente: cadastre o certificado na configuração fiscal ou defina a variável de ambiente ${envName}.`), { status: 428, code: 'CERT_SENHA_AUSENTE' });
  }
  const der = fs.readFileSync(pfxPath, 'binary');
  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), senha);
  } catch {
    throw Object.assign(new Error('Não foi possível abrir o certificado: arquivo inválido ou senha incorreta.'), { status: 422, code: 'CERT_INVALIDO' });
  }
  const keyBag = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  const certBag = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [])[0];
  if (!keyBag || !certBag) {
    throw Object.assign(new Error('Certificado sem chave privada ou sem certificado utilizável.'), { status: 422, code: 'CERT_INVALIDO' });
  }
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certificatePem: forge.pki.certificateToPem(certBag.cert),
    pfx: Buffer.from(der, 'binary'),
    password: senha
  };
}

// Assina o elemento infDPS com XML-DSig enveloped (RSA-SHA256, C14N) e inclui o X509.
function signDps(xml, { privateKeyPem, certificatePem }) {
  const sig = new SignedXml({ privateKey: privateKeyPem, publicCert: certificatePem });
  sig.signatureAlgorithm = SIG_ALG;
  sig.canonicalizationAlgorithm = C14N;
  sig.addReference({
    xpath: "//*[local-name(.)='infDPS']",
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA256
  });
  sig.getKeyInfoContent = () => {
    const b64 = certificatePem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
    return `<X509Data><X509Certificate>${b64}</X509Certificate></X509Data>`;
  };
  sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='infDPS']", action: 'after' } });
  return sig.getSignedXml();
}

// Transmite o DPS assinado ao SEFIN Nacional. Corpo gzip+base64 e mTLS com o proprio A1.
// path/corpo/mTLS a confirmar no manual; isolado aqui para ajuste sem tocar no restante.
function transmit(signedXml, { ambiente, certificate }) {
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';
  const base = endpoints.nfseNacional[env].sefin;
  const dpsXmlGZipB64 = zlib.gzipSync(Buffer.from(signedXml, 'utf8')).toString('base64');
  const body = JSON.stringify({ dpsXmlGZipB64 });
  const url = new URL(base + '/API/SefinNacional/nfse');
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
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
    req.write(body);
    req.end();
  });
}

// Orquestra a emissao: carrega o certificado, assina e transmite.
async function emit({ xml, ambiente, certConfig }) {
  const certificate = loadCertificate(certConfig);
  const signedXml = signDps(xml, certificate);
  const response = await transmit(signedXml, { ambiente, certificate });
  return { signedXml, response };
}

module.exports = { loadCertificate, signDps, transmit, emit };
