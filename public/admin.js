const loginView = document.querySelector('#admin-login');
const appView = document.querySelector('#admin-app');
const root = document.querySelector('#admin-root');
const modal = document.querySelector('#admin-modal');
const modalForm = document.querySelector('#admin-modal-form');
let current = JSON.parse(sessionStorage.getItem('admin_session') || 'null');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const date = (value) => !value ? 'Não informado' : new Intl.DateTimeFormat('pt-BR').format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
const badge = (value) => `<span class="badge ${value === 'Sim' ? 'ok' : value === 'Não' ? 'bad' : ''}">${esc(value || 'Não informado')}</span>`;
async function api(path, options = {}) {
  const response = await fetch(path, { method: options.method || 'GET', headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(current?.token ? { authorization: `Bearer ${current.token}` } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
  return payload;
}
function table(columns, items, actions) {
  if (!items?.length) return '<div class="empty">Nenhum registro encontrado.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}${actions ? '<th>Ações</th>' : ''}</tr></thead><tbody>${items.map((item) => `<tr>${columns.map((c) => `<td>${c.render ? c.render(item[c.key], item) : esc(item[c.key] ?? 'Não informado')}</td>`).join('')}${actions ? `<td><div class="actions">${actions(item)}</div></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
const header = (title, subtitle, action = '') => `<div class="page-header"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>${action}</div>`;
const routeName = () => (location.hash.replace(/^#\//, '') || 'dashboard').split('?')[0];
const yesNo = [{ value: 'Sim', label: 'Sim' }, { value: 'Não', label: 'Não' }];

function openForm({ title, fields, record = {}, submit }) {
  document.querySelector('#admin-modal-title').textContent = title;
  document.querySelector('#admin-modal-error').textContent = '';
  document.querySelector('#admin-modal-body').innerHTML = `<div class="form-grid">${fields.map((field) => {
    const value = record[field.name] ?? field.default ?? '';
    if (field.type === 'select') return `<label class="field ${field.full ? 'full' : ''}">${esc(field.label)}<select name="${field.name}">${field.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    if (field.type === 'textarea') return `<label class="field full">${esc(field.label)}<textarea name="${field.name}" ${field.required ? 'required' : ''}>${esc(value)}</textarea></label>`;
    return `<label class="field ${field.full ? 'full' : ''}">${esc(field.label)}<input name="${field.name}" type="${field.type || 'text'}" value="${esc(value)}" ${field.required ? 'required' : ''} ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.step ? `step="${field.step}"` : ''}></label>`;
  }).join('')}</div>`;
  modalForm.onsubmit = async (event) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(modalForm));
    fields.forEach((field) => {
      if (field.nullable && values[field.name] === '') values[field.name] = null;
      else if (values[field.name] === '' && !field.required) delete values[field.name];
      else if (field.numeric) values[field.name] = Number(values[field.name]);
    });
    try { await submit(values); modal.close(); await render(); } catch (error) { document.querySelector('#admin-modal-error').textContent = error.message; }
  };
  modal.showModal();
}

const configs = {
  companies: {
    title: 'Empresas', path: '/api/admin/companies', singular: 'empresa',
    columns: [{ key: 'nome', label: 'Empresa' }, { key: 'plano_nome', label: 'Plano' }, { key: 'mensalidade', label: 'Mensalidade', render: money }, { key: 'usuarios_ativos', label: 'Usuários' }, { key: 'clientes_ativos', label: 'Clientes' }, { key: 'data_teste', label: 'Validade', render: date }, { key: 'ativo', label: 'Ativa', render: badge }],
    fields: [
      { name: 'nome', label: 'Nome', required: true }, { name: 'email', label: 'E-mail', type: 'email' }, { name: 'telefone', label: 'Telefone' },
      { name: 'cpf', label: 'CPF/CNPJ' }, { name: 'cidade', label: 'Cidade' }, { name: 'estado', label: 'Estado' },
      { name: 'mensalidade', label: 'Mensalidade', type: 'number', step: '.01', min: 0, numeric: true }, { name: 'data_teste', label: 'Validade', type: 'date', nullable: true },
      { name: 'plano', label: 'ID do plano', type: 'number', min: 1, numeric: true, nullable: true }, { name: 'dispositivos', label: 'Dispositivos', type: 'number', min: 0, numeric: true },
      { name: 'ativo', label: 'Ativa', type: 'select', options: yesNo, default: 'Sim' }, { name: 'url_site', label: 'URL da loja', full: true }
    ]
  },
  plans: {
    title: 'Planos', path: '/api/admin/plans', singular: 'plano',
    columns: [{ key: 'nome', label: 'Plano' }, { key: 'valor', label: 'Valor', render: money }, { key: 'clientes', label: 'Clientes' }, { key: 'usuarios', label: 'Usuários' }, { key: 'dispositivos', label: 'Dispositivos' }, { key: 'ativo', label: 'Ativo', render: badge }],
    fields: [{ name: 'nome', label: 'Nome', required: true }, { name: 'valor', label: 'Valor', type: 'number', step: '.01', min: 0, numeric: true, required: true }, { name: 'clientes', label: 'Limite de clientes', type: 'number', min: 0, numeric: true }, { name: 'usuarios', label: 'Limite de usuários', type: 'number', min: 0, numeric: true }, { name: 'dispositivos', label: 'Limite de dispositivos', type: 'number', min: 0, numeric: true }, { name: 'ativo', label: 'Ativo', type: 'select', options: yesNo, default: 'Sim' }]
  },
  resources: {
    title: 'Recursos', path: '/api/admin/resources', singular: 'recurso',
    columns: [{ key: 'nome', label: 'Recurso' }, { key: 'chave', label: 'Chave' }],
    fields: [{ name: 'nome', label: 'Nome', required: true }, { name: 'chave', label: 'Chave técnica', required: true }]
  },
  alerts: {
    title: 'Alertas', path: '/api/admin/alerts', singular: 'alerta',
    columns: [{ key: 'data', label: 'Data', render: date }, { key: 'titulo', label: 'Título' }, { key: 'texto', label: 'Mensagem' }, { key: 'ativo', label: 'Ativo', render: badge }],
    fields: [{ name: 'titulo', label: 'Título', required: true }, { name: 'data', label: 'Data', type: 'date', default: new Date().toISOString().slice(0, 10) }, { name: 'ativo', label: 'Ativo', type: 'select', options: yesNo, default: 'Sim' }, { name: 'texto', label: 'Mensagem', type: 'textarea', required: true }]
  }
};

async function renderCrud(config) {
  const result = await api(`${config.path}?pageSize=100`);
  root.innerHTML = `${header(config.title, `Administração de ${config.title.toLowerCase()}.`, `<button class="button primary" data-new>Adicionar ${esc(config.singular)}</button>`)}<section class="panel">${table(config.columns, result.items, (item) => `<button class="button ghost small" data-edit="${item.id}">Editar</button>${config === configs.companies ? `<button class="button ghost small" data-access="${item.id}">Recursos</button>${item.ativo === 'Sim' ? `<button class="button danger small" data-disable="${item.id}">Inativar</button>` : `<button class="button ghost small" data-restore="${item.id}">Reativar</button>`}` : config === configs.plans ? `<button class="button ghost small" data-plan-resources="${item.id}">Recursos</button>` : ''}`)}</section>`;
  const byId = new Map(result.items.map((item) => [String(item.id), item]));
  root.querySelector('[data-new]').addEventListener('click', () => openForm({ title: `Adicionar ${config.singular}`, fields: config.fields, submit: (values) => api(config.path, { method: 'POST', body: values }) }));
  root.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openForm({ title: `Editar ${config.singular}`, fields: config.fields, record: byId.get(button.dataset.edit), submit: (values) => api(`${config.path}/${button.dataset.edit}`, { method: 'PATCH', body: values }) })));
  root.querySelectorAll('[data-disable]').forEach((button) => button.addEventListener('click', async () => { if (confirm('Inativar esta empresa?')) { await api(`/api/admin/companies/${button.dataset.disable}`, { method: 'DELETE', body: { reason: 'Inativação pela administração SaaS' } }); await render(); } }));
  root.querySelectorAll('[data-restore]').forEach((button) => button.addEventListener('click', async () => { await api(`/api/admin/companies/${button.dataset.restore}/restore`, { method: 'POST', body: {} }); await render(); }));
  root.querySelectorAll('[data-plan-resources]').forEach((button) => button.addEventListener('click', () => editResources('plans', button.dataset.planResources)));
  root.querySelectorAll('[data-access]').forEach((button) => button.addEventListener('click', () => editResources('companies', button.dataset.access)));
}

async function editResources(type, id) {
  const result = await api(`/api/admin/${type}/${id}/resources`);
  document.querySelector('#admin-modal-title').textContent = 'Recursos disponíveis';
  document.querySelector('#admin-modal-body').innerHTML = `<div class="field">${result.items.map((item) => `<label><input type="checkbox" name="resourceIds" value="${item.id}" ${item.selecionado === 'Sim' ? 'checked' : ''}> ${esc(item.nome)} <small class="muted">${esc(item.origem || item.chave)}</small></label>`).join('')}</div>`;
  modalForm.onsubmit = async (event) => { event.preventDefault(); const ids = [...modalForm.querySelectorAll('[name="resourceIds"]:checked')].map((input) => Number(input.value)); try { await api(`/api/admin/${type}/${id}/resources`, { method: 'PUT', body: { resourceIds: ids } }); modal.close(); } catch (error) { document.querySelector('#admin-modal-error').textContent = error.message; } };
  modal.showModal();
}

async function render() {
  const route = routeName(); const titles = { dashboard: 'Visão geral', companies: 'Empresas', plans: 'Planos', resources: 'Recursos', billing: 'Mensalidades', alerts: 'Alertas', users: 'Usuários SaaS' };
  document.querySelector('#admin-title').textContent = titles[route] || titles.dashboard;
  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === route));
  root.innerHTML = '<div class="empty">Carregando…</div>';
  if (configs[route]) return renderCrud(configs[route]);
  if (route === 'dashboard') {
    const data = await api('/api/admin/dashboard');
    root.innerHTML = `${header('Administração SaaS', 'Indicadores globais sem misturar os dados internos das empresas.')}<div class="grid">
      <div class="card"><small>Empresas ativas</small><strong>${data.companies.ativos || 0}</strong></div>
      <div class="card"><small>MRR cadastrado</small><strong>${money(data.companies.mrr)}</strong></div>
      <div class="card"><small>Planos ativos</small><strong>${data.plans.ativos || 0}</strong></div>
      <div class="card"><small>Mensalidades pendentes</small><strong>${money(data.receivables.pendente)}</strong></div></div>`; return;
  }
  if (route === 'billing') {
    const result = await api('/api/admin/billing?pageSize=100');
    root.innerHTML = `${header('Mensalidades', 'Cobranças administrativas do SaaS.')}<section class="panel">${table([{ key: 'empresa_nome', label: 'Empresa' }, { key: 'descricao', label: 'Descrição' }, { key: 'vencimento', label: 'Vencimento', render: date }, { key: 'subtotal', label: 'Valor', render: money }, { key: 'pago', label: 'Pago', render: badge }], result.items)}</section>`; return;
  }
  const result = await api('/api/users?pageSize=100');
  root.innerHTML = `${header('Usuários SaaS', 'Contas que administram a plataforma, separadas das empresas.')}<section class="panel">${table([{ key: 'nome', label: 'Nome' }, { key: 'email', label: 'E-mail' }, { key: 'nivel', label: 'Perfil' }, { key: 'ativo', label: 'Ativo', render: badge }], result.items)}</section>`;
}
function showApp() {
  if (Number(current?.user?.companyId) !== 0) { sessionStorage.removeItem('admin_session'); current = null; throw new Error('Use uma conta da administração SaaS.'); }
  loginView.hidden = true; appView.hidden = false; document.querySelector('#admin-name').textContent = current.user.name;
  if (!location.hash) location.hash = '#/dashboard'; render().catch((error) => { root.innerHTML = `<div class="empty error">${esc(error.message)}</div>`; });
}
document.querySelector('#admin-login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); try { current = await api('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(event.currentTarget)) }); if (Number(current.user.companyId) !== 0) throw new Error('Esta conta pertence a uma empresa, não à administração SaaS.'); sessionStorage.setItem('admin_session', JSON.stringify(current)); showApp(); } catch (error) { document.querySelector('#admin-login-error').textContent = error.message; }
});
document.querySelector('#admin-change-password').addEventListener('click', () => {
  openForm({
    title: 'Alterar senha',
    fields: [
      { name: 'currentPassword', label: 'Senha atual', type: 'password', required: true, full: true },
      { name: 'newPassword', label: 'Nova senha (mínimo 8 caracteres)', type: 'password', required: true, full: true }
    ],
    submit: (values) => api('/api/users/me/password', { method: 'PATCH', body: values })
  });
});
document.querySelector('#admin-logout').addEventListener('click', () => { sessionStorage.removeItem('admin_session'); location.reload(); });
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => modal.close()));
window.addEventListener('hashchange', () => render().catch((error) => { root.innerHTML = `<div class="empty error">${esc(error.message)}</div>`; }));
if (current?.token) { try { showApp(); } catch (error) { document.querySelector('#admin-login-error').textContent = error.message; } }
