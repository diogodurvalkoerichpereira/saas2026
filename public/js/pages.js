import { api } from './api.js';
import { money, number, date, text, escapeHtml, badge } from './format.mjs';
import { icon } from './icons.mjs';
import { loading, pageHeader, table, pagination, openForm, confirmAction, toast } from './ui.js';
import { renderExtraRoute } from './extra-pages.js';
import { attachmentButton, openAttachments } from './attachments.js';

const root = () => document.querySelector('#page-root');
const editButton = (id) => `<button class="button ghost small" data-action="edit" data-id="${id}">${icon('edit')}Editar</button>`;
const activeButtons = (item) => item.ativo === 'Não'
  ? `<button class="button ghost small" data-action="restore" data-id="${item.id}">${icon('refresh')}Reativar</button>`
  : `<button class="button danger small" data-action="disable" data-id="${item.id}">${icon('power')}Inativar</button>`;

const entityConfigs = {
  clients: {
    title: 'Clientes', singular: 'cliente', path: '/api/clients', subtitle: 'Cadastro e dados de contato dos clientes da empresa.',
    attachmentEntity: 'clients',
    columns: [
      { key: 'nome', label: 'Nome' }, { key: 'telefone', label: 'Telefone', render: text }, { key: 'email', label: 'E-mail', render: text },
      { key: 'cidade', label: 'Cidade', render: text }, { key: 'tipo_pessoa', label: 'Tipo', render: text }, { key: 'ativo', label: 'Situação', render: badge }
    ],
    fields: [
      { name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'tipo_pessoa', label: 'Tipo de pessoa', type: 'select', options: [{ value: 'Física', label: 'Física' }, { value: 'Jurídica', label: 'Jurídica' }] },
      { name: 'cpf', label: 'CPF/CNPJ', optional: true, max: 25 }, { name: 'telefone', label: 'Telefone', optional: true, max: 20 },
      { name: 'email', label: 'E-mail', type: 'email', optional: true, max: 50 }, { name: 'data_nasc', label: 'Nascimento', type: 'date', optional: true },
      { name: 'endereco', label: 'Endereço', optional: true, max: 100 }, { name: 'numero', label: 'Número', optional: true, max: 10 },
      { name: 'bairro', label: 'Bairro', optional: true, max: 50 }, { name: 'cidade', label: 'Cidade', optional: true, max: 50 },
      { name: 'estado', label: 'Estado', optional: true, max: 50 }, { name: 'cep', label: 'CEP', optional: true, max: 20 },
      { name: 'complemento', label: 'Complemento', optional: true, max: 100, full: true },
      { name: 'marketing', label: 'Aceita marketing', type: 'select', optional: true, options: [{ value: '', label: 'Não informado' }, { value: 'Sim', label: 'Sim' }, { value: 'Não', label: 'Não' }] },
      { name: 'password', label: 'Senha do portal (opcional)', type: 'password', optional: true, max: 72, full: true }
    ]
  },
  suppliers: {
    title: 'Fornecedores', singular: 'fornecedor', path: '/api/catalog/suppliers', subtitle: 'Parceiros de compra e dados de pagamento.',
    attachmentEntity: 'suppliers',
    columns: [
      { key: 'nome', label: 'Nome' }, { key: 'telefone', label: 'Telefone', render: text }, { key: 'email', label: 'E-mail', render: text },
      { key: 'cnpj', label: 'CNPJ', render: text }, { key: 'cidade', label: 'Cidade', render: text }, { key: 'ativo', label: 'Situação', render: badge }
    ],
    fields: [
      { name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'telefone', label: 'Telefone', required: true, max: 50 },
      { name: 'email', label: 'E-mail', type: 'email', optional: true, max: 50 }, { name: 'cnpj', label: 'CNPJ', optional: true, max: 20 },
      { name: 'endereco', label: 'Endereço', optional: true, max: 100 }, { name: 'numero', label: 'Número', optional: true, max: 10 },
      { name: 'bairro', label: 'Bairro', optional: true, max: 50 }, { name: 'cidade', label: 'Cidade', optional: true, max: 50 },
      { name: 'estado', label: 'Estado', optional: true, max: 50 }, { name: 'cep', label: 'CEP', optional: true, max: 20 },
      { name: 'pix', label: 'Chave Pix', optional: true, max: 50 }, { name: 'tipo_chave', label: 'Tipo da chave', optional: true, max: 100 }
    ]
  },
  products: {
    title: 'Produtos', singular: 'produto', path: '/api/catalog/products', subtitle: 'Catálogo, preço de venda e níveis de estoque.',
    columns: [
      { key: 'codigo', label: 'Código', render: text }, { key: 'nome', label: 'Produto' }, { key: 'valor_venda', label: 'Venda', render: (value) => `<span class="money">${money(value)}</span>` },
      { key: 'estoque', label: 'Estoque', render: number }, { key: 'fornecedor_nome', label: 'Fornecedor', render: text }, { key: 'ativo', label: 'Situação', render: badge }
    ],
    async fields() {
      const [suppliers, categories, subcategories] = await Promise.all([
        allItems('/api/catalog/suppliers'), allItems('/api/reference/categories'), allItems('/api/reference/subcategories')
      ]);
      return [
        { name: 'codigo', label: 'Código', required: true, max: 50 }, { name: 'nome', label: 'Nome', required: true, max: 50 },
        { name: 'valor_compra', label: 'Valor de compra', type: 'number', step: '.01', min: 0, numeric: true, required: true },
        { name: 'valor_venda', label: 'Valor de venda', type: 'number', step: '.01', min: 0, numeric: true, required: true },
        { name: 'valor_promocional', label: 'Valor promocional', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
        { name: 'estoque', label: 'Estoque atual', type: 'number', step: '1', numeric: true, required: true },
        { name: 'nivel_estoque', label: 'Alerta de estoque', type: 'number', step: '1', min: 0, numeric: true, required: true },
        { name: 'categoria', label: 'Categoria', type: 'select', numeric: true, options: [{ value: 0, label: 'Sem categoria' }, ...categories.map((item) => ({ value: item.id, label: item.nome }))] },
        { name: 'sub_categoria', label: 'Subcategoria', type: 'select', optional: true, options: [{ value: '', label: 'Sem subcategoria' }, ...subcategories.map((item) => ({ value: item.nome, label: item.nome }))] },
        { name: 'fornecedor', label: 'Fornecedor', type: 'select', numeric: true, options: [{ value: 0, label: 'Sem fornecedor' }, ...suppliers.map((item) => ({ value: item.id, label: item.nome }))] },
        { name: 'tem_estoque', label: 'Controla estoque', type: 'select', options: yesNoOptions() },
        { name: 'mostrar_site', label: 'Mostrar no site', type: 'select', options: yesNoOptions() },
        { name: 'descricao', label: 'Descrição', type: 'textarea', optional: true, full: true, max: 255 }
      ];
    }
  },
  services: {
    title: 'Serviços', singular: 'serviço', path: '/api/catalog/services', subtitle: 'Serviços, valores e prazos praticados.',
    columns: [
      { key: 'nome', label: 'Serviço' }, { key: 'valor', label: 'Valor', render: (value) => `<span class="money">${money(value)}</span>` },
      { key: 'dias', label: 'Prazo (dias)', render: number }, { key: 'comissao', label: 'Comissão %', render: number }, { key: 'ativo', label: 'Situação', render: badge }
    ],
    fields: [
      { name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'valor', label: 'Valor', type: 'number', step: '.01', min: 0, numeric: true, required: true },
      { name: 'dias', label: 'Prazo em dias', type: 'number', step: '1', min: 0, numeric: true, required: true },
      { name: 'comissao', label: 'Comissão %', type: 'number', step: '1', min: 0, numeric: true, optional: true },
      { name: 'mostrar_site', label: 'Mostrar no site', type: 'select', options: yesNoOptions() },
      { name: 'descricao', label: 'Descrição', type: 'textarea', optional: true, full: true, max: 5000 }
    ]
  },
  users: {
    title: 'Usuários', singular: 'usuário', path: '/api/users', subtitle: 'Acesso ao sistema, perfis e situação dos usuários.',
    columns: [
      { key: 'nome', label: 'Nome' }, { key: 'email', label: 'E-mail' }, { key: 'nivel', label: 'Perfil', render: badge },
      { key: 'telefone', label: 'Telefone', render: text }, { key: 'ativo', label: 'Situação', render: badge }
    ],
    fields: [
      { name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'email', label: 'E-mail', type: 'email', required: true, max: 50 },
      { name: 'password', label: 'Senha (mínimo 8 caracteres)', type: 'password', optional: true, max: 72 },
      { name: 'nivel', label: 'Perfil', type: 'select', required: true, options: ['Administrador', 'Gerente', 'Comum', 'Técnico', 'Tesoureiro', 'Financeiro'].map((value) => ({ value, label: value })) },
      { name: 'telefone', label: 'Telefone', optional: true, max: 20 }, { name: 'endereco', label: 'Endereço', optional: true, max: 150 },
      { name: 'acessar_painel', label: 'Acessar painel', type: 'select', options: yesNoOptions() },
      { name: 'mostrar_registros', label: 'Mostrar registros', type: 'select', options: yesNoOptions() },
      { name: 'comissao', label: 'Comissão (%)', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
      { name: 'salario', label: 'Salário base', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
      { name: 'valor_hora', label: 'Valor da hora', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
      { name: 'hora_entrada', label: 'Horário de entrada', type: 'time', optional: true },
      { name: 'hora_saida', label: 'Horário de saída', type: 'time', optional: true },
      { name: 'jornada_horas', label: 'Jornada diária', type: 'time', optional: true },
      { name: 'pix', label: 'Chave Pix', optional: true, max: 100 },
      { name: 'tipo_chave', label: 'Tipo da chave Pix', optional: true, max: 100 }
    ],
    extraActions: (item) => `<button class="button ghost small" data-action="permissions" data-id="${item.id}">${icon('shield')}Permissões</button>`
  }
};

function yesNoOptions() { return [{ value: 'Sim', label: 'Sim' }, { value: 'Não', label: 'Não' }]; }
async function allItems(path, activeOnly = true) {
  const response = await api(`${path}?page=1&pageSize=100${activeOnly ? '&status=Sim' : ''}`);
  return response.items;
}
function formFields(config) { return typeof config.fields === 'function' ? config.fields() : Promise.resolve(config.fields); }

async function renderCrud(config) {
  loading();
  const state = { page: 1, search: '', status: '' };
  const load = async () => {
    const params = new URLSearchParams({ page: state.page, pageSize: 25, search: state.search });
    if (state.status) params.set('status', state.status);
    const result = await api(`${config.path}?${params}`);
    root().innerHTML = `${pageHeader(config.title, config.subtitle, `<button class="button primary" data-action="new">${icon('plus')}Novo ${escapeHtml(config.singular)}</button>`)}
      <section class="panel"><form class="toolbar" id="list-filter"><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar por nome, código ou contato"><select name="status"><option value="">Todas as situações</option><option value="Sim" ${state.status === 'Sim' ? 'selected' : ''}>Ativos</option><option value="Não" ${state.status === 'Não' ? 'selected' : ''}>Inativos</option></select><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table(config.columns, result.items, (item) => `${editButton(item.id)}${config.extraActions?.(item) || ''}${config.attachmentEntity ? attachmentButton(config.attachmentEntity, item.id) : ''}${activeButtons(item)}`)}${pagination(result.pagination)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    root().querySelector('#list-filter').addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      state.search = values.search;
      state.status = values.status;
      state.page = 1;
      load();
    });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const action = button.dataset.action;
      const item = byId.get(button.dataset.id);
      if (action === 'attachments') {
        await openAttachments({ entity: button.dataset.attachments, id: Number(button.dataset.attachmentId), title: item?.nome || `${config.singular} #${button.dataset.attachmentId}` });
        return;
      }
      if (action === 'new' || action === 'edit') {
        const fields = await formFields(config);
        const edit = action === 'edit';
        const normalizedFields = fields.map((field) =>
          field.name === 'password' && !edit && config === entityConfigs.users
            ? { ...field, required: true, optional: false }
            : field
        );
        openForm({
          title: edit ? `Editar ${config.singular}` : `Novo ${config.singular}`,
          fields: normalizedFields,
          record: edit ? item : {},
          onSubmit: async (data) => {
            await api(edit ? `${config.path}/${item.id}` : config.path, { method: edit ? 'PATCH' : 'POST', body: data });
            toast(edit ? 'Registro atualizado.' : 'Registro criado.');
            await load();
          }
        });
      }
      if (action === 'disable') await confirmAction(`Inativar ${config.singular} “${item.nome}”?`, async () => {
        await api(`${config.path}/${item.id}`, { method: 'DELETE', body: { reason: 'Inativação pela interface' } });
        toast('Registro inativado.');
        await load();
      });
      if (action === 'restore') await confirmAction(`Reativar ${config.singular} “${item.nome}”?`, async () => {
        await api(`${config.path}/${item.id}/restore`, { method: 'POST', body: {} });
        toast('Registro reativado.');
        await load();
      });
      if (action === 'permissions') await openPermissions(item);
    }));
  };
  await load();
}

