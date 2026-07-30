'use strict';

// Endpoints oficiais do Padrão Nacional da NFS-e (gov.br/nfse).
// "producao restrita" e o ambiente de homologacao. As URLs de producao e o caminho/contrato
// exato da API (path, corpo, necessidade de mTLS) devem ser confirmados contra o manual
// do contribuinte antes de emitir com valor fiscal.
module.exports = {
  nfseNacional: {
    homologacao: {
      sefin: 'https://sefin.producaorestrita.nfse.gov.br',
      adn: 'https://adn.producaorestrita.nfse.gov.br'
    },
    producao: {
      sefin: 'https://sefin.nfse.gov.br',
      adn: 'https://adn.nfse.gov.br'
    }
  },
  // NF-e: SC opera pelo autorizador SVRS. Confirmar o autorizador e a URL na homologação.
  nfeSefaz: {
    homologacao: { autorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NFeAutorizacao/NFeAutorizacao4.asmx' },
    producao: { autorizacao: 'https://nfe.svrs.rs.gov.br/ws/NFeAutorizacao/NFeAutorizacao4.asmx' }
  }
};
