const loginView = document.querySelector('#portal-login');
const appView = document.querySelector('#portal-app');
const root = document.querySelector('#portal-root');
const modal = document.querySelector('#portal-modal');
let current = JSON.parse(sessionStorage.getItem('portal_session') || 'null');

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const date = (value) => !value || /^0000-|^1111-/.test(String(value)) ? 'Não informado' : new Intl.DateTimeFormat('pt-BR').format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const badge = (value) => `<span class="badge ${/Sim|Ativo|Entregue|Aprovado|Pago/i.test(value) ? 'ok' : /Não|Cancel|Reprov/i.test(value) ? 'bad' : ''}">${esc(value || 'Não informado')}</span>`;

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(current?.token ? { authorization: `Bearer ${current.token}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
  return payload;
}

function table(columns, items, actions) {
  if (!items?.length) return '<div class="empty">Nenhum registro encontrado.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}${actions ? '<th>Ações</th>' : ''}</tr></thead><tbody>${items.map((item) => `<tr>${columns.map((c) => `<td>${c.render ? c.render(item[c.key], item) : esc(item[c.key] || 'Não informado')}</td>`).join('')}${actions ? `<td><div class="actions">${actions(item)}</div></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
function header(title, subtitle) { return `<div class="page-header"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div></div>`; }
function routeName() { return (location.hash.replace(/^#\//, '') || 'dashboard').split('?')[0]; }

async function render() {
  const route = routeName();
  const titles = { dashboard: 'Visão geral', orders: 'Ordens de serviço', quotes: 'Orçamentos', contracts: 'Contratos', billing: 'Financeiro', profile: 'Meu cadastro' };
  document.querySelector('#portal-title').textContent = titles[route] || titles.dashboard;
  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === route));
  root.innerHTML = '<div class="empty">Carregando…</div>';
  if (route === 'dashboard') {
    const [orders, quotes, contracts, billing] = await Promise.all(['/orders', '/quotes', '/contracts', '/billing'].map((path) => api(`/api/client${path}?pageSize=100`)));
    const pending = billing.items.filter((item) => item.pago !== 'Sim' && item.node_status !== 'cancelado').reduce((sum, item) => sum + Number(item.subtotal ?? item.valor ?? 0), 0);
    root.innerHTML = `${header('Olá, ' + current.user.name, 'Resumo dos seus registros na empresa.')}<div class="grid">
      <div class="card"><small>Ordens</small><strong>${orders.pagination.total}</strong></div>
      <div class="card"><small>Orçamentos</small><strong>${quotes.pagination.total}</strong></div>
      <div class="card"><small>Contratos</small><strong>${contracts.pagination.total}</strong></div>
      <div class="card"><small>Em aberto</small><strong>${money(pending)}</strong></div></div>`;
    return;
  }
  if (route === 'orders') {
    const result = await api('/api/client/orders?pageSize=100');
    root.innerHTML = `${header('Ordens de serviço', 'Acompanhe status, previsão e laudo técnico.')}<section class="panel">${table([
      { key: 'id', label: 'Número' }, { key: 'data', label: 'Entrada', render: date }, { key: 'data_entrega', label: 'Previsão', render: date },
      { key: 'equipamento', label: 'Equipamento' }, { key: 'status', label: 'Situação', render: badge }, { key: 'subtotal', label: 'Total', render: money }
    ], result.items, (item) => `<button class="button ghost small" data-order="${item.id}">Detalhes</button>`)}</section>`;
    root.querySelectorAll('[data-order]').forEach((button) => button.addEventListener('click', async () => {
      const order = await api(`/api/client/orders/${button.dataset.order}`);
      document.querySelector('#portal-modal-title').textContent = `Ordem #${order.id}`;
      document.querySelector('#portal-modal-body').innerHTML = `<p><strong>Situação:</strong> ${esc(order.status)}</p><p><strong>Defeito:</strong> ${esc(order.defeito || 'Não informado')}</p><p><strong>Laudo:</strong> ${esc(order.laudo || 'Não informado')}</p>${table([{ key: 'tipo', label: 'Tipo' }, { key: 'nome', label: 'Item' }, { key: 'quantidade', label: 'Quantidade' }, { key: 'total', label: 'Total', render: money }], order.items)}`;
      modal.showModal();
    }));
    return;
  }
  if (route === 'quotes') {
    const result = await api('/api/client/quotes?pageSize=100');
    root.innerHTML = `${header('Orçamentos', 'Consulte propostas e validade.')}<section class="panel">${table([
      { key: 'id', label: 'Número' }, { key: 'data', label: 'Data', render: date }, { key: 'data_entrega', label: 'Previsão', render: date },
      { key: 'equipamento', label: 'Equipamento' }, { key: 'status', label: 'Situação', render: badge }, { key: 'subtotal', label: 'Total', render: money }
    ], result.items)}</section>`; return;
  }
  if (route === 'contracts') {
    const result = await api('/api/client/contracts?pageSize=100');
    root.innerHTML = `${header('Contratos', 'Leia e confirme contratos disponibilizados pela empresa.')}<section class="panel">${table([
      { key: 'titulo', label: 'Contrato' }, { key: 'status', label: 'Situação', render: badge }, { key: 'inicio', label: 'Início', render: date }, { key: 'valor', label: 'Valor', render: money }
    ], result.items, (item) => `<button class="button ghost small" data-contract="${item.id}">Abrir</button>`)}</section>`;
    root.querySelectorAll('[data-contract]').forEach((button) => button.addEventListener('click', async () => {
      const contract = await api(`/api/client/contracts/${button.dataset.contract}`);
      document.querySelector('#portal-modal-title').textContent = contract.titulo;
      document.querySelector('#portal-modal-body').innerHTML = `<article style="white-space:pre-wrap;line-height:1.6">${esc(contract.conteudo)}</article>${contract.assinado_em ? `<p class="badge ok">Confirmado por ${esc(contract.assinado_por)} em ${date(contract.assinado_em)}</p>` : `<form id="sign-form"><label class="field">Nome completo<input name="name" required minlength="3" value="${esc(current.user.name)}"></label><label class="field" style="display:flex;grid-template-columns:auto 1fr"><input name="accepted" type="checkbox" required> Li e concordo com o conteúdo apresentado.</label><button class="button primary">Confirmar contrato</button><p class="error"></p></form>`}`;
      modal.showModal();
      const signForm = document.querySelector('#sign-form');
      signForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try { await api(`/api/client/contracts/${contract.id}/sign`, { method: 'POST', body: { name: new FormData(signForm).get('name'), accepted: true } }); modal.close(); await render(); }
        catch (error) { signForm.querySelector('.error').textContent = error.message; }
      });
    })); return;
  }
  if (route === 'billing') {
    const result = await api('/api/client/billing?pageSize=100');
    root.innerHTML = `${header('Financeiro', 'Cobranças e pagamentos vinculados ao seu cadastro.')}<section class="panel">${table([
      { key: 'descricao', label: 'Descrição' }, { key: 'vencimento', label: 'Vencimento', render: date }, { key: 'subtotal', label: 'Valor', render: money },
      { key: 'pago', label: 'Pago', render: badge }, { key: 'data_pgto', label: 'Pagamento', render: date }
    ], result.items)}</section>`; return;
  }
  const profile = await api('/api/client/me');
  root.innerHTML = `${header('Meu cadastro', 'Atualize contato, endereço, consentimento e senha.')}<section class="panel" style="padding:20px"><form id="profile-form" class="form-grid">
    <label class="field">Nome<input name="nome" value="${esc(profile.nome)}" required></label><label class="field">Telefone<input name="telefone" value="${esc(profile.telefone)}"></label>
    <label class="field full">Endereço<input name="endereco" value="${esc(profile.endereco)}"></label><label class="field">Número<input name="numero" value="${esc(profile.numero)}"></label>
    <label class="field">Cidade<input name="cidade" value="${esc(profile.cidade)}"></label><label class="field">Estado<input name="estado" value="${esc(profile.estado)}"></label>
    <label class="field">CEP<input name="cep" value="${esc(profile.cep)}"></label><label class="field">Receber marketing<select name="marketing"><option ${profile.marketing === 'Sim' ? 'selected' : ''}>Sim</option><option ${profile.marketing !== 'Sim' ? 'selected' : ''}>Não</option></select></label>
    <label class="field full">Nova senha (opcional)<input name="password" type="password" minlength="8"></label><div class="full"><button class="button primary">Salvar alterações</button><p class="error"></p></div></form></section>`;
  document.querySelector('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); if (!data.password) delete data.password;
    try { await api('/api/client/me', { method: 'PATCH', body: data }); event.currentTarget.querySelector('.error').textContent = 'Dados atualizados.'; }
    catch (error) { event.currentTarget.querySelector('.error').textContent = error.message; }
  });
}

function showApp() {
  loginView.hidden = true; appView.hidden = false;
  document.querySelector('#portal-name').textContent = current.user.name;
  document.querySelector('#portal-company').textContent = current.user.companyName || `Empresa ${current.user.companyId}`;
  if (!location.hash) location.hash = '#/dashboard';
  render().catch((error) => { root.innerHTML = `<div class="empty error">${esc(error.message)}</div>`; });
}
document.querySelector('#portal-login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.companyId = Number(data.companyId);
  try { current = await api('/api/client/login', { method: 'POST', body: data }); sessionStorage.setItem('portal_session', JSON.stringify(current)); showApp(); }
  catch (error) { document.querySelector('#portal-login-error').textContent = error.message; }
});
document.querySelector('#portal-logout').addEventListener('click', () => { sessionStorage.removeItem('portal_session'); location.reload(); });
window.addEventListener('hashchange', () => render().catch((error) => { root.innerHTML = `<div class="empty error">${esc(error.message)}</div>`; }));
if (current?.token) showApp();
