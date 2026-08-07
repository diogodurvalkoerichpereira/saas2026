const grid = document.querySelector('#plans');
const modal = document.querySelector('#sub-modal');
const form = document.querySelector('#sub-form');
const successBox = document.querySelector('#sub-success');
const errorEl = document.querySelector('#sub-error');
const planName = document.querySelector('#sub-plan-name');
const planPrice = document.querySelector('#sub-plan-price');

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 0 ou vazio = ilimitado (mesma regra do backend).
const limitLabel = (value, unit) => (Number(value) > 0 ? `${value} ${unit}` : `${unit} ilimitados`);
const dataBR = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '');

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

function planCard(plan, destaque) {
  const limits = [limitLabel(plan.usuarios, 'usuários'), limitLabel(plan.clientes, 'clientes')].join(' · ');
  return `<article class="plan-card${destaque ? ' popular' : ''}">
    ${destaque ? '<span class="plan-ribbon">Mais completo</span>' : ''}
    <div class="plan-name">${esc(plan.nome)}</div>
    <div class="plan-price">${money(plan.valor)}<small> /mês</small></div>
    <div class="plan-trial">${esc(teste.texto)} para testar</div>
    ${plan.itens && plan.itens.length ? `<ul class="plan-items">${plan.itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    <p class="plan-limits">${esc(limits)}</p>
    <div class="cta"><button class="btn ghost" data-plan="${plan.id}" data-nome="${esc(plan.nome)}" data-valor="${esc(plan.valor)}">Assinar ${esc(plan.nome)}</button></div>
  </article>`;
}

// Formas de pagamento aceitas, vindas do backend. Sem provedor configurado o bloco nem aparece:
// perguntar "Pix ou boleto?" sem ter como abrir a cobrança é pedir dado à toa.
let pagamentoConfig = { habilitado: false, metodos: [] };
// Período de teste: vem do servidor, para a página nunca afirmar um prazo diferente do que o
// cadastro realmente concede.
let teste = { dias: 14, texto: '14 dias grátis' };

function montarMetodos() {
  const bloco = document.querySelector('#sub-pagamento');
  bloco.hidden = !pagamentoConfig.habilitado || !pagamentoConfig.metodos.length;
  if (bloco.hidden) return;
  document.querySelector('#sub-metodos').innerHTML = pagamentoConfig.metodos.map((metodo, index) =>
    `<label class="sub-metodo"><input type="radio" name="forma_pagamento" value="${esc(metodo.value)}" ${index === 0 ? 'checked' : ''}>${esc(metodo.label)}</label>`
  ).join('');
  atualizarEndereco();
}

// Pix não precisa de endereço de cobrança; boleto e cartão precisam. Mostrar os campos só quando
// fazem falta evita fricção no plano de entrada, que é onde ela custa mais caro.
function atualizarEndereco() {
  const escolhido = form.querySelector('[name=forma_pagamento]:checked')?.value || 'pix';
  const endereco = document.querySelector('#sub-endereco');
  const precisa = escolhido !== 'pix';
  endereco.hidden = !precisa;
  endereco.querySelector('[name=cep]').required = precisa;
  endereco.querySelector('[name=numero]').required = precisa;
}

function openSubscribe(planId, nome, valor) {
  form.hidden = false;
  successBox.hidden = true;
  successBox.innerHTML = '';
  form.reset();
  errorEl.textContent = '';
  document.querySelector('#sub-plan-id').value = planId;
  planName.textContent = nome;
  planPrice.innerHTML = `${money(valor)}<small> /mês</small>`;
  document.querySelector('#sub-trial').textContent = `${teste.texto}, depois cobra`;
  montarMetodos();
  modal.showModal();
}

async function submitSubscribe(event) {
  event.preventDefault();
  errorEl.textContent = '';
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const result = await api('/api/public/subscribe', { method: 'POST', body: values });
    form.hidden = true;
    successBox.hidden = false;
    successBox.innerHTML = `
      <h2 style="margin:0">Conta criada! 🎉</h2>
      <p class="muted">Sua conta do plano <strong>${esc(result.plano.nome)}</strong> foi criada com ${esc(teste.texto.replace(' grátis', ''))} de teste grátis.</p>
      <div class="cred-box">
        <div>Acesso: <code>${esc(result.email)}</code></div>
        <div>Senha temporária: <code>${esc(result.tempPassword)}</code></div>
        <div class="muted">Guarde esta senha e troque no primeiro acesso.</div>
      </div>
      ${result.pagamento?.url ? `
        <div class="pay-box">
          <span class="pay-metodo">Pagamento por ${esc(result.pagamento.metodoLabel || 'link seguro')}</span>
          <p class="muted" style="margin:0">Primeira mensalidade de <strong>${money(result.mensalidade.valor)}</strong>, com vencimento em ${dataBR(result.mensalidade.vencimento)}. Você paga na página segura do nosso provedor.</p>
          <a class="btn primary" href="${esc(result.pagamento.url)}" target="_blank" rel="noopener">Pagar agora</a>
        </div>
        <p class="muted" style="font-size:.84rem">O link também fica disponível dentro do sistema, em Assinatura — dá para pagar depois.</p>`
        : result.mensalidade ? `<p class="muted">Primeira mensalidade de <strong>${money(result.mensalidade.valor)}</strong> gerada como pendente, com vencimento em ${dataBR(result.mensalidade.vencimento)} — entraremos em contato com as instruções de pagamento.</p>` : ''}
      <a class="btn ${result.pagamento?.url ? 'ghost' : 'primary'}" href="/index.html?acesso=1">Acessar o sistema</a>`;
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

// Preenche um elemento e o esconde quando o admin deixou o campo em branco — assim uma seção
// vazia some da página em vez de aparecer como um título solto.
function fill(selector, text, { html = false } = {}) {
  const el = document.querySelector(selector);
  if (!el) return false;
  const value = String(text || '').trim();
  if (!value) { el.hidden = true; return false; }
  el.hidden = false;
  if (html) el.innerHTML = value; else el.textContent = value;
  return true;
}

const mediaUrl = (arquivo) => `/api/media/site/${encodeURIComponent(arquivo)}`;

// Logo do topo e imagem de fundo, enviadas no painel. `logo_topo = 'Não'` esconde a logo sem
// precisar apagar o arquivo — é o mesmo interruptor do legado.
function renderImagens(site) {
  const logo = document.querySelector('#hero-logo');
  const mostrarLogo = site.logo && site.logo_topo !== 'Não';
  logo.hidden = !mostrarLogo;
  if (mostrarLogo) logo.src = mediaUrl(site.logo);

  const hero = document.querySelector('.hero');
  hero.classList.toggle('has-bg', Boolean(site.fundo_topo || site.fundo_topo_mobile));
  // O fundo do celular só existe se o admin enviou um; senão o de desktop serve os dois.
  const desktop = site.fundo_topo || site.fundo_topo_mobile;
  const mobile = site.fundo_topo_mobile || site.fundo_topo;
  if (desktop) document.documentElement.style.setProperty('--hero-bg', `url("${mediaUrl(desktop)}")`);
  if (mobile) document.documentElement.style.setProperty('--hero-bg-mobile', `url("${mediaUrl(mobile)}")`);
}

// Cabeçalho, selos e botões — todos escritos no painel SaaS em Site e planos.
function renderHero(site) {
  renderImagens(site);
  fill('#hero-title', site.titulo || 'Escolha o plano ideal para o seu negócio');
  fill('#hero-subtitle', site.subtitulo);
  const selos = [site.item1, site.item2, site.item3].filter(Boolean);
  const trust = document.querySelector('#hero-trust');
  trust.hidden = !selos.length;
  trust.innerHTML = selos.map((item) => `<span>${esc(item)}</span>`).join('');
  // botao1 rola até os planos, botao2 até as perguntas, botao3 leva ao login — como no legado.
  const botoes = [
    site.botao1 && { texto: site.botao1, href: '#plans', classe: 'primary' },
    site.botao2 && { texto: site.botao2, href: '#faq-section', classe: 'ghost' },
    site.botao3 && { texto: site.botao3, href: '/index.html?acesso=1', classe: 'ghost' }
  ].filter(Boolean);
  const cta = document.querySelector('#hero-cta');
  cta.hidden = !botoes.length;
  cta.innerHTML = botoes.map((b) => `<a class="btn ${b.classe}" href="${esc(b.href)}">${esc(b.texto)}</a>`).join('');
}

// Tabela de comparação: cada linha é um recurso do catálogo, cada coluna um plano ativo. Os
// recursos do núcleo aparecem marcados em todos os planos — eles não estão em planos_recursos
// porque qualquer plano os inclui, e omiti-los faria a tabela mentir para o cliente.
function renderCompare(plans, recursos) {
  const section = document.querySelector('#compare-section');
  if (plans.length < 2 || !recursos.length) { section.hidden = true; return; }
  section.hidden = false;

  const liberados = plans.map((plan) => new Set(plan.chaves || []));
  const marca = (temRecurso) => (temRecurso
    ? '<span class="cp-sim" role="img" aria-label="incluído">✓</span>'
    : '<span class="cp-nao" role="img" aria-label="não incluído">–</span>');

  const cabecalho = `<thead><tr><th class="rec">Recurso</th>${plans.map((plan) =>
    `<th><span class="cp-nome">${esc(plan.nome)}</span><span class="cp-valor">${money(plan.valor)}</span></th>`).join('')}</tr></thead>`;

  // Agrupa preservando a ordem em que os grupos aparecem (o backend já ordena por `posicao`).
  const grupos = [];
  for (const recurso of recursos) {
    let grupo = grupos.find((g) => g.nome === recurso.grupo);
    if (!grupo) grupos.push(grupo = { nome: recurso.grupo, itens: [] });
    grupo.itens.push(recurso);
  }

  const corpo = `<tbody>${grupos.map((grupo) => `
    <tr class="cp-grupo"><td colspan="${plans.length + 1}">${esc(grupo.nome)}</td></tr>
    ${grupo.itens.map((recurso) => `<tr><td class="rec">${esc(recurso.nome)}</td>${liberados.map((chaves) =>
      `<td>${marca(recurso.nucleo === 'Sim' || chaves.has(recurso.chave))}</td>`).join('')}</tr>`).join('')}`).join('')}</tbody>`;

  const limite = (valor, unidade) => (Number(valor) > 0 ? Number(valor).toLocaleString('pt-BR') : `${unidade} ilimitados`);
  const rodape = `<tfoot>
    <tr><td class="rec">Usuários</td>${plans.map((p) => `<td>${esc(limite(p.usuarios, 'Usuários'))}</td>`).join('')}</tr>
    <tr><td class="rec">Clientes</td>${plans.map((p) => `<td>${esc(limite(p.clientes, 'Clientes'))}</td>`).join('')}</tr>
    <tr><td class="rec"></td>${plans.map((p) =>
      `<td class="compare-cta"><button class="btn primary" data-plan="${p.id}" data-nome="${esc(p.nome)}" data-valor="${esc(p.valor)}">Assinar</button></td>`).join('')}</tr>
  </tfoot>`;

  document.querySelector('#compare-table').innerHTML = cabecalho + corpo + rodape;
}

function renderFeatures(titulo, features) {
  const section = document.querySelector('#features-section');
  if (!features.length) { section.hidden = true; return; }
  section.hidden = false;
  fill('#features-title', titulo || 'Tudo que você precisa para gerir');
  document.querySelector('#features-grid').innerHTML = features.map((item) => `
    <div class="feature-card">
      ${item.icone_recurso ? `<svg aria-hidden="true"><use href="/icons.svg#${esc(item.icone_recurso)}"></use></svg>` : ''}
      <strong>${esc(item.titulo_recurso)}</strong>
      ${item.descricao_recurso ? `<span>${esc(item.descricao_recurso)}</span>` : ''}
    </div>`).join('');
}

function renderFaqs(titulo, faqs) {
  const section = document.querySelector('#faq-section');
  if (!faqs.length) { section.hidden = true; return; }
  section.hidden = false;
  fill('#faq-title', titulo || 'Perguntas frequentes');
  document.querySelector('#faq-list').innerHTML = faqs.map((item) => `
    <details class="faq-item">
      <summary>${esc(item.titulo_pergunta)}</summary>
      <p>${esc(item.descricao_pergunta)}</p>
    </details>`).join('');
}

function renderClosing(site) {
  const section = document.querySelector('#closing');
  const temTitulo = fill('#closing-title', site.titulo_rodape);
  const temTexto = fill('#closing-text', site.descricao_rodape);
  const botao = document.querySelector('#closing-btn');
  botao.hidden = !site.botao_rodape;
  if (site.botao_rodape) {
    botao.textContent = site.botao_rodape;
    botao.href = site.link_rodape || '#plans';
  }
  section.hidden = !(temTitulo || temTexto || site.botao_rodape);
}

function renderPlans(plans) {
  if (!plans.length) { grid.innerHTML = '<p class="muted">Nenhum plano disponível no momento.</p>'; return; }
  // Destaca o plano que libera mais módulos. É um fato conferível (sai de Planos → Recursos), ao
  // contrário de "mais vendido", que a página não tem como saber.
  let destaque = 0;
  plans.forEach((plan, index) => { if (Number(plan.recursos || 0) > Number(plans[destaque].recursos || 0)) destaque = index; });
  if (!Number(plans[destaque].recursos || 0)) destaque = -1;
  grid.dataset.planos = String(plans.length);
  grid.innerHTML = plans.map((plan, index) => planCard(plan, index === destaque)).join('');
}

async function load() {
  try {
    const data = await api('/api/public/landing');
    const site = data.site || {};
    renderHero(site);
    renderPlans(data.plans || []);
    renderCompare(data.plans || [], data.recursos || []);
    renderFeatures(site.titulo_recursos, data.features || []);
    renderFaqs(site.titulo_perguntas, data.faqs || []);
    renderClosing(site);
    applyBrand(data.config || {});
    if (data.pagamento) pagamentoConfig = data.pagamento;
    if (data.teste?.texto) teste = data.teste;
  } catch (error) {
    grid.innerHTML = `<p class="muted">Não foi possível carregar os planos: ${esc(error.message)}</p>`;
  }
}

// Nome do sistema, descrição e WhatsApp saem de Configurações do painel SaaS (config da empresa 0).
function applyBrand(config) {
  const nome = String(config.nome || '').trim();
  if (nome) {
    document.title = `Planos e assinatura · ${nome}`;
    document.querySelector('#brand-name').textContent = nome;
    document.querySelector('#brand-mark').textContent = nome.replace(/[^A-Za-zÀ-ÿ0-9]+/g, ' ').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'S26';
    document.querySelector('#footer-brand').textContent = `© ${new Date().getFullYear()} ${nome}`;
  }
  if (config.meta_descricao) document.querySelector('meta[name=description]')?.setAttribute('content', config.meta_descricao);
  const telefone = String(config.telefone || '').replace(/\D/g, '');
  const whats = document.querySelector('#whats-float');
  if (telefone.length >= 10) {
    whats.href = `https://api.whatsapp.com/send?phone=55${telefone}`;
    whats.hidden = false;
  }
}

// Delegado no documento: os botões "Assinar" existem nos cards e também no rodapé da tabela de
// comparação, e os dois blocos são reescritos quando a página carrega.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-plan]');
  if (button) openSubscribe(button.dataset.plan, button.dataset.nome, button.dataset.valor);
});
form.addEventListener('submit', submitSubscribe);
form.addEventListener('change', (event) => { if (event.target.name === 'forma_pagamento') atualizarEndereco(); });
modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
modal.addEventListener('click', (event) => { if (event.target === modal) modal.close(); });

load();