async function openPermissions(user) {
  const [options, selected] = await Promise.all([api('/api/users/permissions/options'), api(`/api/users/${user.id}/permissions`)]);
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  document.querySelector('#modal-title').textContent = `Permissões de ${user.nome}`;
  document.querySelector('#modal-eyebrow').textContent = 'Controle de acesso';
  document.querySelector('#modal-body').innerHTML = `<div class="modal-grid">${options.map((option) => `<label class="field"><span><input type="checkbox" name="permissionIds" value="${option.id}" ${selected.includes(option.id) ? 'checked' : ''}> ${escapeHtml(option.nome)}</span></label>`).join('')}</div>`;
  document.querySelector('#modal-error').textContent = '';
  const handler = async (event) => {
    event.preventDefault();
    try {
      const permissionIds = [...form.querySelectorAll('[name=permissionIds]:checked')].map((input) => Number(input.value));
      await api(`/api/users/${user.id}/permissions`, { method: 'PUT', body: { permissionIds } });
      dialog.close();
      toast('Permissões atualizadas.');
    } catch (error) { document.querySelector('#modal-error').textContent = error.message; }
  };
  if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
  form._submitHandler = handler;
  form.addEventListener('submit', handler);
  dialog.showModal();
}

async function renderDashboard() {
  loading();
  const [finance, operations] = await Promise.all([api('/api/reports/financial'), api('/api/reports/operational')]);
  root().innerHTML = `${pageHeader('Visão geral', 'Indicadores atualizados da empresa e atalhos operacionais.')}
    <section class="metric-grid">
      ${metric('A receber', money(finance.a_receber), 'Contas pendentes', '#/finance?type=receivables')}
      ${metric('A pagar', money(finance.a_pagar), 'Compromissos pendentes', '#/finance?type=payables')}
      ${metric('Produtos', number(operations.stock?.produtos), 'Itens cadastrados', '#/products')}
      ${metric('Estoque baixo', number(operations.stock?.estoque_baixo), 'Requer atenção', '#/inventory')}
    </section>
    <section class="panel" style="margin-top:16px"><div class="toolbar"><strong>Acesso rápido</strong></div><div class="detail-list" style="padding:16px">
      <div><small>Clientes</small><a href="#/clients">Abrir cadastro</a></div><div><small>Vendas</small><a href="#/sales">Nova venda</a></div><div><small>Ordens</small><a href="#/orders">Acompanhar OS</a></div>
    </div></section>`;
}
function metric(label, value, hint, href) { return `<a class="metric-card" href="${href}" style="text-decoration:none;color:inherit"><span>${label}</span><strong>${value}</strong><small>${hint}</small></a>`; }

