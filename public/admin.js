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
const nivelOptions = ['Administrador', 'Gerente', 'Comum', 'Técnico', 'Tesoureiro', 'Financeiro'].map((value) => ({ value, label: value }));

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
  },
  users: {
    title: 'Usuários SaaS', path: '/api/users', singular: 'usuário',
    columns: [{ key: 'nome', label: 'Nome' }, { key: 'email', label: 'E-mail' }, { key: 'nivel', label: 'Perfil' }, { key: 'ativo', label: 'Ativo', render: badge }],
    fields: [
      { name: 'nome', label: 'Nome', required: true }, { name: 'email', label: 'E-mail', type: 'email', required: true },
      { name: 'nivel', label: 'Perfil', type: 'select', options: nivelOptions, default: 'Administrador' },
      { name: 'ativo', label: 'Ativo', type: 'select', options: yesNo, default: 'Sim' },
      { name: 'telefone', label: 'Telefone' },
      { name: 'password', label: 'Senha (deixe em branco para manter)', type: 'password', full: true }
    ]
  }
};

async function renderCrud(config) {
  const result = await api(`${config.path}?pageSize=100`);
  root.innerHTML = `${header(config.title, `Administração de ${config.title.toLowerCase()}.`, `<button class="button primary" data-new>Adicionar ${esc(config.singular)}</button>`)}<section class="panel">${table(config.columns, result.items, (item) => `<button class="button ghost small" data-edit="${item.id}">Editar</button>${config === configs.companies ? `<button class="button ghost small" data-access="${item.id}">Recursos</button>${item.ativo === 'Sim' ? `<button class="button danger small" data-disable="${item.id}">Inativar</button>` : `<button class="button ghost small" data-restore="${item.id}">Reativar</button>`}` : config === configs.plans ? `<button class="button ghost small" data-plan-resources="${item.id}">Recursos</button>` : config === configs.users ? `<button class="button ghost small" data-user-permissions="${item.id}">Permissões</button>${item.ativo === 'Sim' ? `<button class="button danger small" data-user-disable="${item.id}">Inativar</button>` : `<button class="button ghost small" data-user-restore="${item.id}">Reativar</button>`}` : ''}`)}</section>`;
  const byId = new Map(result.items.map((item) => [String(item.id), item]));
  root.querySelector('[data-new]').addEventListener('click', () => openForm({ title: `Adicionar ${config.singular}`, fields: config.fields, submit: (values) => api(config.path, { method: 'POST', body: values }) }));
  root.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openForm({ title: `Editar ${config.singular}`, fields: config.fields, record: byId.get(button.dataset.edit), submit: (values) => api(`${config.path}/${button.dataset.edit}`, { method: 'PATCH', body: values }) })));
  root.querySelectorAll('[data-disable]').forEach((button) => button.addEventListener('click', async () => { if (confirm('Inativar esta empresa?')) { await api(`/api/admin/companies/${button.dataset.disable}`, { method: 'DELETE', body: { reason: 'Inativação pela administração SaaS' } }); await render(); } }));
  root.querySelectorAll('[data-restore]').forEach((button) => button.addEventListener('click', async () => { await api(`/api/admin/companies/${button.dataset.restore}/restore`, { method: 'POST', body: {} }); await render(); }));
  root.querySelectorAll('[data-plan-resources]').forEach((button) => button.addEventListener('click', () => editResources('plans', button.dataset.planResources)));
  root.querySelectorAll('[data-access]').forEach((button) => button.addEventListener('click', () => editResources('companies', button.dataset.access)));
  root.querySelectorAll('[data-user-permissions]').forEach((button) => button.addEventListener('click', () => editUserPermissions(button.dataset.userPermissions)));
  root.querySelectorAll('[data-user-disable]').forEach((button) => button.addEventListener('click', async () => { if (confirm('Inativar este usuário?')) { await api(`/api/users/${button.dataset.userDisable}`, { method: 'DELETE', body: { reason: 'Inativação pela administração SaaS' } }); await render(); } }));
  root.querySelectorAll('[data-user-restore]').forEach((button) => button.addEventListener('click', async () => { await api(`/api/users/${button.dataset.userRestore}/restore`, { method: 'POST', body: {} }); await render(); }));
}

async function editUserPermissions(userId) {
  const [options, selected] = await Promise.all([api('/api/users/permissions/options'), api(`/api/users/${userId}/permissions`)]);
  const selectedIds = new Set(selected.map(String));
  document.querySelector('#admin-modal-title').textContent = 'Permissões do usuário';
  document.querySelector('#admin-modal-error').textContent = '';
  document.querySelector('#admin-modal-body').innerHTML = `<div class="field">${options.map((item) => `<label><input type="checkbox" name="permissionIds" value="${item.id}" ${selectedIds.has(String(item.id)) ? 'checked' : ''}> ${esc(item.nome)}</label>`).join('')}</div>`;
  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    const permissionIds = [...modalForm.querySelectorAll('[name="permissionIds"]:checked')].map((input) => Number(input.value));
    try { await api(`/api/users/${userId}/permissions`, { method: 'PUT', body: { permissionIds } }); modal.close(); await render(); } catch (error) { document.querySelector('#admin-modal-error').textContent = error.message; }
  };
  modal.showModal();
}

