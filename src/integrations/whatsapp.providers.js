// Provedores de WhatsApp suportados, espelhando o legado (painel/apis/texto.php), onde cada
// empresa escolhia o seu em `config.api_whatsapp`: 'Não', 'menuia', 'wm' ou 'newtek'.
// Os três usam as mesmas duas credenciais por empresa, com nomes diferentes em cada API:
//   token_whatsapp     → appkey (menuia) | token (wm, newtek)
//   instancia_whatsapp → authkey (menuia) | instance (wm) | instancia (newtek)

const { requestForm, requestJson } = require('./http-client');

// URLs iguais às do legado. Sobrescrevíveis por ambiente caso o provedor mude de endpoint.
const MENUIA_URL = process.env.WHATSAPP_MENUIA_URL || 'https://chatbot.menuia.com/api/create-message';
// ATENÇÃO: o legado usa http:// aqui, ou seja, o token trafega em texto puro. Mantido como padrão
// para não quebrar quem já usa; defina WHATSAPP_WM_URL com https:// se o provedor suportar.
const WM_URL = process.env.WHATSAPP_WM_URL || 'http://api.wordmensagens.com.br/send-text';
const NEWTEK_URL = process.env.WHATSAPP_NEWTEK_URL || 'https://webapi.newteksoft.com.br/enviar-texto';
// Licença do revendedor na menuia — variava por instalação no legado ('hugocursos', 'monielsistemas').
const MENUIA_LICENCE = process.env.WHATSAPP_MENUIA_LICENCE || '';

// O legado gravava quebras de linha como %0A no corpo da mensagem e desfazia antes de enviar.
const decodeBreaks = (message) => String(message ?? '').replace(/%0A/g, '\n');

const providers = {
  menuia: {
    label: 'Menuia',
    async send({ token, instance, phone, message }) {
      return requestForm(MENUIA_URL, {
        appkey: token, authkey: instance, to: phone, message: decodeBreaks(message),
        licence: MENUIA_LICENCE, sandbox: 'false'
      });
    }
  },
  wm: {
    label: 'WordMensagens',
    async send({ token, instance, phone, message }) {
      return requestForm(WM_URL, { instance, to: phone, token, message: decodeBreaks(message) });
    }
  },
  newtek: {
    label: 'NewTek',
    async send({ token, instance, phone, message }) {
      return requestJson(NEWTEK_URL, {
        method: 'POST',
        body: { instancia: instance, token, mensagem: decodeBreaks(message), para: [phone], delay: '1' }
      });
    }
  }
};

// Opções oferecidas na tela de configurações — 'Não' desliga o envio, como no legado.
const providerOptions = [
  { value: 'Não', label: 'Não enviar' },
  ...Object.entries(providers).map(([value, { label }]) => ({ value, label }))
];

const isDisabled = (name) => !name || name === 'Não' || name === 'Nao';

module.exports = { providers, providerOptions, isDisabled, decodeBreaks };