async function renderInventory() {
  loading();
  const state = { page: 1, search: '', status: '' };
  const load = async () => {
    const result = await api(`/api/inventory/movements?page=${state.page}&pageSize=25&search=${encodeURIComponent(state.search)}${state.status ? `&status=${state.status}` : ''}`);
    root().innerHTML = `${pageHeader('Estoque', 'Entradas e saídas são imutáveis; correções usam um movimento compensatório.', `<button class="button primary" data-new-movement>${icon('inventory')}Movimentar estoque</button>`)}
      <section class="panel"><form class="toolbar" id="inventory-filter"><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar produto, motivo ou usuário"><select name="status"><option value="">Entradas e saídas</option><option value="entrada" ${state.status === 'entrada' ? 'selected' : ''}>Entradas</option><option value="saida" ${state.status === 'saida' ? 'selected' : ''}>Saídas</option></select><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([{ key: 'data', label: 'Data', render: date }, { key: 'tipo', label: 'Movimento', render: badge }, { key: 'produto_nome', label: 'Produto', render: text }, { key: 'quantidade', label: 'Quantidade', render: number }, { key: 'motivo', label: 'Motivo' }, { key: 'usuario_nome', label: 'Usuário', render: text }], result.items)}${pagination(result.pagination)}</section>`;
    root().querySelector('#inventory-filter').addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.search = data.search; state.status = data.status; state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelector('[data-new-movement]').addEventListener('click', async () => {
      const products = await allItems('/api/catalog/products');
      openForm({
        title: 'Movimentar estoque', eyebrow: 'Estoque',
        fields: [
          { name: 'type', label: 'Tipo', type: 'select', options: [{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }] },
          { name: 'productId', label: 'Produto', type: 'select', numeric: true, options: products.map((item) => ({ value: item.id, label: `${item.nome} · saldo ${item.estoque}` })) },
          { name: 'quantity', label: 'Quantidade', type: 'number', step: 1, min: 1, numeric: true, required: true },
          { name: 'reason', label: 'Motivo', required: true, full: true, max: 100 }
        ],
        onSubmit: async (data) => { await api('/api/inventory/movements', { method: 'POST', body: data }); toast('Estoque atualizado.'); await load(); }
      });
    });
  };
  await load();
}