async function editResources(type, id) {
  const result = await api(`/api/admin/${type}/${id}/resources`);
  document.querySelector('#admin-modal-title').textContent = 'Recursos do plano';
  // O núcleo é sempre incluído (o ERP não funciona sem ele) — aparece marcado e travado.
  // Os premium são a escolha real: o que você marca é o que a empresa recebe e o usuário vê.
  const premium = result.items.filter((item) => item.nucleo !== 'Sim');
  const nucleo = result.items.filter((item) => item.nucleo === 'Sim');
  const row = (item, locked) => `<label class="res-item" data-name="${esc(item.nome.toLowerCase())}"><input type="checkbox" name="resourceIds" value="${item.id}" ${item.selecionado === 'Sim' || locked ? 'checked' : ''} ${locked ? 'disabled' : ''}> <span>${esc(item.nome)}</span> ${locked ? '<small class="muted">sempre incluído</small>' : `<small class="muted">${esc(item.origem || 'premium')}</small>`}</label>`;
  document.querySelector('#admin-modal-body').innerHTML = `
    <p class="muted" style="margin:0 0 10px">Marque os recursos deste ${type === 'plans' ? 'plano' : 'cliente'}. O que você escolher é exatamente o que a empresa recebe e o usuário passa a ver.</p>
    <div class="res-toolbar">
      <input type="search" class="res-search" placeholder="Buscar recurso…" aria-label="Buscar recurso">
      <span class="res-count" data-res-count></span>
      <button type="button" class="button ghost small" data-res-all>Marcar todos</button>
      <button type="button" class="button ghost small" data-res-none>Limpar</button>
    </div>
    <div class="res-list">${premium.map((item) => row(item, false)).join('')}</div>
    ${nucleo.length ? `<p class="muted res-core-title"><strong>Núcleo</strong> — incluído em qualquer plano</p>
    <div class="res-list res-core">${nucleo.map((item) => row(item, true)).join('')}</div>` : ''}`;

  const body = document.querySelector('#admin-modal-body');
  const boxes = () => [...body.querySelectorAll('[name="resourceIds"]:not(:disabled)')];
  const refresh = () => { body.querySelector('[data-res-count]').textContent = `${boxes().filter((b) => b.checked).length} de ${boxes().length} marcados`; };
  refresh();
  body.addEventListener('change', refresh);
  body.querySelector('[data-res-all]').addEventListener('click', () => { boxes().forEach((b) => { b.checked = true; }); refresh(); });
  body.querySelector('[data-res-none]').addEventListener('click', () => { boxes().forEach((b) => { b.checked = false; }); refresh(); });
  body.querySelector('.res-search').addEventListener('input', (event) => {
    const term = event.target.value.trim().toLowerCase();
    body.querySelectorAll('.res-item').forEach((item) => { item.hidden = Boolean(term) && !item.dataset.name.includes(term); });
  });

  modalForm.onsubmit = async (event) => { event.preventDefault(); const ids = boxes().filter((b) => b.checked).map((b) => Number(b.value)); try { await api(`/api/admin/${type}/${id}/resources`, { method: 'PUT', body: { resourceIds: ids } }); modal.close(); } catch (error) { document.querySelector('#admin-modal-error').textContent = error.message; } };
  modal.showModal();
}

// --- Site e planos: o conteúdo da landing pública (/planos.html) ------------------------------
// Tudo que o visitante lê antes de assinar é editado aqui — chamada, selos, botões, cards de
// recurso, perguntas e rodapé. Nada dessa página é texto fixo no HTML.