async function renderFinance(route) {
  loading();
  let type = route.query.type === 'payables' ? 'payables' : 'receivables';
  const state = { page: 1, search: '', paid: '', from: '', to: '' };
  const load = async () => {
    const params = new URLSearchParams({ page: state.page, pageSize: 25, search: state.search });
    if (state.paid) params.set('paid', state.paid);
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
    const result = await api(`/api/finance/${type}?${params}`);
    const label = type === 'payables' ? 'Contas a pagar' : 'Contas a receber';
    root().innerHTML = `${pageHeader('Financeiro', 'Controle de vencimentos, baixas, reaberturas e cancelamentos.', `<button class="button primary" data-new-entry>${icon('plus')}Novo lançamento</button>`)}
      <div class="split-tabs"><a class="${type === 'receivables' ? 'active' : ''}" href="#/finance?type=receivables">Contas a receber</a><a class="${type === 'payables' ? 'active' : ''}" href="#/finance?type=payables">Contas a pagar</a></div>
      <section class="panel"><form class="toolbar" id="finance-filter"><strong>${label}</strong><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar descrição ou pessoa"><select name="paid"><option value="">Todas</option><option value="Não" ${state.paid === 'Não' ? 'selected' : ''}>Pendentes</option><option value="Sim" ${state.paid === 'Sim' ? 'selected' : ''}>Pagas</option></select><label class="compact-field">De <input name="from" type="date" value="${escapeHtml(state.from)}"></label><label class="compact-field">Até <input name="to" type="date" value="${escapeHtml(state.to)}"></label><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([{ key: 'vencimento', label: 'Vencimento', render: date }, { key: 'descricao', label: 'Descrição' }, { key: 'pessoa_nome', label: type === 'payables' ? 'Fornecedor' : 'Cliente', render: text }, { key: 'subtotal', label: 'Valor', render: (value) => `<span class="money">${money(value)}</span>` }, { key: 'forma_pgto_nome', label: 'Forma', render: text }, { key: 'pago', label: 'Pagamento', render: badge }, { key: 'node_status', label: 'Situação', render: badge }], result.items, (item) => financeActions(item))}${pagination(result.pagination)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    root().querySelector('#finance-filter').addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.search = data.search; state.paid = data.paid; state.from = data.from; state.to = data.to; state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelector('[data-new-entry]').addEventListener('click', () => openFinanceForm(type, null, load));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const item = byId.get(button.dataset.id);
      if (button.dataset.action === 'edit') openFinanceForm(type, item, load);
      if (button.dataset.action === 'settle') await confirmAction('Confirmar a baixa deste lançamento hoje?', async () => { await api(`/api/finance/${type}/${item.id}/settle`, { method: 'POST', body: { paymentDate: new Date().toISOString().slice(0, 10) } }); toast('Baixa registrada.'); await load(); });
      if (button.dataset.action === 'reopen') { const reason = prompt('Informe o motivo da reabertura:'); if (reason) { await api(`/api/finance/${type}/${item.id}/reopen`, { method: 'POST', body: { reason } }); toast('Lançamento reaberto.'); await load(); } }
      if (button.dataset.action === 'cancel') { const reason = prompt('Informe o motivo do cancelamento:'); if (reason) { await api(`/api/finance/${type}/${item.id}`, { method: 'DELETE', body: { reason } }); toast('Lançamento cancelado.'); await load(); } }
    }));
  };
  await load();
}
function financeActions(item) {
  if (item.node_status === 'cancelado') return '';
  return `${item.pago === 'Sim' ? `<button class="button ghost small" data-action="reopen" data-id="${item.id}">${icon('refresh')}Reabrir</button>` : editButton(item.id) + `<button class="button ghost small" data-action="settle" data-id="${item.id}">${icon('check')}Baixar</button>`}<button class="button danger small" data-action="cancel" data-id="${item.id}">${icon('close')}Cancelar</button>`;
}
async function openFinanceForm(type, item, reload) {
  const [people, paymentMethods] = await Promise.all([
    allItems(type === 'payables' ? '/api/catalog/suppliers' : '/api/clients'),
    allItems('/api/finance/payment-methods', false)
  ]);
  const personField = type === 'payables' ? 'fornecedor' : 'cliente';
  openForm({
    title: item ? 'Editar lançamento' : 'Novo lançamento', eyebrow: 'Financeiro', record: item ? { ...item, valor: item.valor ?? item.subtotal } : {},
    fields: [
      { name: 'descricao', label: 'Descrição', required: true, max: 100 },
      { name: personField, label: type === 'payables' ? 'Fornecedor' : 'Cliente', type: 'select', numeric: true, options: [{ value: 0, label: 'Não informado' }, ...people.map((person) => ({ value: person.id, label: person.nome }))] },
      { name: 'valor', label: 'Valor', type: 'number', step: '.01', min: 0, numeric: true, required: true },
      { name: 'vencimento', label: 'Vencimento', type: 'date', required: true },
      { name: 'forma_pgto', label: 'Forma de pagamento', type: 'select', numeric: true, options: [{ value: 0, label: 'Não informado' }, ...paymentMethods.map((method) => ({ value: method.id, label: method.nome }))] },
      { name: 'obs', label: 'Observações', full: true, optional: true, max: 100 }
    ],
    onSubmit: async (data) => { await api(item ? `/api/finance/${type}/${item.id}` : `/api/finance/${type}`, { method: item ? 'PATCH' : 'POST', body: data }); toast(item ? 'Lançamento atualizado.' : 'Lançamento criado.'); await reload(); }
  });
}

async function renderSales() {
  loading();
  const state = { page: 1, search: '', status: '' };
  const load = async () => {
    const params = new URLSearchParams({ page: state.page, pageSize: 25, search: state.search });
    if (state.status) params.set('status', state.status);
    const result = await api(`/api/sales?${params}`);
    root().innerHTML = `${pageHeader('Vendas / PDV', 'Vendas integradas ao financeiro e ao estoque.', `<button class="button primary" data-new-sale>${icon('plus')}Nova venda</button>`)}
      <section class="panel"><form class="toolbar" id="sales-filter"><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar cliente, venda ou forma de pagamento"><select name="status"><option value="">Ativas e canceladas</option><option value="ativo" ${state.status === 'ativo' ? 'selected' : ''}>Ativas</option><option value="cancelado" ${state.status === 'cancelado' ? 'selected' : ''}>Canceladas</option></select><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([{ key: 'id', label: 'Venda' }, { key: 'data_lanc', label: 'Data', render: date }, { key: 'cliente_nome', label: 'Cliente', render: text }, { key: 'forma_pgto_nome', label: 'Forma', render: text }, { key: 'total_venda', label: 'Total', render: (value, item) => `<span class="money">${money(value || item.valor)}</span>` }, { key: 'pago', label: 'Pagamento', render: badge }, { key: 'node_status', label: 'Situação', render: badge }], result.items, (item) => item.node_status === 'cancelado' ? '' : `<button class="button danger small" data-cancel-sale="${item.id}">${icon('close')}Cancelar</button>`)}${pagination(result.pagination)}</section>`;
    root().querySelector('#sales-filter').addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.search = data.search; state.status = data.status; state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelector('[data-new-sale]').addEventListener('click', async () => {
      const [clients, products, paymentMethods] = await Promise.all([allItems('/api/clients'), allItems('/api/catalog/products'), allItems('/api/finance/payment-methods', false)]);
      openSaleForm(clients, products.filter((item) => item.ativo === 'Sim'), paymentMethods, load);
    });
    root().querySelectorAll('[data-cancel-sale]').forEach((button) => button.addEventListener('click', async () => { const reason = prompt('Informe o motivo do cancelamento da venda:'); if (reason) { await api(`/api/sales/${button.dataset.cancelSale}`, { method: 'DELETE', body: { reason } }); toast('Venda cancelada e estoque restaurado.'); await load(); } }));
  };
  await load();
}

function openSaleForm(clients, products, paymentMethods, reload) {
  if (!clients.length || !products.length) {
    toast('Cadastre ao menos um cliente e um produto ativo antes da venda.', 'error');
    return;
  }
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  const lines = [{ productId: products[0].id, quantity: 1 }];
  document.querySelector('#modal-title').textContent = 'Nova venda';
  document.querySelector('#modal-eyebrow').textContent = 'PDV';
  document.querySelector('#modal-submit-label').textContent = 'Concluir venda';
  document.querySelector('#modal-error').textContent = '';
  const renderLines = () => {
    const container = form.querySelector('#sale-lines');
    container.innerHTML = lines.map((line, index) => `<div class="line-item" data-sale-line="${index}">
      <label class="field">Produto<select data-line-product required>${products.map((product) => `<option value="${product.id}" ${String(product.id) === String(line.productId) ? 'selected' : ''}>${escapeHtml(product.nome)} · ${money(product.valor_venda)} · saldo ${number(product.estoque)}</option>`).join('')}</select></label>
      <label class="field quantity">Quantidade<input data-line-quantity type="number" min="1" step="1" value="${line.quantity}" required></label>
      <button class="button danger small" type="button" data-remove-line="${index}" ${lines.length === 1 ? 'disabled' : ''}>${icon('trash')}Remover</button>
    </div>`).join('');
    container.querySelectorAll('[data-remove-line]').forEach((button) => button.addEventListener('click', () => { lines.splice(Number(button.dataset.removeLine), 1); renderLines(); }));
  };
  document.querySelector('#modal-body').innerHTML = `<div class="modal-grid">
    <label class="field full">Cliente<select name="clientId" required>${clients.map((client) => `<option value="${client.id}">${escapeHtml(client.nome)}</option>`).join('')}</select></label>
    <label class="field">Vencimento<input name="dueDate" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label>
    <label class="field">Pagamento imediato<select name="paid"><option value="false">Não</option><option value="true">Sim</option></select></label>
    <label class="field full">Forma de pagamento<select name="paymentMethodId"><option value="0">Não informado</option>${paymentMethods.map((method) => `<option value="${method.id}">${escapeHtml(method.nome)}</option>`).join('')}</select></label>
    <div class="full line-items-header"><strong>Itens da venda</strong><button class="button ghost small" type="button" id="add-sale-line">${icon('plus')}Adicionar produto</button></div>
    <div class="full" id="sale-lines"></div>
  </div>`;
  renderLines();
  form.querySelector('#add-sale-line').addEventListener('click', () => { lines.push({ productId: products[0].id, quantity: 1 }); renderLines(); });
  const handler = async (event) => {
    event.preventDefault();
    const submit = document.querySelector('#modal-submit');
    submit.disabled = true;
    document.querySelector('#modal-error').textContent = '';
    try {
      const values = Object.fromEntries(new FormData(form));
      const items = [...form.querySelectorAll('[data-sale-line]')].map((row) => ({
        productId: Number(row.querySelector('[data-line-product]').value),
        quantity: Number(row.querySelector('[data-line-quantity]').value)
      }));
      if (items.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1)) throw new Error('Revise os produtos e as quantidades.');
      await api('/api/sales', { method: 'POST', body: { clientId: Number(values.clientId), paymentMethodId: Number(values.paymentMethodId), dueDate: values.dueDate, paid: values.paid === 'true', items } });
      toast('Venda concluída.');
      await reload();
      dialog.close();
    } catch (error) {
      document.querySelector('#modal-error').textContent = error.message;
    } finally { submit.disabled = false; }
  };
  if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
  form._submitHandler = handler;
  form.addEventListener('submit', handler);
  dialog.showModal();
}