const siteFields = [
  { name: 'nome', label: 'Nome do sistema' },
  { name: 'telefone', label: 'WhatsApp de contato' },
  { name: 'meta_descricao', label: 'Descrição para buscadores', full: true },
  { name: 'titulo', label: 'Chamada principal', full: true },
  { name: 'subtitulo', label: 'Texto de apoio', type: 'textarea' },
  { name: 'item1', label: 'Selo 1' }, { name: 'item2', label: 'Selo 2' }, { name: 'item3', label: 'Selo 3' },
  { name: 'titulo_recursos', label: 'Título da seção de recursos', full: true },
  { name: 'titulo_perguntas', label: 'Título da seção de perguntas', full: true },
  { name: 'titulo_rodape', label: 'Chamada final' },
  { name: 'botao_rodape', label: 'Texto do botão final' },
  { name: 'link_rodape', label: 'Link do botão final (#plans para rolar até os planos)', full: true },
  { name: 'descricao_rodape', label: 'Texto da chamada final', type: 'textarea' }
];
const siteTabs = { content: 'Conteúdo', features: 'Recursos', faqs: 'Perguntas' };
const siteCruds = {
  features: {
    path: '/api/admin/site/features', singular: 'card de recurso',
    columns: [{ key: 'posicao_recurso', label: 'Ordem' }, { key: 'titulo_recurso', label: 'Título' }, { key: 'descricao_recurso', label: 'Descrição' }, { key: 'icone_recurso', label: 'Ícone' }],
    fields: [
      { name: 'titulo_recurso', label: 'Título', required: true },
      { name: 'posicao_recurso', label: 'Ordem', type: 'number', min: 0, numeric: true },
      { name: 'icone_recurso', label: 'Ícone', type: 'select', options: ['cart', 'wallet', 'inventory', 'clients', 'file-text', 'user', 'box', 'truck', 'megaphone', 'calendar', 'help', 'clipboard'].map((value) => ({ value, label: value })) },
      { name: 'descricao_recurso', label: 'Descrição', type: 'textarea' }
    ]
  },
  faqs: {
    path: '/api/admin/site/faqs', singular: 'pergunta',
    columns: [{ key: 'posicao_pergunta', label: 'Ordem' }, { key: 'titulo_pergunta', label: 'Pergunta' }, { key: 'descricao_pergunta', label: 'Resposta' }],
    fields: [
      { name: 'titulo_pergunta', label: 'Pergunta', required: true, full: true },
      { name: 'posicao_pergunta', label: 'Ordem', type: 'number', min: 0, numeric: true },
      { name: 'descricao_pergunta', label: 'Resposta', type: 'textarea', required: true }
    ]
  }
};

async function renderSite() {
  const tab = new URLSearchParams(location.hash.split('?')[1] || '').get('tab') || 'content';
  const tabs = `<div class="split-tabs">${Object.entries(siteTabs).map(([key, label]) => `<a class="${tab === key ? 'active' : ''}" href="#/site?tab=${key}">${label}</a>`).join('')}</div>`;
  const intro = header('Site e planos', 'O que o visitante lê em /planos.html antes de assinar. Os itens com ✓ dentro de cada card saem da tela de Planos → Recursos.',
    '<a class="button ghost" href="/planos.html" target="_blank" rel="noopener">Ver a página</a>');

  if (tab === 'content') {
    const site = await api('/api/admin/site');
    root.innerHTML = `${intro}${tabs}<section class="panel">
      <dl class="site-preview">${siteFields.map((field) =>
        `<div><dt>${esc(field.label)}</dt><dd>${esc(site[field.name] || 'Não preenchido')}</dd></div>`).join('')}</dl>
      <button class="button primary" data-edit-site>Editar conteúdo</button></section>`;
    root.querySelector('[data-edit-site]').addEventListener('click', () => openForm({
      title: 'Conteúdo da landing', fields: siteFields, record: site,
      submit: (values) => api('/api/admin/site', { method: 'PUT', body: values })
    }));
    return;
  }

  const config = siteCruds[tab];
  const result = await api(`${config.path}?pageSize=100`);
  root.innerHTML = `${intro}${tabs}<section class="panel">
    <div class="page-header"><p class="muted">A ordem menor aparece primeiro na página.</p><button class="button primary" data-new>Adicionar ${esc(config.singular)}</button></div>
    ${table(config.columns, result.items, (item) => `<button class="button ghost small" data-edit="${item.id}">Editar</button><button class="button danger small" data-remove="${item.id}">Excluir</button>`)}</section>`;
  const byId = new Map(result.items.map((item) => [String(item.id), item]));
  root.querySelector('[data-new]').addEventListener('click', () => openForm({
    title: `Adicionar ${config.singular}`, fields: config.fields,
    submit: (values) => api(config.path, { method: 'POST', body: values })
  }));
  root.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openForm({
    title: `Editar ${config.singular}`, fields: config.fields, record: byId.get(button.dataset.edit),
    submit: (values) => api(`${config.path}/${button.dataset.edit}`, { method: 'PATCH', body: values })
  })));
  root.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', async () => {
    if (confirm('Excluir este item da página de planos?')) { await api(`${config.path}/${button.dataset.remove}`, { method: 'DELETE' }); await render(); }
  }));
}

async function render() {
  const route = routeName(); const titles = { dashboard: 'Visão geral', companies: 'Empresas', plans: 'Planos', resources: 'Recursos', billing: 'Mensalidades', site: 'Site e planos', alerts: 'Alertas', users: 'Usuários SaaS' };
  document.querySelector('#admin-title').textContent = titles[route] || titles.dashboard;
  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === route));
  root.innerHTML = '<div class="empty">Carregando…</div>';
  if (configs[route]) return renderCrud(configs[route]);
  if (route === 'site') return renderSite();
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
  root.innerHTML = '<div class="empty">Rota não encontrada.</div>';
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