function openWorkForm({ type, config, item, clients, products, services, users, reload }) {
  if (!clients.length) {
    toast('Cadastre ao menos um cliente ativo antes de continuar.', 'error');
    return;
  }
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  const lines = (item?.items || []).map((line) => ({ kind: line.kind, itemId: line.itemId, quantity: Number(line.quantity) }));
  let itemsTouched = lines.length > 0;
  const currentStatus = item?.status || config.statuses[0];
  const allowedStatuses = item ? [currentStatus, ...(config.transitions[currentStatus] || [])] : [config.statuses[0]];
  const record = item || { cliente: clients[0].id, data_entrega: new Date().toISOString().slice(0, 10), valor: 0, status: currentStatus };
  document.querySelector('#modal-title').textContent = item ? `Editar ${config.singular}` : config.newLabel;
  document.querySelector('#modal-eyebrow').textContent = config.title;
  document.querySelector('#modal-submit-label').textContent = 'Salvar';
  document.querySelector('#modal-error').textContent = '';
  document.querySelector('#modal-body').innerHTML = `<div class="modal-grid">
    <label class="field">Cliente<select name="cliente" required>${clients.map((client) => `<option value="${client.id}" ${String(client.id) === String(record.cliente) ? 'selected' : ''}>${escapeHtml(client.nome)}</option>`).join('')}</select></label>
    <label class="field">Data prevista<input name="data_entrega" type="date" value="${escapeHtml(String(record.data_entrega || '').slice(0, 10))}" required></label>
    <label class="field">Situação<select name="status">${allowedStatuses.map((status) => `<option value="${escapeHtml(status)}" ${status === currentStatus ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>
    <label class="field">Valor sem itens<input name="valor" type="number" step=".01" min="0" value="${escapeHtml(record.valor ?? record.subtotal ?? 0)}" required></label>
    ${type === 'orders' ? `<label class="field">Técnico<select name="tecnico"><option value="0">Não informado</option>${users.map((user) => `<option value="${user.id}" ${String(user.id) === String(record.tecnico) ? 'selected' : ''}>${escapeHtml(user.nome)}</option>`).join('')}</select></label>` : ''}
    <label class="field">Validade (dias)<input name="dias_validade" type="number" step="1" min="0" value="${escapeHtml(record.dias_validade ?? 0)}"></label>
    <label class="field">Desconto<input name="desconto" type="number" step=".01" min="0" value="${escapeHtml(record.desconto ?? 0)}"></label>
    <label class="field">Tipo do desconto<select name="tipo_desconto"><option value="Valor" ${record.tipo_desconto === 'Valor' ? 'selected' : ''}>Valor</option><option value="Percentual" ${record.tipo_desconto === 'Percentual' ? 'selected' : ''}>Percentual</option></select></label>
    <label class="field">Frete<input name="frete" type="number" step=".01" min="0" value="${escapeHtml(record.frete ?? 0)}"></label>
    <label class="field">Mão de obra<input name="mao_obra" type="number" step=".01" min="0" value="${escapeHtml(record.mao_obra ?? 0)}"></label>
    <label class="field">Equipamento<input name="equipamento" maxlength="255" value="${escapeHtml(record.equipamento)}"></label>
    <label class="field">Marca<input name="marca" maxlength="255" value="${escapeHtml(record.marca)}"></label>
    <label class="field">Modelo<input name="modelo" maxlength="255" value="${escapeHtml(record.modelo)}"></label>
    <label class="field">Senha do aparelho<input name="senha_ap" maxlength="50" value="${escapeHtml(record.senha_ap)}"></label>
    <label class="field full">Defeito ou solicitação<textarea name="defeito" maxlength="1000">${escapeHtml(record.defeito)}</textarea></label>
    <label class="field full">Condições ou avarias<textarea name="condicoes" maxlength="2000">${escapeHtml(record.condicoes)}</textarea></label>
    <label class="field full">Acessórios entregues<textarea name="acessorios" maxlength="1000">${escapeHtml(record.acessorios)}</textarea></label>
    <label class="field full">Laudo técnico<textarea name="laudo" maxlength="2000">${escapeHtml(record.laudo)}</textarea></label>
    ${type === 'orders' ? `<label class="field">Valor de entrada<input name="val_entrada" type="number" step=".01" min="0" value="${escapeHtml(record.val_entrada ?? 0)}"></label>
    <label class="field">Garantia<input name="dias_garantia" maxlength="50" value="${escapeHtml(record.dias_garantia)}"></label>
    <label class="field">Pagamento<select name="pago"><option value="Não" ${record.pago !== 'Sim' ? 'selected' : ''}>Não</option><option value="Sim" ${record.pago === 'Sim' ? 'selected' : ''}>Sim</option></select></label>
    <label class="field">Forma de pagamento<input name="forma_pgto" maxlength="20" value="${escapeHtml(record.forma_pgto)}"></label>` : ''}
    <label class="field full">Observações<textarea name="obs" maxlength="255">${escapeHtml(record.obs)}</textarea></label>
    <div class="full line-items-header"><strong>Produtos e serviços</strong><span><button class="button ghost small" type="button" data-add-work-line="product">${icon('plus')}Produto</button> <button class="button ghost small" type="button" data-add-work-line="service">${icon('plus')}Serviço</button></span></div>
    <div class="full" id="work-lines"></div>
  </div>`;
  const renderLines = () => {
    const container = form.querySelector('#work-lines');
    if (!lines.length) {
      container.innerHTML = '<p class="muted line-items-empty">Nenhum item incluído. O valor informado acima será usado.</p>';
      return;
    }
    container.innerHTML = lines.map((line, index) => {
      const catalog = line.kind === 'product' ? products : services;
      return `<div class="line-item" data-work-line="${index}" data-kind="${line.kind}">
        <label class="field">${line.kind === 'product' ? 'Produto' : 'Serviço'}<select data-work-item required>${catalog.map((entry) => `<option value="${entry.id}" ${String(entry.id) === String(line.itemId) ? 'selected' : ''}>${escapeHtml(entry.nome)} · ${money(line.kind === 'product' ? entry.valor_venda : entry.valor)}</option>`).join('')}</select></label>
        <label class="field quantity">Quantidade<input data-work-quantity type="number" min="1" step="1" value="${line.quantity}" required></label>
        <button class="button danger small" type="button" data-remove-work-line="${index}">${icon('trash')}Remover</button>
      </div>`;
    }).join('');
    container.querySelectorAll('[data-remove-work-line]').forEach((button) => button.addEventListener('click', () => {
      lines.splice(Number(button.dataset.removeWorkLine), 1);
      itemsTouched = true;
      renderLines();
    }));
  };
  form.querySelectorAll('[data-add-work-line]').forEach((button) => button.addEventListener('click', () => {
    const kind = button.dataset.addWorkLine;
    const catalog = kind === 'product' ? products : services;
    if (!catalog.length) {
      toast(`Nenhum ${kind === 'product' ? 'produto' : 'serviço'} ativo disponível.`, 'error');
      return;
    }
    lines.push({ kind, itemId: catalog[0].id, quantity: 1 });
    itemsTouched = true;
    renderLines();
  }));
  renderLines();
  const handler = async (event) => {
    event.preventDefault();
    const submit = document.querySelector('#modal-submit');
    submit.disabled = true;
    document.querySelector('#modal-error').textContent = '';
    try {
      const values = Object.fromEntries(new FormData(form));
      const payload = {
        cliente: Number(values.cliente),
        data_entrega: values.data_entrega,
        status: values.status,
        valor: Number(values.valor),
        dias_validade: Number(values.dias_validade || 0),
        desconto: Number(values.desconto || 0),
        tipo_desconto: values.tipo_desconto,
        frete: Number(values.frete || 0),
        mao_obra: Number(values.mao_obra || 0),
        equipamento: values.equipamento,
        marca: values.marca,
        modelo: values.modelo,
        senha_ap: values.senha_ap,
        defeito: values.defeito,
        condicoes: values.condicoes,
        acessorios: values.acessorios,
        laudo: values.laudo,
        obs: values.obs,
        ...(type === 'orders' ? {
          tecnico: Number(values.tecnico),
          val_entrada: Number(values.val_entrada || 0),
          dias_garantia: values.dias_garantia,
          pago: values.pago,
          forma_pgto: values.forma_pgto
        } : {})
      };
      if (itemsTouched) {
        payload.items = [...form.querySelectorAll('[data-work-line]')].map((row) => ({
          kind: row.dataset.kind,
          itemId: Number(row.querySelector('[data-work-item]').value),
          quantity: Number(row.querySelector('[data-work-quantity]').value)
        }));
      }
      await api(item ? `/api/work/${type}/${item.id}` : `/api/work/${type}`, { method: item ? 'PATCH' : 'POST', body: payload });
      toast(item ? 'Registro atualizado.' : 'Registro criado.');
      await reload();
      dialog.close();
    } catch (error) {
      document.querySelector('#modal-error').textContent = error.message;
    } finally { submit.disabled = false; }
  };
  if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
  form._submitHandler = handler;
  form.addEventListener('submit', handler);
  dialog.showModal();
}

async function renderWork(type) {
  loading();
  const config = {
    orders: {
      title: 'Ordens de serviço',
      singular: 'ordem de serviço',
      newLabel: 'Nova ordem de serviço',
      statuses: ['Aberta', 'Iniciada', 'Em andamento', 'Aguardando Peça', 'Aguardando Aprovação', 'Finalizada', 'Entregue', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
      transitions: {
        Aberta: ['Iniciada', 'Em andamento', 'Aguardando Peça', 'Aguardando Aprovação', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
        Iniciada: ['Em andamento', 'Aguardando Peça', 'Aguardando Aprovação', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
        'Em andamento': ['Iniciada', 'Aguardando Peça', 'Aguardando Aprovação', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
        'Aguardando Peça': ['Iniciada', 'Em andamento', 'Aguardando Aprovação', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
        'Aguardando Aprovação': ['Iniciada', 'Em andamento', 'Aguardando Peça', 'Finalizada', 'Sem Reparo', 'Não Aprovada', 'Cancelada'],
        Finalizada: ['Entregue', 'Cancelada'],
        Entregue: [], 'Sem Reparo': [], 'Não Aprovada': [], Cancelada: []
      }
    },
    quotes: {
      title: 'Orçamentos',
      singular: 'orçamento',
      newLabel: 'Novo orçamento',
      statuses: ['Pendente', 'Aprovado', 'Reprovado', 'Cancelado'],
      transitions: { Pendente: ['Aprovado', 'Reprovado', 'Cancelado'], Aprovado: ['Cancelado'], Reprovado: ['Pendente', 'Cancelado'], Cancelado: [] }
    }
  }[type];
  const state = { page: 1, search: '', status: '' };
  const load = async () => {
    const params = new URLSearchParams({ page: state.page, pageSize: 25, search: state.search });
    if (state.status) params.set('status', state.status);
    const result = await api(`/api/work/${type}?${params}`);
    root().innerHTML = `${pageHeader(config.title, 'Acompanhamento por cliente, equipamento, data e situação.', `<button class="button primary" data-new-work>${icon('plus')}${config.newLabel}</button>`)}
      <section class="panel"><form class="toolbar" id="work-filter"><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar cliente, equipamento ou responsável"><select name="status"><option value="">Todas as situações</option>${config.statuses.map((status) => `<option value="${escapeHtml(status)}" ${state.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([{ key: 'id', label: 'Número' }, { key: 'data', label: 'Data', render: date }, { key: 'cliente_nome', label: 'Cliente', render: text }, { key: 'equipamento', label: 'Equipamento', render: text }, { key: 'subtotal', label: 'Total', render: (value) => `<span class="money">${money(value)}</span>` }, { key: 'status', label: 'Situação', render: badge }], result.items, (item) => `${editButton(item.id)}${attachmentButton(type, item.id)}${/Cancel/.test(item.status) ? '' : `<button class="button danger small" data-action="cancel" data-id="${item.id}">${icon('close')}Cancelar</button>`}`)}${pagination(result.pagination)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    const showForm = async (item) => {
      const fullItem = item ? await api(`/api/work/${type}/${item.id}`) : null;
      const [clients, products, services, users] = await Promise.all([
        allItems('/api/clients'),
        allItems('/api/catalog/products'),
        allItems('/api/catalog/services'),
        type === 'orders' ? allItems('/api/users') : Promise.resolve([])
      ]);
      openWorkForm({ type, config, item: fullItem, clients, products, services, users, reload: load });
    };
    root().querySelector('#work-filter').addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.search = data.search; state.status = data.status; state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelector('[data-new-work]').addEventListener('click', () => showForm(null));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const item = byId.get(button.dataset.id);
      if (button.dataset.action === 'attachments') {
        await openAttachments({ entity: type, id: Number(button.dataset.attachmentId), title: `${config.singular} #${button.dataset.attachmentId}` });
        return;
      }
      if (button.dataset.action === 'edit') await showForm(item);
      if (button.dataset.action === 'cancel') await confirmAction(`Cancelar este ${config.singular}?`, async () => { await api(`/api/work/${type}/${item.id}`, { method: 'DELETE', body: { reason: 'Cancelamento pela interface' } }); toast('Registro cancelado.'); await load(); });
    }));
  };
  await load();
}

export async function renderRoute(route) {
  if (await renderExtraRoute(route)) return;
  if (route.name === 'dashboard') return renderDashboard();
  if (entityConfigs[route.name]) return renderCrud(entityConfigs[route.name]);
  if (route.name === 'inventory') return renderInventory();
  if (route.name === 'finance') return renderFinance(route);
  if (route.name === 'sales') return renderSales();
  if (route.name === 'orders' || route.name === 'quotes') return renderWork(route.name);
  return renderDashboard();
}
