import { api } from './api.js';
import { money, number, date, text, escapeHtml, badge } from './format.mjs';
import { icon } from './icons.mjs';
import { loading, pageHeader, table, pagination, openForm, confirmAction, toast } from './ui.js';
import { attachmentButton, openAttachments } from './attachments.js';
import { session } from './session.js';

const root = () => document.querySelector('#page-root');
const yesNo = () => [{ value: 'Sim', label: 'Sim' }, { value: 'Não', label: 'Não' }];
const today = () => new Date().toISOString().slice(0, 10);
const editButton = (id) => `<button class="button ghost small" data-action="edit" data-id="${id}">${icon('edit')}Editar</button>`;

async function allItems(path, status = '') {
  const query = new URLSearchParams({ page: 1, pageSize: 100 });
  if (status) query.set('status', status);
  const result = await api(`${path}?${query}`);
  return result.items || [];
}

const referenceConfigs = {
  categories: {
    title: 'Categorias', singular: 'categoria', path: '/api/reference/categories', permission: 'categorias',
    subtitle: 'Organização principal do catálogo de produtos.',
    columns: [{ key: 'nome', label: 'Categoria' }, { key: 'icone', label: 'Ícone', render: text }, { key: 'ativo', label: 'Situação', render: badge }],
    fields: [{ name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'icone', label: 'Ícone', optional: true, max: 60 }, { name: 'ativo', label: 'Situação', type: 'select', options: yesNo() }],
    active: true
  },
  subcategories: {
    title: 'Subcategorias', singular: 'subcategoria', path: '/api/reference/subcategories', permission: 'sub_categorias',
    subtitle: 'Classificações complementares para o catálogo.',
    columns: [{ key: 'nome', label: 'Subcategoria' }, { key: 'ativo', label: 'Situação', render: badge }],
    fields: [{ name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'ativo', label: 'Situação', type: 'select', options: yesNo() }],
    active: true
  },
  brands: {
    title: 'Marcas', singular: 'marca', path: '/api/reference/brands', permission: 'marcas',
    subtitle: 'Marcas utilizadas em produtos, equipamentos e ordens.',
    columns: [{ key: 'nome', label: 'Marca' }, { key: 'ativo', label: 'Situação', render: badge }],
    fields: [{ name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'ativo', label: 'Situação', type: 'select', options: yesNo() }],
    active: true
  },
  equipment: {
    title: 'Equipamentos', singular: 'equipamento', path: '/api/reference/equipment', permission: 'equipamentos',
    subtitle: 'Tipos de equipamentos atendidos nas ordens de serviço.',
    columns: [{ key: 'nome', label: 'Equipamento' }, { key: 'ativo', label: 'Situação', render: badge }],
    fields: [{ name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'ativo', label: 'Situação', type: 'select', options: yesNo() }],
    active: true
  },
  models: {
    title: 'Modelos', singular: 'modelo', path: '/api/reference/models', permission: 'modelos',
    subtitle: 'Modelos relacionados a marcas e equipamentos.',
    columns: [{ key: 'nome', label: 'Modelo' }, { key: 'marca', label: 'Marca', render: text }, { key: 'equipamento', label: 'Equipamento', render: text }, { key: 'ativo', label: 'Situação', render: badge }],
    fields: [
      { name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'marca', label: 'Marca', optional: true, max: 100 },
      { name: 'equipamento', label: 'Equipamento', optional: true, max: 100 }, { name: 'ativo', label: 'Situação', type: 'select', options: yesNo() }
    ],
    active: true
  },
  'payment-methods': {
    title: 'Formas de pagamento', singular: 'forma de pagamento', path: '/api/reference/payment-methods', permission: 'formas_pgto',
    subtitle: 'Meios aceitos nas vendas, compras e movimentações financeiras.',
    columns: [{ key: 'nome', label: 'Forma' }, { key: 'taxa', label: 'Taxa (%)', render: number }],
    fields: [{ name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'taxa', label: 'Taxa (%)', type: 'number', min: 0, numeric: true, optional: true }]
  },
  positions: {
    title: 'Cargos', singular: 'cargo', path: '/api/reference/positions', permission: 'cargos',
    subtitle: 'Cargos e funções utilizados pela equipe.',
    columns: [{ key: 'nome', label: 'Cargo' }],
    fields: [{ name: 'nome', label: 'Nome', required: true, max: 50 }]
  },
  frequencies: {
    title: 'Frequências', singular: 'frequência', path: '/api/reference/frequencies', permission: 'frequencias',
    subtitle: 'Intervalos usados em tarefas e cobranças recorrentes.',
    columns: [{ key: 'frequencia', label: 'Frequência' }, { key: 'dias', label: 'Dias', render: number }],
    fields: [{ name: 'frequencia', label: 'Nome', required: true, max: 25 }, { name: 'dias', label: 'Dias', type: 'number', min: 0, numeric: true, required: true }]
  },
  'account-plans': {
    title: 'Plano de contas', singular: 'conta', path: '/api/reference/account-plans', permission: 'plano_contas',
    subtitle: 'Classificação gerencial das receitas e despesas.',
    columns: [{ key: 'nome', label: 'Conta' }],
    fields: [{ name: 'nome', label: 'Nome', required: true, max: 150 }]
  },
  coupons: {
    title: 'Cupons', singular: 'cupom', path: '/api/reference/coupons', permission: 'cupom',
    subtitle: 'Cupons de desconto com valor, validade e limite de uso.',
    columns: [
      { key: 'codigo', label: 'Código' }, { key: 'tipo', label: 'Tipo', render: badge },
      { key: 'valor', label: 'Valor', render: (value, item) => item.tipo === 'Percentual' ? `${number(value)}%` : money(value) },
      { key: 'data', label: 'Validade', render: date }, { key: 'quantidade', label: 'Quantidade', render: number }
    ],
    fields: [
      { name: 'codigo', label: 'Código', required: true, max: 50 },
      { name: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'Valor', label: 'Valor em reais' }, { value: 'Percentual', label: 'Percentual' }] },
      { name: 'valor', label: 'Valor', type: 'number', step: '.01', min: 0, numeric: true, required: true },
      { name: 'valor_minimo', label: 'Compra mínima', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
      { name: 'quantidade', label: 'Limite de usos', type: 'number', min: 0, numeric: true, optional: true },
      { name: 'data', label: 'Validade', type: 'date', optional: true }
    ]
  },
  'contract-templates': {
    title: 'Modelos de contrato', singular: 'modelo', path: '/api/reference/contract-templates', permission: 'modelos_contratos',
    subtitle: 'Textos reutilizáveis. Aceita {{cliente.nome}}, {{cliente.cpf}}, {{cliente.endereco}}, {{empresa.nome}} e {{data}}.',
    columns: [{ key: 'modelo', label: 'Modelo' }, { key: 'mostrar_modelos', label: 'Disponível', render: badge }],
    fields: [
      { name: 'modelo', label: 'Nome do modelo', required: true, max: 50 },
      { name: 'mostrar_modelos', label: 'Disponível', type: 'select', options: yesNo() },
      { name: 'texto', label: 'Texto do contrato', type: 'textarea', required: true, full: true, max: 50000 }
    ]
  }
};

async function renderReference(config) {
  loading();
  const state = { page: 1, search: '', status: '' };
  const load = async () => {
    const query = new URLSearchParams({ page: state.page, pageSize: 25, search: state.search });
    if (state.status) query.set('status', state.status);
    const result = await api(`${config.path}?${query}`);
    root().innerHTML = `${pageHeader(config.title, config.subtitle, `<button class="button primary" data-new>${icon('plus')}Novo ${escapeHtml(config.singular)}</button>`)}
      <section class="panel"><form class="toolbar" data-filter>
        <input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar">
        ${config.active ? `<select name="status"><option value="">Todas as situações</option><option value="Sim">Ativos</option><option value="Não">Inativos</option></select>` : ''}
        <button class="button ghost">${icon('filter')}Filtrar</button>
      </form>${table(config.columns, result.items, (item) => `${editButton(item.id)}${config.active ? (item.ativo === 'Não'
        ? `<button class="button ghost small" data-action="restore" data-id="${item.id}">${icon('refresh')}Reativar</button>`
        : `<button class="button danger small" data-action="delete" data-id="${item.id}">${icon('power')}Inativar</button>`)
        : `<button class="button danger small" data-action="delete" data-id="${item.id}">${icon('trash')}Excluir</button>`}`)}${pagination(result.pagination)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    const showForm = (record = {}) => openForm({
      title: record.id ? `Editar ${config.singular}` : `Novo ${config.singular}`,
      eyebrow: config.title, fields: config.fields, record,
      onSubmit: async (values) => {
        await api(record.id ? `${config.path}/${record.id}` : config.path, { method: record.id ? 'PATCH' : 'POST', body: values });
        toast(record.id ? 'Registro atualizado.' : 'Registro criado.');
        await load();
      }
    });
    root().querySelector('[data-new]').addEventListener('click', () => showForm());
    root().querySelector('[data-filter]').addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      state.search = values.search || ''; state.status = values.status || ''; state.page = 1; load();
    });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const record = byId.get(button.dataset.id);
      if (button.dataset.action === 'edit') return showForm(record);
      if (button.dataset.action === 'restore') {
        await api(`${config.path}/${record.id}/restore`, { method: 'POST', body: {} });
        toast('Registro reativado.'); return load();
      }
      await confirmAction(`${config.active ? 'Inativar' : 'Excluir'} este registro?`, async () => {
        await api(`${config.path}/${record.id}`, { method: 'DELETE', body: { reason: 'Operação realizada pela interface' } });
        toast(config.active ? 'Registro inativado.' : 'Registro excluído.'); await load();
      });
    }));
  };
  await load();
}

async function renderNotes() {
  loading();
  const state = { page: 1, search: '' };
  const load = async () => {
    const result = await api(`/api/collaboration/notes?page=${state.page}&pageSize=25&search=${encodeURIComponent(state.search)}`);
    root().innerHTML = `${pageHeader('Anotações', 'Notas públicas, privadas e destacadas no painel.', `<button class="button primary" data-new>${icon('plus')}Nova anotação</button>`)}
      <section class="panel"><form class="toolbar" data-filter><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar título ou conteúdo"><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([
        { key: 'data', label: 'Data', render: date }, { key: 'titulo', label: 'Título' },
        { key: 'usuario_nome', label: 'Autor', render: text }, { key: 'privado', label: 'Privada', render: badge },
        { key: 'mostrar_home', label: 'No painel', render: badge }
      ], result.items, (item) => `${editButton(item.id)}<button class="button danger small" data-action="delete" data-id="${item.id}">${icon('trash')}Excluir</button>`)}${pagination(result.pagination)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    const show = (record = {}) => openForm({
      title: record.id ? 'Editar anotação' : 'Nova anotação', eyebrow: 'Anotações', record,
      fields: [
        { name: 'titulo', label: 'Título', required: true, max: 250 },
        { name: 'privado', label: 'Privada', type: 'select', options: yesNo() },
        { name: 'mostrar_home', label: 'Mostrar no painel', type: 'select', options: yesNo() },
        { name: 'msg', label: 'Conteúdo', type: 'textarea', required: true, full: true, max: 10000 }
      ],
      onSubmit: async (values) => {
        await api(record.id ? `/api/collaboration/notes/${record.id}` : '/api/collaboration/notes', { method: record.id ? 'PATCH' : 'POST', body: values });
        toast('Anotação salva.'); await load();
      }
    });
    root().querySelector('[data-new]').addEventListener('click', () => show());
    root().querySelector('[data-filter]').addEventListener('submit', (event) => { event.preventDefault(); state.search = new FormData(event.currentTarget).get('search'); state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const record = byId.get(button.dataset.id);
      if (button.dataset.action === 'edit') return show(record);
      await confirmAction('Excluir esta anotação?', async () => { await api(`/api/collaboration/notes/${record.id}`, { method: 'DELETE', body: { reason: 'Exclusão pela interface' } }); toast('Anotação excluída.'); await load(); });
    }));
  };
  await load();
}

async function renderTasks(route) {
  loading();
  let audience = route.query.audience === 'clients' ? 'clients' : 'users';
  const state = { page: 1, search: '', status: '' };
  const load = async () => {
    const query = new URLSearchParams({ audience, page: state.page, pageSize: 25, search: state.search });
    if (state.status) query.set('status', state.status);
    const result = await api(`/api/collaboration/tasks?${query}`);
    root().innerHTML = `${pageHeader('Tarefas e agenda', 'Lembretes atribuídos a usuários ou relacionados a clientes.', `<button class="button primary" data-new>${icon('plus')}Nova tarefa</button>`)}
      <div class="split-tabs"><a class="${audience === 'users' ? 'active' : ''}" href="#/tasks?audience=users">Equipe</a><a class="${audience === 'clients' ? 'active' : ''}" href="#/tasks?audience=clients">Clientes</a></div>
      <section class="panel"><form class="toolbar" data-filter><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar tarefa ou responsável">
      <select name="status"><option value="">Todas</option>${['Pendente', 'Em andamento', 'Concluída', 'Cancelada'].map((value) => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([
        { key: 'data', label: 'Data', render: date }, { key: 'hora', label: 'Hora', render: text }, { key: 'titulo', label: 'Tarefa' },
        { key: 'target_nome', label: audience === 'users' ? 'Responsável' : 'Cliente', render: text },
        { key: 'prioridade', label: 'Prioridade', render: badge }, { key: 'status', label: 'Situação', render: badge }
      ], result.items, (item) => `${editButton(item.id)}<button class="button danger small" data-action="delete" data-id="${item.id}">${icon('trash')}Excluir</button>`)}${pagination(result.pagination)}</section>`;
    const targets = await allItems(audience === 'users' ? '/api/users' : '/api/clients', 'Sim');
    const frequencies = await allItems('/api/reference/frequencies');
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    const show = (record = {}) => openForm({
      title: record.id ? 'Editar tarefa' : 'Nova tarefa', eyebrow: 'Agenda', record,
      fields: [
        { name: 'targetId', label: audience === 'users' ? 'Responsável' : 'Cliente', type: 'select', numeric: true, required: true, options: targets.map((item) => ({ value: item.id, label: item.nome })) },
        { name: 'data', label: 'Data', type: 'date', required: true, default: today() },
        { name: 'hora', label: 'Hora', type: 'time', required: true },
        { name: 'hora_mensagem', label: 'Horário do lembrete', type: 'time', optional: true },
        { name: 'prioridade', label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta', 'Urgente'].map((value) => ({ value, label: value })) },
        { name: 'status', label: 'Situação', type: 'select', options: ['Pendente', 'Em andamento', 'Concluída', 'Cancelada'].map((value) => ({ value, label: value })) },
        { name: 'recorrencia', label: 'Recorrência', type: 'select', numeric: true, options: [{ value: 0, label: 'Sem recorrência' }, ...frequencies.map((item) => ({ value: item.id, label: item.frequencia }))] },
        { name: 'titulo', label: 'Título', required: true, max: 255 },
        { name: 'descricao', label: 'Descrição', type: 'textarea', optional: true, full: true, max: 2000 }
      ],
      onSubmit: async (values) => {
        await api(`/api/collaboration/tasks${record.id ? `/${record.id}` : ''}?audience=${audience}`, { method: record.id ? 'PATCH' : 'POST', body: values });
        toast('Tarefa salva.'); await load();
      }
    });
    root().querySelector('[data-new]').addEventListener('click', () => show({ data: today(), status: 'Pendente', prioridade: 'Média', recorrencia: 0 }));
    root().querySelector('[data-filter]').addEventListener('submit', (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); state.search = values.search; state.status = values.status; state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const record = byId.get(button.dataset.id);
      if (button.dataset.action === 'edit') return show(record);
      await confirmAction('Excluir esta tarefa?', async () => { await api(`/api/collaboration/tasks/${record.id}?audience=${audience}`, { method: 'DELETE', body: { reason: 'Exclusão pela interface' } }); toast('Tarefa excluída.'); await load(); });
    }));
  };
  await load();
}

async function renderTickets() {
  loading();
  const state = { page: 1, search: '', status: '' };
  const load = async () => {
    const query = new URLSearchParams({ page: state.page, pageSize: 25, search: state.search });
    if (state.status) query.set('status', state.status);
    const result = await api(`/api/collaboration/tickets?${query}`);
    root().innerHTML = `${pageHeader('Chamados', 'Atendimento interno com histórico de respostas.', `<button class="button primary" data-new>${icon('plus')}Novo chamado</button>`)}
      <section class="panel"><form class="toolbar" data-filter><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar chamado">
      <select name="status"><option value="">Todos</option>${['Aberto', 'Em andamento', 'Resolvido', 'Fechado'].map((value) => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([
        { key: 'data', label: 'Data', render: date }, { key: 'titulo', label: 'Assunto' }, { key: 'status', label: 'Situação', render: badge },
        { key: 'respostas', label: 'Respostas', render: number }
      ], result.items, (item) => `<button class="button ghost small" data-action="open" data-id="${item.id}">${icon('clipboard')}Abrir</button>${attachmentButton('tickets', item.id)}`)}${pagination(result.pagination)}</section>`;
    const showNew = () => openForm({
      title: 'Novo chamado', eyebrow: 'Atendimento',
      fields: [{ name: 'titulo', label: 'Assunto', required: true, max: 255 }, { name: 'texto', label: 'Descrição', type: 'textarea', required: true, full: true, max: 10000 }],
      onSubmit: async (values) => { await api('/api/collaboration/tickets', { method: 'POST', body: values }); toast('Chamado aberto.'); await load(); }
    });
    const openTicket = async (ticketId) => {
      const ticket = await api(`/api/collaboration/tickets/${ticketId}`);
      const dialog = document.querySelector('#app-modal');
      const form = document.querySelector('#modal-form');
      document.querySelector('#modal-title').textContent = ticket.titulo;
      document.querySelector('#modal-eyebrow').textContent = `Chamado #${ticket.id} · ${ticket.status}`;
      document.querySelector('#modal-body').innerHTML = `<div class="ticket-thread"><article><strong>Solicitação</strong><p>${escapeHtml(ticket.texto)}</p></article>${ticket.replies.map((reply) => `<article><strong>${escapeHtml(reply.usuario_nome || 'Usuário')} · ${date(reply.data)} ${escapeHtml(reply.hora || '')}</strong><p>${escapeHtml(reply.texto)}</p></article>`).join('')}</div><label class="field full">Nova resposta<textarea name="texto" maxlength="10000" required></textarea></label>`;
      document.querySelector('#modal-submit-label').textContent = 'Responder';
      const handler = async (event) => {
        event.preventDefault();
        try {
          await api(`/api/collaboration/tickets/${ticket.id}/replies`, { method: 'POST', body: { texto: new FormData(form).get('texto') } });
          dialog.close(); toast('Resposta registrada.'); await load();
        } catch (error) { document.querySelector('#modal-error').textContent = error.message; }
      };
      if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
      form._submitHandler = handler; form.addEventListener('submit', handler); dialog.showModal();
    };
    root().querySelector('[data-new]').addEventListener('click', showNew);
    root().querySelector('[data-filter]').addEventListener('submit', (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); state.search = values.search; state.status = values.status; state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelectorAll('[data-action="open"]').forEach((button) => button.addEventListener('click', () => openTicket(button.dataset.id)));
    root().querySelectorAll('[data-action="attachments"]').forEach((button) => button.addEventListener('click', () => openAttachments({ entity: 'tickets', id: Number(button.dataset.attachmentId), title: `chamado #${button.dataset.attachmentId}` })));
  };
  await load();
}

async function renderMarketing(route) {
  loading();
  const tab = ['campaigns', 'groups', 'devices'].includes(route.query.tab) ? route.query.tab : 'campaigns';
  const status = await api('/api/marketing/status');
  const tabs = `<div class="split-tabs"><a class="${tab === 'campaigns' ? 'active' : ''}" href="#/marketing?tab=campaigns">Campanhas</a><a class="${tab === 'groups' ? 'active' : ''}" href="#/marketing?tab=groups">Grupos</a><a class="${tab === 'devices' ? 'active' : ''}" href="#/marketing?tab=devices">Dispositivos</a></div>`;
  if (tab === 'groups') return renderMarketingGroups(tabs, status);
  if (tab === 'devices') return renderMarketingDevices(tabs, status);
  const state = { page: 1, search: '' };
  const load = async () => {
    const result = await api(`/api/marketing/campaigns?page=${state.page}&pageSize=25&search=${encodeURIComponent(state.search)}`);
    root().innerHTML = `${pageHeader('Comunicação por WhatsApp', 'Campanhas com consentimento, grupos, agendamento e fila persistente.', `<button class="button primary" data-new>${icon('plus')}Nova campanha</button>`)}
      ${tabs}<div class="integration-state ${status.dispatchEnabled ? 'enabled' : 'disabled'}"><strong>${status.dispatchEnabled ? 'Envio habilitado' : 'Modo seguro: envio real desabilitado'}</strong><span>${status.configured ? `Provedor: ${escapeHtml(status.provider)}${status.instancia ? ` · instância ${escapeHtml(status.instancia)}` : ''}.` : 'Nenhum provedor de WhatsApp configurado — escolha em Configurações.'}</span>${status.configured ? `<button class="button ghost small" data-test-whatsapp>${icon('megaphone')}Enviar teste</button>` : ''}</div>
      <section class="panel"><form class="toolbar" data-filter><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar campanha"><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([
        { key: 'data', label: 'Criação', render: date }, { key: 'titulo', label: 'Campanha' }, { key: 'data_envio', label: 'Agendada', render: date },
        { key: 'total_disparos', label: 'Público', render: number }, { key: 'envios', label: 'Enviadas', render: number },
        { key: 'pendentes', label: 'Pendentes', render: number }, { key: 'falhas', label: 'Falhas', render: number }
      ], result.items, (item) => `${editButton(item.id)}${attachmentButton('campaigns', item.id)}<button class="button ghost small" data-action="queue" data-id="${item.id}">${icon('calendar')}Agendar</button><button class="button ghost small" data-action="log" data-id="${item.id}">${icon('list')}Fila</button><button class="button danger small" data-action="delete" data-id="${item.id}">${icon('trash')}Excluir</button>`)}${pagination(result.pagination)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    // Envio de teste para o telefone do próprio usuário, para validar o provedor escolhido.
    root().querySelector('[data-test-whatsapp]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const sent = await api('/api/marketing/test-message', { method: 'POST', body: {} });
        toast(`Mensagem de teste enviada para ${sent.phone}.`);
      } catch (error) {
        toast(error.message, 'error');
      } finally { button.disabled = false; }
    });
    const campaignForm = (record = {}) => openForm({
      title: record.id ? 'Editar campanha' : 'Nova campanha', eyebrow: 'WhatsApp', record,
      fields: [
        { name: 'titulo', label: 'Título', required: true, max: 100 },
        { name: 'forma_envio', label: 'Público padrão', type: 'select', options: ['Clientes', 'Grupo', 'Selecionados', 'Todos'].map((value) => ({ value, label: value })) },
        { name: 'mensagem', label: 'Mensagem', type: 'textarea', required: true, full: true, max: 5000 },
        { name: 'mensagem2', label: 'Mensagem complementar', type: 'textarea', optional: true, full: true, max: 5000 }
      ],
      onSubmit: async (values) => {
        await api(`/api/marketing/campaigns${record.id ? `/${record.id}` : ''}`, { method: record.id ? 'PATCH' : 'POST', body: values });
        toast('Campanha salva.'); await load();
      }
    });
    const queueCampaign = async (campaign) => {
      const groups = await allItems('/api/marketing/groups', 'Sim');
      openForm({
        title: `Agendar: ${campaign.titulo}`, eyebrow: 'Fila de envio',
        record: { scheduledAt: `${today()}T09:00`, groupId: 0 },
        fields: [
          { name: 'scheduledAt', label: 'Data e horário', type: 'datetime-local', required: true },
          { name: 'groupId', label: 'Grupo opcional', type: 'select', numeric: true, options: [{ value: 0, label: 'Todos os clientes com consentimento' }, ...groups.map((group) => ({ value: group.id, label: group.nome }))] }
        ],
        submitLabel: 'Adicionar à fila',
        onSubmit: async (values) => {
          const body = { scheduledAt: values.scheduledAt, confirmConsent: true };
          if (values.groupId) body.groupIds = [values.groupId];
          const queued = await api(`/api/marketing/campaigns/${campaign.id}/queue`, { method: 'POST', body });
          toast(`${queued.queued} destinatário(s) adicionados à fila.`);
          await load();
        }
      });
    };
    const showLog = async (campaign) => {
      const log = await api(`/api/marketing/campaigns/${campaign.id}/dispatches?page=1&pageSize=100`);
      const dialog = document.querySelector('#app-modal');
      const form = document.querySelector('#modal-form');
      document.querySelector('#modal-title').textContent = `Fila: ${campaign.titulo}`;
      document.querySelector('#modal-eyebrow').textContent = `${log.pagination.total} registro(s)`;
      document.querySelector('#modal-body').innerHTML = table([
        { key: 'nome', label: 'Cliente' }, { key: 'telefone', label: 'Telefone' },
        { key: 'agendado_para', label: 'Agendamento', render: text }, { key: 'status', label: 'Situação', render: badge },
        { key: 'tentativas', label: 'Tentativas', render: number }, { key: 'erro', label: 'Erro', render: text }
      ], log.items);
      document.querySelector('#modal-submit').hidden = true;
      const close = () => { document.querySelector('#modal-submit').hidden = false; dialog.removeEventListener('close', close); };
      dialog.addEventListener('close', close); form._submitHandler = null; dialog.showModal();
    };
    root().querySelector('[data-new]').addEventListener('click', () => campaignForm({ forma_envio: 'Clientes' }));
    root().querySelector('[data-filter]').addEventListener('submit', (event) => { event.preventDefault(); state.search = new FormData(event.currentTarget).get('search'); state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const campaign = byId.get(button.dataset.id);
      if (button.dataset.action === 'attachments') return openAttachments({ entity: 'campaigns', id: Number(button.dataset.attachmentId), title: `campanha #${button.dataset.attachmentId}` });
      if (button.dataset.action === 'edit') return campaignForm(await api(`/api/marketing/campaigns/${campaign.id}`));
      if (button.dataset.action === 'queue') return queueCampaign(campaign);
      if (button.dataset.action === 'log') return showLog(campaign);
      await confirmAction('Excluir esta campanha e cancelar seus envios pendentes?', async () => { await api(`/api/marketing/campaigns/${campaign.id}`, { method: 'DELETE', body: { reason: 'Exclusão pela interface' } }); toast('Campanha excluída.'); await load(); });
    }));
  };
  await load();
}

async function renderMarketingGroups(tabs, status) {
  const result = await api('/api/marketing/groups?page=1&pageSize=100');
  root().innerHTML = `${pageHeader('Grupos de disparos', 'Listas reutilizáveis de clientes para campanhas segmentadas.', `<button class="button primary" data-new>${icon('plus')}Novo grupo</button>`)}
    ${tabs}<section class="panel">${table([
      { key: 'nome', label: 'Grupo' }, { key: 'clientes', label: 'Clientes', render: number }, { key: 'ativo', label: 'Situação', render: badge }
    ], result.items, (item) => `${editButton(item.id)}<button class="button ghost small" data-action="members" data-id="${item.id}">${icon('clients')}Clientes</button>`)} </section>`;
  const byId = new Map(result.items.map((item) => [String(item.id), item]));
  const save = (record = {}) => openForm({
    title: record.id ? 'Editar grupo' : 'Novo grupo', eyebrow: 'WhatsApp', record,
    fields: [{ name: 'nome', label: 'Nome', required: true, max: 100 }, { name: 'ativo', label: 'Situação', type: 'select', options: yesNo() }],
    onSubmit: async (values) => { await api(`/api/marketing/groups${record.id ? `/${record.id}` : ''}`, { method: record.id ? 'PATCH' : 'POST', body: values }); toast('Grupo salvo.'); location.reload(); }
  });
  const members = async (group) => {
    const [clients, selected] = await Promise.all([allItems('/api/clients', 'Sim'), api(`/api/marketing/groups/${group.id}/clients`)]);
    const selectedIds = new Set(selected.items.map((item) => Number(item.id)));
    const dialog = document.querySelector('#app-modal');
    const form = document.querySelector('#modal-form');
    document.querySelector('#modal-title').textContent = `Clientes de ${group.nome}`;
    document.querySelector('#modal-eyebrow').textContent = 'Grupo de disparo';
    document.querySelector('#modal-body').innerHTML = `<div class="check-list">${clients.map((client) => `<label><input type="checkbox" name="clientIds" value="${client.id}" ${selectedIds.has(Number(client.id)) ? 'checked' : ''}> <span>${escapeHtml(client.nome)}<small>${escapeHtml(client.telefone || 'Sem telefone')} · marketing ${escapeHtml(client.marketing || 'Não informado')}</small></span></label>`).join('')}</div>`;
    document.querySelector('#modal-submit-label').textContent = 'Salvar clientes';
    const handler = async (event) => {
      event.preventDefault();
      const ids = new FormData(form).getAll('clientIds').map(Number);
      try { await api(`/api/marketing/groups/${group.id}/clients`, { method: 'PUT', body: { clientIds: ids } }); dialog.close(); toast('Clientes do grupo atualizados.'); location.reload(); }
      catch (error) { document.querySelector('#modal-error').textContent = error.message; }
    };
    if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
    form._submitHandler = handler; form.addEventListener('submit', handler); dialog.showModal();
  };
  root().querySelector('[data-new]').addEventListener('click', () => save({ ativo: 'Sim' }));
  root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => button.dataset.action === 'edit' ? save(byId.get(button.dataset.id)) : members(byId.get(button.dataset.id))));
}

async function renderMarketingDevices(tabs, status) {
  const result = await api('/api/marketing/devices?page=1&pageSize=100');
  root().innerHTML = `${pageHeader('Dispositivos do WhatsApp', 'Consulta segura das instâncias vinculadas; chaves e tokens nunca são exibidos.')}
    ${tabs}<div class="integration-state ${status.configured ? 'enabled' : 'disabled'}"><strong>${status.configured ? 'Provedor configurado' : 'Provedor não configurado'}</strong><span>${status.dispatchEnabled ? 'Disparos habilitados.' : 'Disparos reais permanecem desabilitados.'}</span></div>
    <section class="panel">${table([
      { key: 'telefone', label: 'Telefone', render: text }, { key: 'status', label: 'Cadastro', render: badge },
      { key: 'status_api', label: 'Conexão', render: badge }, { key: 'horario', label: 'Atualização', render: text }
    ], result.items)}</section>`;
}

async function renderCash() {
  loading();
  const load = async () => {
    const result = await api('/api/operations/cash?page=1&pageSize=100');
    root().innerHTML = `${pageHeader('Caixas', 'Abertura, saldo esperado, retiradas e fechamento por operador.', `<button class="button primary" data-new>${icon('plus')}Abrir caixa</button>`)}
      <section class="panel">${table([
        { key: 'data_abertura', label: 'Abertura', render: date }, { key: 'operador_nome', label: 'Operador', render: text },
        { key: 'valor_abertura', label: 'Valor inicial', render: money }, { key: 'valor_fechamento', label: 'Valor final', render: money },
        { key: 'quebra', label: 'Diferença', render: money }, { key: 'status', label: 'Situação', render: badge }
      ], result.items, (item) => `<button class="button ghost small" data-action="details" data-id="${item.id}">${icon('list')}Detalhes</button>${item.status === 'Aberto' ? `<button class="button ghost small" data-action="withdraw" data-id="${item.id}">${icon('wallet')}Retirada</button><button class="button primary small" data-action="close" data-id="${item.id}">${icon('check')}Fechar</button>` : ''}`)}</section>`;
    const users = await allItems('/api/users', 'Sim');
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    root().querySelector('[data-new]').addEventListener('click', () => openForm({
      title: 'Abrir caixa', eyebrow: 'Financeiro',
      fields: [
        { name: 'operatorId', label: 'Operador', type: 'select', numeric: true, required: true, options: users.map((user) => ({ value: user.id, label: user.nome })) },
        { name: 'openingValue', label: 'Valor inicial', type: 'number', step: '.01', min: 0, numeric: true, required: true },
        { name: 'notes', label: 'Observações', type: 'textarea', optional: true, full: true, max: 255 }
      ],
      onSubmit: async (values) => { await api('/api/operations/cash', { method: 'POST', body: values }); toast('Caixa aberto.'); await load(); }
    }));
    const showDetails = async (cash) => {
      const detail = await api(`/api/operations/cash/${cash.id}`);
      const dialog = document.querySelector('#app-modal');
      document.querySelector('#modal-title').textContent = `Caixa #${cash.id}`;
      document.querySelector('#modal-eyebrow').textContent = detail.operador_nome || 'Operador';
      document.querySelector('#modal-body').innerHTML = `<div class="detail-list"><div><small>Valor inicial</small><strong>${money(detail.valor_abertura)}</strong></div><div><small>Recebimentos</small><strong>${money(detail.balance.recebimentos)}</strong></div><div><small>Pagamentos</small><strong>${money(detail.balance.pagamentos)}</strong></div><div><small>Retiradas</small><strong>${money(detail.balance.retiradas)}</strong></div><div><small>Saldo esperado</small><strong>${money(detail.balance.saldo_esperado)}</strong></div><div><small>Fechamento</small><strong>${text(detail.valor_fechamento)}</strong></div></div>`;
      document.querySelector('#modal-submit').hidden = true;
      const reset = () => { document.querySelector('#modal-submit').hidden = false; dialog.removeEventListener('close', reset); };
      dialog.addEventListener('close', reset); dialog.showModal();
    };
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const cash = byId.get(button.dataset.id);
      if (button.dataset.action === 'details') return showDetails(cash);
      if (button.dataset.action === 'withdraw') return openForm({
        title: `Retirada do caixa #${cash.id}`, eyebrow: 'Sangria',
        fields: [{ name: 'value', label: 'Valor', type: 'number', step: '.01', min: .01, numeric: true, required: true }, { name: 'reason', label: 'Motivo', required: true, max: 255, full: true }],
        onSubmit: async (values) => { await api(`/api/operations/cash/${cash.id}/withdrawals`, { method: 'POST', body: values }); toast('Retirada registrada.'); await load(); }
      });
      if (button.dataset.action === 'close') return openForm({
        title: `Fechar caixa #${cash.id}`, eyebrow: 'Conferência',
        fields: [{ name: 'closingValue', label: 'Valor contado', type: 'number', step: '.01', min: 0, numeric: true, required: true }, { name: 'notes', label: 'Observações', optional: true, full: true, max: 255 }],
        onSubmit: async (values) => { const closed = await api(`/api/operations/cash/${cash.id}/close`, { method: 'POST', body: values }); toast(`Caixa fechado. Diferença: ${money(closed.difference)}`); await load(); }
      });
    }));
  };
  await load();
}

async function renderRecurring() {
  loading();
  const load = async () => {
    const result = await api('/api/operations/recurring?page=1&pageSize=100');
    root().innerHTML = `${pageHeader('Cobranças recorrentes', 'Contratos financeiros que geram contas a receber por frequência.', `<button class="button primary" data-new>${icon('plus')}Nova cobrança</button>`)}
      <section class="panel">${table([
        { key: 'cliente_nome', label: 'Cliente' }, { key: 'descricao', label: 'Descrição' }, { key: 'valor', label: 'Valor', render: money },
        { key: 'data_venc', label: 'Próximo vencimento', render: date }, { key: 'frequencia_nome', label: 'Frequência', render: text },
        { key: 'node_status', label: 'Situação', render: badge }
      ], result.items, (item) => `${editButton(item.id)}${item.node_status === 'ativo' ? `<button class="button ghost small" data-action="generate" data-id="${item.id}">${icon('plus')}Gerar parcela</button><button class="button danger small" data-action="delete" data-id="${item.id}">${icon('power')}Cancelar</button>` : ''}`)}</section>`;
    const [clients, frequencies] = await Promise.all([allItems('/api/clients', 'Sim'), allItems('/api/reference/frequencies')]);
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    const show = (record = {}) => openForm({
      title: record.id ? 'Editar cobrança recorrente' : 'Nova cobrança recorrente', eyebrow: 'Financeiro', record: {
        ...record, clientId: record.cliente, value: record.valor, dueDate: String(record.data_venc || '').slice(0, 10),
        frequencyId: Number(record.frequencia), installments: record.parcelas, description: record.descricao,
        notes: record.obs, interest: record.juros, fine: record.multa
      },
      fields: [
        { name: 'clientId', label: 'Cliente', type: 'select', numeric: true, required: true, options: clients.map((client) => ({ value: client.id, label: client.nome })) },
        { name: 'description', label: 'Descrição', required: true, max: 50 }, { name: 'value', label: 'Valor', type: 'number', step: '.01', min: .01, numeric: true, required: true },
        { name: 'dueDate', label: 'Primeiro vencimento', type: 'date', required: true }, { name: 'frequencyId', label: 'Frequência', type: 'select', numeric: true, required: true, options: frequencies.map((item) => ({ value: item.id, label: `${item.frequencia} · ${item.dias} dias` })) },
        { name: 'installments', label: 'Parcelas (0 = contínua)', type: 'number', min: 0, numeric: true, optional: true },
        { name: 'interest', label: 'Juros', type: 'number', step: '.01', min: 0, numeric: true, optional: true }, { name: 'fine', label: 'Multa', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
        { name: 'notes', label: 'Observações', type: 'textarea', optional: true, full: true, max: 255 }
      ],
      onSubmit: async (values) => { await api(`/api/operations/recurring${record.id ? `/${record.id}` : ''}`, { method: record.id ? 'PATCH' : 'POST', body: values }); toast('Cobrança salva.'); await load(); }
    });
    root().querySelector('[data-new]').addEventListener('click', () => show({ dueDate: today(), installments: 0, interest: 0, fine: 0 }));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const record = byId.get(button.dataset.id);
      if (button.dataset.action === 'edit') return show(record);
      if (button.dataset.action === 'generate') { const generated = await api(`/api/operations/recurring/${record.id}/generate`, { method: 'POST', body: {} }); toast(`Parcela gerada para ${date(generated.dueDate)}.`); return; }
      await confirmAction('Cancelar esta cobrança recorrente?', async () => { await api(`/api/operations/recurring/${record.id}`, { method: 'DELETE', body: { reason: 'Cancelamento pela interface' } }); toast('Cobrança cancelada.'); await load(); });
    }));
  };
  await load();
}

async function renderCommissions() {
  loading();
  const load = async () => {
    const result = await api('/api/operations/commissions?page=1&pageSize=100');
    const total = result.items.reduce((sum, item) => sum + Number(item.comissao || 0), 0);
    const pendente = result.items.filter((item) => item.comissao_paga !== 'Sim').reduce((sum, item) => sum + Number(item.comissao || 0), 0);
    root().innerHTML = `${pageHeader('Comissões', 'Comissões calculadas por item vendido e percentual do funcionário.')}
      <div class="metric-grid compact-metrics"><div class="metric-card"><span>Total exibido</span><strong>${money(total)}</strong><small>${result.pagination.total} item(ns)</small></div><div class="metric-card warn"><span>Comissão a pagar</span><strong>${money(pendente)}</strong><small>Itens não pagos</small></div></div>
      <section class="panel">${table([
        { key: 'data', label: 'Data', render: date }, { key: 'id_venda', label: 'Venda' }, { key: 'funcionario_nome', label: 'Funcionário' },
        { key: 'total', label: 'Base', render: money }, { key: 'percentual', label: 'Percentual', render: (value) => `${number(value)}%` },
        { key: 'comissao', label: 'Comissão', render: money }, { key: 'pago', label: 'Venda paga', render: badge },
        { key: 'comissao_paga', label: 'Comissão paga', render: badge }
      ], result.items, (item) => item.comissao_paga === 'Sim'
        ? `<button class="button ghost small" data-pay="${item.id}" data-set="Não">${icon('refresh')}Estornar</button>`
        : `<button class="button primary small" data-pay="${item.id}" data-set="Sim">${icon('check')}Marcar paga</button>`)}</section>`;
    root().querySelectorAll('[data-pay]').forEach((button) => button.addEventListener('click', async () => {
      await api(`/api/operations/commissions/${button.dataset.pay}/pay`, { method: 'PATCH', body: { pago: button.dataset.set } });
      toast(button.dataset.set === 'Sim' ? 'Comissão marcada como paga.' : 'Pagamento de comissão estornado.');
      await load();
    }));
  };
  await load();
}

async function renderOnlineOrders() {
  loading();
  const load = async () => {
    const result = await api('/api/store/orders?page=1&pageSize=100');
    root().innerHTML = `${pageHeader('Pedidos online', 'Pedidos recebidos pela loja, integrados ao estoque e ao financeiro.', `<a class="button ghost" href="/store.html?company=${Number(session.user?.companyId || 0)}" target="_blank">${icon('cart')}Abrir loja</a>`)}
      <section class="panel">${table([
        { key: 'criado_em', label: 'Data', render: text }, { key: 'id', label: 'Pedido' }, { key: 'cliente_nome', label: 'Cliente' },
        { key: 'total', label: 'Total', render: money }, { key: 'pago', label: 'Pago', render: badge }, { key: 'status', label: 'Situação', render: badge }
      ], result.items, (item) => `<button class="button ghost small" data-action="details" data-id="${item.id}">${icon('list')}Detalhes</button>${!['Concluído', 'Cancelado'].includes(item.status) ? `<button class="button ghost small" data-action="advance" data-id="${item.id}">${icon('check')}Avançar</button><button class="button danger small" data-action="cancel" data-id="${item.id}">${icon('close')}Cancelar</button>` : ''}`)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    const show = async (id) => {
      const order = await api(`/api/store/orders/${id}`);
      const dialog = document.querySelector('#app-modal');
      const form = document.querySelector('#modal-form');
      if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
      form._submitHandler = null;
      document.querySelector('#modal-title').textContent = `Pedido online #${order.id}`;
      document.querySelector('#modal-eyebrow').textContent = `${order.cliente_nome} · ${order.status}`;
      document.querySelector('#modal-body').innerHTML = `<div class="detail-list"><div><small>Contato</small><strong>${escapeHtml(order.cliente_email || order.cliente_telefone || 'Não informado')}</strong></div><div><small>Pagamento</small><strong>${escapeHtml(order.pago || 'Não')}</strong></div><div><small>Total</small><strong>${money(order.total)}</strong></div></div>${table([
        { key: 'tipo', label: 'Tipo' }, { key: 'nome', label: 'Item' }, { key: 'quantidade', label: 'Quantidade', render: number }, { key: 'valor_unitario', label: 'Unitário', render: money }, { key: 'total', label: 'Total', render: money }
      ], order.items)}`;
      document.querySelector('#modal-submit').hidden = true;
      const reset = () => { document.querySelector('#modal-submit').hidden = false; dialog.removeEventListener('close', reset); };
      dialog.addEventListener('close', reset); dialog.showModal();
    };
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const order = byId.get(button.dataset.id);
      if (button.dataset.action === 'details') return show(order.id);
      if (button.dataset.action === 'cancel') {
        const reason = prompt('Informe o motivo do cancelamento:');
        if (!reason) return;
        await api(`/api/store/orders/${order.id}`, { method: 'DELETE', body: { reason } });
        toast('Pedido cancelado, estoque e financeiro restaurados.'); return load();
      }
      const next = order.status === 'Pago' ? 'Em preparação' : order.status === 'Em preparação' ? 'Concluído' : order.pago === 'Sim' ? 'Pago' : null;
      if (!next) return toast('Baixe o recebível no financeiro antes de avançar.', 'error');
      await api(`/api/store/orders/${order.id}/status`, { method: 'PATCH', body: { status: next } });
      toast(`Pedido atualizado para ${next}.`); await load();
    }));
  };
  await load();
}

async function renderPurchases() {
  loading();
  const load = async () => {
    const result = await api('/api/operations/purchases?page=1&pageSize=100');
    root().innerHTML = `${pageHeader('Compras', 'Entrada de mercadorias integrada ao estoque e contas a pagar.', `<button class="button primary" data-new>${icon('plus')}Nova compra</button>`)}
      <section class="panel">${table([
        { key: 'data', label: 'Data', render: date }, { key: 'fornecedor_nome', label: 'Fornecedor' }, { key: 'total', label: 'Total', render: money },
        { key: 'vencimento', label: 'Vencimento', render: date }, { key: 'forma_pgto_nome', label: 'Forma', render: text },
        { key: 'pago', label: 'Pagamento', render: badge }, { key: 'status', label: 'Situação', render: badge }
      ], result.items, (item) => `<button class="button ghost small" data-action="details" data-id="${item.id}">${icon('list')}Itens</button>${attachmentButton('purchases', item.id)}${item.status === 'ativo' ? `<button class="button danger small" data-action="cancel" data-id="${item.id}">${icon('close')}Cancelar</button>` : ''}`)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    root().querySelector('[data-new]').addEventListener('click', openPurchaseForm);
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const purchase = byId.get(button.dataset.id);
      if (button.dataset.action === 'attachments') return openAttachments({ entity: 'purchases', id: Number(button.dataset.attachmentId), title: `compra #${button.dataset.attachmentId}` });
      if (button.dataset.action === 'details') return showPurchase(purchase.id);
      const reason = window.prompt('Informe o motivo do cancelamento:');
      if (!reason) return;
      await api(`/api/operations/purchases/${purchase.id}`, { method: 'DELETE', body: { reason } });
      toast('Compra cancelada e estoque estornado.'); await load();
    }));
  };
  const openPurchaseForm = async () => {
    const [suppliers, products, paymentMethods] = await Promise.all([
      allItems('/api/catalog/suppliers', 'Sim'), allItems('/api/catalog/products', 'Sim'), allItems('/api/reference/payment-methods')
    ]);
    if (!suppliers.length || !products.length) return toast('Cadastre ao menos um fornecedor e um produto ativo.', 'error');
    const dialog = document.querySelector('#app-modal');
    const form = document.querySelector('#modal-form');
    const lines = [{ productId: products[0].id, quantity: 1, unitCost: Number(products[0].valor_compra || 0) }];
    const drawLines = () => {
      document.querySelector('#purchase-lines').innerHTML = lines.map((line, index) => `<div class="line-item" data-line="${index}">
        <label class="field">Produto<select data-product>${products.map((product) => `<option value="${product.id}" ${Number(product.id) === Number(line.productId) ? 'selected' : ''}>${escapeHtml(product.nome)} · estoque ${number(product.estoque)}</option>`).join('')}</select></label>
        <label class="field quantity">Quantidade<input data-quantity type="number" min="1" step="1" value="${line.quantity}" required></label>
        <label class="field quantity">Custo unitário<input data-cost type="number" min=".01" step=".01" value="${line.unitCost}" required></label>
        <button class="button danger small" type="button" data-remove="${index}">${icon('trash')}Remover</button>
      </div>`).join('');
      document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { if (lines.length > 1) { lines.splice(Number(button.dataset.remove), 1); drawLines(); } }));
    };
    document.querySelector('#modal-title').textContent = 'Nova compra';
    document.querySelector('#modal-eyebrow').textContent = 'Compras e estoque';
    document.querySelector('#modal-submit-label').textContent = 'Concluir compra';
    document.querySelector('#modal-body').innerHTML = `<div class="modal-grid">
      <label class="field full">Fornecedor<select name="supplierId" required>${suppliers.map((supplier) => `<option value="${supplier.id}">${escapeHtml(supplier.nome)}</option>`).join('')}</select></label>
      <label class="field">Vencimento<input name="dueDate" type="date" value="${today()}" required></label>
      <label class="field">Já paga<select name="paid"><option value="Não">Não</option><option value="Sim">Sim</option></select></label>
      <label class="field full">Forma de pagamento<select name="paymentMethodId"><option value="0">Não informada</option>${paymentMethods.map((method) => `<option value="${method.id}">${escapeHtml(method.nome)}</option>`).join('')}</select></label>
      <label class="field full">Observações<textarea name="notes" maxlength="500"></textarea></label>
      </div><div class="line-items-header"><strong>Produtos</strong><button type="button" class="button ghost small" data-add-line>${icon('plus')}Adicionar item</button></div><div id="purchase-lines"></div>`;
    drawLines();
    document.querySelector('[data-add-line]').addEventListener('click', () => { lines.push({ productId: products[0].id, quantity: 1, unitCost: Number(products[0].valor_compra || 0) }); drawLines(); });
    const handler = async (event) => {
      event.preventDefault();
      try {
        const values = Object.fromEntries(new FormData(form));
        const itemRows = [...document.querySelectorAll('[data-line]')].map((row) => ({
          productId: Number(row.querySelector('[data-product]').value),
          quantity: Number(row.querySelector('[data-quantity]').value),
          unitCost: Number(row.querySelector('[data-cost]').value)
        }));
        await api('/api/operations/purchases', {
          method: 'POST',
          body: { supplierId: Number(values.supplierId), dueDate: values.dueDate, paid: values.paid, paymentMethodId: Number(values.paymentMethodId), notes: values.notes, items: itemRows }
        });
        dialog.close(); toast('Compra registrada com estoque e financeiro.'); await load();
      } catch (error) { document.querySelector('#modal-error').textContent = error.message; }
    };
    if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
    form._submitHandler = handler; form.addEventListener('submit', handler); dialog.showModal();
  };
  const showPurchase = async (purchaseId) => {
    const purchase = await api(`/api/operations/purchases/${purchaseId}`);
    const dialog = document.querySelector('#app-modal');
    const form = document.querySelector('#modal-form');
    if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
    form._submitHandler = null;
    document.querySelector('#modal-title').textContent = `Compra #${purchase.id}`;
    document.querySelector('#modal-eyebrow').textContent = purchase.fornecedor_nome;
    document.querySelector('#modal-body').innerHTML = `<div class="detail-list"><div><small>Total</small><strong>${money(purchase.total)}</strong></div><div><small>Vencimento</small><strong>${date(purchase.vencimento)}</strong></div><div><small>Situação</small><strong>${escapeHtml(purchase.status)}</strong></div></div>${table([
      { key: 'codigo', label: 'Código' }, { key: 'produto_nome', label: 'Produto' }, { key: 'quantidade', label: 'Quantidade', render: number },
      { key: 'valor_unitario', label: 'Custo', render: money }, { key: 'total', label: 'Total', render: money }
    ], purchase.items)}`;
    document.querySelector('#modal-submit').hidden = true;
    const reset = () => { document.querySelector('#modal-submit').hidden = false; dialog.removeEventListener('close', reset); };
    dialog.addEventListener('close', reset); dialog.showModal();
  };
  await load();
}

async function renderContracts() {
  loading();
  const load = async () => {
    const result = await api('/api/operations/contracts?page=1&pageSize=100');
    root().innerHTML = `${pageHeader('Contratos', 'Geração de contratos a partir de modelos com dados do cliente.', `<button class="button primary" data-new>${icon('plus')}Novo contrato</button>`)}
      <section class="panel">${table([
        { key: 'criado_em', label: 'Criação', render: text }, { key: 'titulo', label: 'Contrato' }, { key: 'cliente_nome', label: 'Cliente' },
        { key: 'modelo_nome', label: 'Modelo', render: text }, { key: 'inicio', label: 'Início', render: date },
        { key: 'valor', label: 'Valor', render: money }, { key: 'status', label: 'Situação', render: badge }
      ], result.items, (item) => `${editButton(item.id)}${attachmentButton('contracts', item.id)}<button class="button ghost small" data-action="view" data-id="${item.id}">${icon('clipboard')}Visualizar</button>`)}</section>`;
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    const [clients, templates] = await Promise.all([allItems('/api/clients', 'Sim'), allItems('/api/reference/contract-templates')]);
    const showForm = async (summary = {}) => {
      const record = summary.id ? await api(`/api/operations/contracts/${summary.id}`) : {};
      openForm({
        title: record.id ? 'Editar contrato' : 'Novo contrato', eyebrow: 'Contratos',
        record: {
          ...record, clientId: record.cliente, templateId: record.modelo_id || 0, title: record.titulo,
          content: record.conteudo, startDate: String(record.inicio || '').slice(0, 10),
          endDate: String(record.fim || '').slice(0, 10), value: record.valor
        },
        fields: [
          { name: 'clientId', label: 'Cliente', type: 'select', numeric: true, required: true, options: clients.map((client) => ({ value: client.id, label: client.nome })) },
          { name: 'templateId', label: 'Modelo', type: 'select', numeric: true, optional: true, options: [{ value: 0, label: 'Sem modelo' }, ...templates.map((template) => ({ value: template.id, label: template.modelo }))] },
          { name: 'title', label: 'Título', required: true, max: 150 },
          { name: 'status', label: 'Situação', type: 'select', options: ['Rascunho', 'Ativo', 'Encerrado', 'Cancelado'].map((value) => ({ value, label: value })) },
          { name: 'startDate', label: 'Início', type: 'date', optional: true }, { name: 'endDate', label: 'Fim', type: 'date', optional: true },
          { name: 'value', label: 'Valor', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
          { name: 'content', label: 'Conteúdo (opcional ao usar um modelo)', type: 'textarea', optional: true, full: true, max: 100000 }
        ],
        onSubmit: async (values) => {
          if (!values.templateId) delete values.templateId;
          await api(`/api/operations/contracts${record.id ? `/${record.id}` : ''}`, { method: record.id ? 'PATCH' : 'POST', body: values });
          toast('Contrato salvo.'); await load();
        }
      });
    };
    const view = async (summary) => {
      const contract = await api(`/api/operations/contracts/${summary.id}`);
      const dialog = document.querySelector('#app-modal');
      const form = document.querySelector('#modal-form');
      if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
      form._submitHandler = null;
      document.querySelector('#modal-title').textContent = contract.titulo;
      document.querySelector('#modal-eyebrow').textContent = `${contract.cliente_nome} · ${contract.status}`;
      document.querySelector('#modal-body').innerHTML = `<article class="contract-preview">${escapeHtml(contract.conteudo).replace(/\n/g, '<br>')}</article>`;
      document.querySelector('#modal-submit').hidden = true;
      const reset = () => { document.querySelector('#modal-submit').hidden = false; dialog.removeEventListener('close', reset); };
      dialog.addEventListener('close', reset); dialog.showModal();
    };
    root().querySelector('[data-new]').addEventListener('click', () => showForm({ status: 'Rascunho' }));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.action === 'attachments') return openAttachments({ entity: 'contracts', id: Number(button.dataset.attachmentId), title: `contrato #${button.dataset.attachmentId}` });
      return button.dataset.action === 'edit' ? showForm(byId.get(button.dataset.id)) : view(byId.get(button.dataset.id));
    }));
  };
  await load();
}

async function renderHr(route) {
  loading();
  const tab = route.query.tab === 'payroll' ? 'payroll' : 'attendance';
  const tabs = `<div class="split-tabs"><a class="${tab === 'attendance' ? 'active' : ''}" href="#/hr?tab=attendance">Ponto</a><a class="${tab === 'payroll' ? 'active' : ''}" href="#/hr?tab=payroll">Folha estimada</a></div>`;
  if (tab === 'payroll') {
    const users = await allItems('/api/users', 'Sim');
    const loadPayroll = async () => {
      const payroll = await api('/api/hr/payroll');
      const competencia = payroll.from.slice(0, 7);
      root().innerHTML = `${pageHeader('RH e folha', `Estimativa de ${date(payroll.from)} a ${date(payroll.to)}. Proventos e descontos são lançados manualmente; encargos legais (INSS, FGTS, IRRF) não são calculados e dependem de validação contábil.`, `<button class="button primary" data-new-entry>${icon('plus')}Lançar na folha</button>`)}${tabs}
        <section class="panel">${table([
          { key: 'nome', label: 'Funcionário' }, { key: 'salario', label: 'Salário', render: money },
          { key: 'horas_extras', label: 'Horas extras', render: text }, { key: 'faltas', label: 'Faltas', render: number },
          { key: 'proventos', label: 'Proventos', render: money }, { key: 'descontos', label: 'Descontos', render: money },
          { key: 'total_estimado', label: 'Total estimado', render: money }
        ], payroll.items, (item) => `<button class="button ghost small" data-entries="${item.id}">${icon('list')}Lançamentos</button>`)}</section>`;
      root().querySelector('[data-new-entry]').addEventListener('click', () => openForm({
        title: 'Lançamento na folha', eyebrow: `Competência ${competencia}`, submitLabel: 'Adicionar',
        record: { tipo: 'provento' },
        fields: [
          { name: 'employeeId', label: 'Funcionário', type: 'select', numeric: true, required: true, options: users.map((u) => ({ value: u.id, label: u.nome })) },
          { name: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'provento', label: 'Provento (soma ao total)' }, { value: 'desconto', label: 'Desconto (subtrai do total)' }] },
          { name: 'descricao', label: 'Descrição', required: true, max: 120, full: true },
          { name: 'valor', label: 'Valor', type: 'number', step: '.01', min: 0, numeric: true, required: true }
        ],
        onSubmit: async (values) => { await api('/api/hr/payroll/entries', { method: 'POST', body: { ...values, competencia } }); toast('Lançamento adicionado.'); await loadPayroll(); }
      }));
      root().querySelectorAll('[data-entries]').forEach((button) => button.addEventListener('click', () => openPayrollEntries(button.dataset.entries, competencia, loadPayroll)));
    };
    await loadPayroll();
    return;
  }
  const load = async () => {
    const result = await api('/api/hr/attendance?page=1&pageSize=100');
    root().innerHTML = `${pageHeader('Controle de ponto', 'Jornada, intervalos, horas extras, folgas, feriados e faltas.', `<button class="button primary" data-new>${icon('plus')}Lançar ponto</button>`)}${tabs}
      <section class="panel">${table([
        { key: 'data', label: 'Data', render: date }, { key: 'employeeName', label: 'Funcionário' }, { key: 'clockIn', label: 'Entrada', render: text },
        { key: 'clockOut', label: 'Saída', render: text }, { key: 'totalHours', label: 'Total', render: text },
        { key: 'overtime', label: 'Extra', render: text }, { key: 'absent', label: 'Falta', render: badge }
      ], result.items, (item) => `${editButton(item.id)}<button class="button danger small" data-action="delete" data-id="${item.id}">${icon('trash')}Excluir</button>`)}</section>`;
    const users = await allItems('/api/users', 'Sim');
    const byId = new Map(result.items.map((item) => [String(item.id), item]));
    const show = (record = {}) => openForm({
      title: record.id ? 'Editar ponto' : 'Lançar ponto', eyebrow: 'Recursos humanos',
      record: {
        ...record, employeeId: record.employeeId, date: String(record.data || record.date || today()).slice(0, 10),
        clockIn: record.clockIn, lunchStart: record.lunchStart, lunchEnd: record.lunchEnd, clockOut: record.clockOut,
        dayOff: record.dayOff || 'Não', holiday: record.holiday || 'Não', absent: record.absent || 'Não'
      },
      fields: [
        { name: 'employeeId', label: 'Funcionário', type: 'select', numeric: true, required: true, options: users.map((user) => ({ value: user.id, label: user.nome })) },
        { name: 'date', label: 'Data', type: 'date', required: true },
        { name: 'clockIn', label: 'Entrada', type: 'time', optional: true }, { name: 'lunchStart', label: 'Saída para almoço', type: 'time', optional: true },
        { name: 'lunchEnd', label: 'Retorno do almoço', type: 'time', optional: true }, { name: 'clockOut', label: 'Saída', type: 'time', optional: true },
        { name: 'dayOff', label: 'Folga', type: 'select', options: yesNo() }, { name: 'holiday', label: 'Feriado', type: 'select', options: yesNo() },
        { name: 'absent', label: 'Falta', type: 'select', options: yesNo() }
      ],
      onSubmit: async (values) => { await api('/api/hr/attendance', { method: 'POST', body: values }); toast('Ponto salvo.'); await load(); }
    });
    root().querySelector('[data-new]').addEventListener('click', () => show({ date: today() }));
    root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const item = byId.get(button.dataset.id);
      if (button.dataset.action === 'edit') return show(item);
      await confirmAction('Excluir este lançamento de ponto?', async () => { await api(`/api/hr/attendance/${item.id}`, { method: 'DELETE', body: { reason: 'Exclusão pela interface' } }); toast('Lançamento excluído.'); await load(); });
    }));
  };
  await load();
}

async function openPayrollEntries(employeeId, competencia, onChange) {
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  const render = async () => {
    const { items } = await api(`/api/hr/payroll/entries?competencia=${competencia}&employeeId=${employeeId}`);
    document.querySelector('#modal-title').textContent = 'Lançamentos da folha';
    document.querySelector('#modal-eyebrow').textContent = `Competência ${competencia}`;
    document.querySelector('#modal-error').textContent = '';
    const submitLabel = document.querySelector('#modal-submit-label');
    if (submitLabel) submitLabel.textContent = 'Fechar';
    document.querySelector('#modal-body').innerHTML = items.length
      ? `<div class="detail-list">${items.map((entry) => `<div><small>${escapeHtml(entry.tipo)}</small><strong>${escapeHtml(entry.descricao)} · ${money(entry.valor)}</strong><button class="button danger small" type="button" data-del-entry="${entry.id}">${icon('trash')}Excluir</button></div>`).join('')}</div>`
      : '<p class="muted">Nenhum lançamento nesta competência.</p>';
    document.querySelector('#modal-body').querySelectorAll('[data-del-entry]').forEach((button) => button.addEventListener('click', async () => {
      await api(`/api/hr/payroll/entries/${button.dataset.delEntry}`, { method: 'DELETE' });
      toast('Lançamento removido.');
      await render();
      await onChange();
    }));
  };
  await render();
  const handler = (event) => { event.preventDefault(); dialog.close(); };
  if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
  form._submitHandler = handler;
  form.addEventListener('submit', handler);
  dialog.showModal();
}

// Precisa espelhar src/integrations/whatsapp.providers.js — o backend valida contra a mesma lista.
const whatsappProviderOptions = [
  { value: 'Não', label: 'Não enviar' },
  { value: 'menuia', label: 'Menuia' },
  { value: 'wm', label: 'WordMensagens' },
  { value: 'newtek', label: 'NewTek' }
];

// Precisa espelhar src/integrations/payment.providers.js — validado no backend contra a mesma lista.
const paymentProviderOptions = [
  { value: '', label: 'Nenhuma (cobrança manual)' },
  { value: 'Mercado Pago', label: 'Mercado Pago' },
  { value: 'Asaas', label: 'Asaas' }
];

// Organizado em seções, espelhando o modal "Alterar Configurações" do legado, para não ser
// uma lista plana de ~35 campos. Os cabeçalhos (type: 'section') são só visuais.
const companySettingsFields = [
  { type: 'section', label: 'Dados da empresa' },
  { name: 'nome', label: 'Nome da empresa', optional: true, max: 50 },
  { name: 'email', label: 'E-mail', type: 'email', optional: true, max: 50 },
  { name: 'telefone', label: 'Telefone', optional: true, max: 20 },
  { name: 'cnpj', label: 'CNPJ', optional: true, max: 25 },
  { name: 'endereco', label: 'Endereço', optional: true, full: true, max: 100 },
  { name: 'cidade_sistema', label: 'Cidade', optional: true, max: 50 },
  { name: 'instagram', label: 'Instagram', optional: true, max: 100 },

  { type: 'section', label: 'Recibos e operação' },
  { name: 'marca_dagua', label: 'Marca d’água', type: 'select', options: yesNo() },
  { name: 'assinatura_recibo', label: 'Assinatura em recibos', type: 'select', options: yesNo() },
  { name: 'impressao_automatica', label: 'Impressão automática', type: 'select', options: yesNo() },
  { name: 'abertura_caixa', label: 'Exigir abertura de caixa', type: 'select', options: yesNo() },
  { name: 'assinatura_cliente', label: 'Assinatura do cliente', type: 'select', options: yesNo() },

  { type: 'section', label: 'Financeiro e cobrança' },
  { name: 'multa_atraso', label: 'Multa por atraso (%)', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
  { name: 'juros_atraso', label: 'Juros por dia de atraso (%)', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
  { name: 'dias_comissao', label: 'Prazo das comissões (dias)', type: 'number', min: 0, numeric: true, optional: true },
  { name: 'dias_lembrete', label: 'Lembrete de vencimento (dias antes)', type: 'number', min: 0, numeric: true, optional: true },
  { name: 'cobrar_automaticamente', label: 'Cobrança automática', type: 'select', options: yesNo() },
  { name: 'cobrar_duas_vezes', label: 'Segunda tentativa de cobrança', type: 'select', options: yesNo() },

  { type: 'section', label: 'Integração de WhatsApp', hint: 'O token é gravado de forma protegida e não é reexibido após salvo.' },
  // Provedor de WhatsApp da empresa — mesmas opções do legado.
  { name: 'api_whatsapp', label: 'WhatsApp · Provedor', type: 'select', full: true, options: whatsappProviderOptions },
  { name: 'instancia_whatsapp', label: 'WhatsApp · Instância', optional: true, max: 70 },
  { name: 'token_whatsapp', label: 'WhatsApp · Token (deixe em branco para manter o atual)', optional: true, max: 255 },

  { type: 'section', label: 'Integração de pagamento', hint: 'As chaves são gravadas cifradas e nunca reexibidas; em branco mantêm a atual.' },
  // Pagamento por empresa — os segredos nunca voltam preenchidos; em branco mantém o atual.
  { name: 'api_pagamento', label: 'Pagamento · Provedor', type: 'select', full: true, options: paymentProviderOptions },
  { name: 'chave_api_asaas', label: 'Asaas · Chave da API (em branco mantém a atual)', optional: true, max: 255 },
  { name: 'access_token', label: 'Mercado Pago · Access Token (em branco mantém o atual)', optional: true, max: 255 },
  { name: 'public_key', label: 'Mercado Pago · Public Key', optional: true, max: 255 },
  { name: 'dados_pagamento', label: 'Dados para pagamento manual (usado quando não há provedor)', type: 'textarea', optional: true, full: true, max: 5000 },

  { type: 'section', label: 'Site e página de entrada' },
  { name: 'url_site', label: 'Endereço do site', optional: true, max: 255 },
  { name: 'meta_descricao', label: 'Descrição para buscadores', type: 'textarea', optional: true, full: true, max: 255 },
  // 'Login' é a primeira opção de propósito: é o default quando o valor está vazio, igual ao
  // fallback do backend (/api/public/entry). Se 'Site' fosse o primeiro, salvar as configurações
  // sem tocar neste campo trocaria a entrada para o site e esconderia a tela de login.
  { name: 'pagina_entrada', label: 'Página de entrada (visitante não logado)', type: 'select', full: true, options: [{ value: 'Login', label: 'Login (tela de acesso)' }, { value: 'Site', label: 'Site (página de planos)' }] },

  { type: 'section', label: 'Textos padrão de orçamento e OS' },
  { name: 'defeito_orc', label: 'Defeito relatado (orçamento)', optional: true, max: 100 },
  { name: 'laudo_orc', label: 'Laudo técnico (orçamento)', optional: true, max: 100 },
  { name: 'acessorios_orc', label: 'Acessórios (orçamento)', optional: true, max: 100 },
  { name: 'senha_aparelho_orc', label: 'Senha do aparelho (orçamento)', optional: true, max: 100 },
  { name: 'avarias_orc', label: 'Avarias (orçamento)', optional: true, max: 100 },
  { name: 'mao_obra_orc', label: 'Condições de mão de obra (orçamento)', optional: true, max: 100 },
  { name: 'defeito_os', label: 'Defeito relatado (OS)', optional: true, max: 100 },
  { name: 'laudo_os', label: 'Laudo técnico (OS)', optional: true, max: 100 },
  { name: 'acessorios_os', label: 'Acessórios (OS)', optional: true, max: 100 },
  { name: 'senha_aparelho_os', label: 'Senha do aparelho (OS)', optional: true, max: 100 },
  { name: 'avarias_os', label: 'Avarias (OS)', optional: true, max: 100 },
  { name: 'mao_obra_os', label: 'Condições de mão de obra (OS)', optional: true, max: 100 }
];

async function renderSettings() {
  loading();
  const settings = await api('/api/content/settings') || {};
  root().innerHTML = `${pageHeader('Configurações da empresa', 'Dados operacionais e integração de WhatsApp. O token é gravado de forma protegida e não é reexibido após salvo.', `<button class="button primary" data-edit>${icon('edit')}Editar configurações</button>`)}
    <section class="panel settings-summary"><div class="detail-list">
      <div><small>Empresa</small><strong>${escapeHtml(settings.nome || 'Não configurado')}</strong></div>
      <div><small>E-mail</small><strong>${escapeHtml(settings.email || 'Não configurado')}</strong></div>
      <div><small>Telefone</small><strong>${escapeHtml(settings.telefone || 'Não configurado')}</strong></div>
      <div><small>CNPJ</small><strong>${escapeHtml(settings.cnpj || 'Não configurado')}</strong></div>
      <div><small>Cidade</small><strong>${escapeHtml(settings.cidade_sistema || 'Não configurada')}</strong></div>
      <div><small>Site</small><strong>${escapeHtml(settings.url_site || 'Não configurado')}</strong></div>
      <div><small>Multa por atraso</small><strong>${settings.multa_atraso != null ? `${settings.multa_atraso}%` : 'Não configurada'}</strong></div>
      <div><small>Juros por dia de atraso</small><strong>${settings.juros_atraso != null ? `${settings.juros_atraso}%` : 'Não configurado'}</strong></div>
      <div><small>WhatsApp (provedor)</small><strong>${escapeHtml(whatsappProviderOptions.find((option) => option.value === settings.api_whatsapp)?.label || 'Não configurado')}</strong></div>
      <div><small>WhatsApp (instância)</small><strong>${escapeHtml(settings.instancia_whatsapp || 'Não configurado')}</strong></div>
      <div><small>Token WhatsApp</small><strong>${settings.token_whatsapp_configurado ? 'Configurado' : 'Não configurado'}</strong></div>
      <div><small>Pagamento (provedor)</small><strong>${escapeHtml(paymentProviderOptions.find((option) => option.value === (settings.api_pagamento || ''))?.label || 'Nenhuma (cobrança manual)')}</strong></div>
      <div><small>Chave Asaas</small><strong>${settings.chave_api_asaas_configurado ? 'Configurada' : 'Não configurada'}</strong></div>
      <div><small>Access Token Mercado Pago</small><strong>${settings.access_token_configurado ? 'Configurado' : 'Não configurado'}</strong></div>
    </div></section>`;
  root().querySelector('[data-edit]').addEventListener('click', () => openForm({
    title: 'Configurações da empresa', eyebrow: 'Administração', fields: companySettingsFields, record: settings,
    onSubmit: async (values) => { await api('/api/content/settings', { method: 'PUT', body: values }); toast('Configurações atualizadas.'); await renderSettings(); }
  }));
}

async function renderSite(route) {
  loading();
  const tab = ['content', 'features', 'faqs'].includes(route.query.tab) ? route.query.tab : 'content';
  const tabs = `<div class="split-tabs"><a class="${tab === 'content' ? 'active' : ''}" href="#/site?tab=content">Conteúdo</a><a class="${tab === 'features' ? 'active' : ''}" href="#/site?tab=features">Recursos</a><a class="${tab === 'faqs' ? 'active' : ''}" href="#/site?tab=faqs">Perguntas</a></div>`;
  if (tab === 'features') return renderSiteCollection('features', tabs);
  if (tab === 'faqs') return renderSiteCollection('faqs', tabs);
  const site = await api('/api/content/site') || {};
  root().innerHTML = `${pageHeader('Dados do site', 'Textos institucionais publicados pela empresa.', `<button class="button primary" data-edit>${icon('edit')}Editar conteúdo</button>`)}${tabs}
    <section class="panel site-preview"><div class="site-hero"><p class="eyebrow">Prévia textual</p><h2>${escapeHtml(site.titulo || 'Título principal')}</h2><p>${escapeHtml(site.subtitulo || 'Subtítulo do site')}</p></div>
    <div class="detail-list"><div><small>Título dos recursos</small><strong>${escapeHtml(site.titulo_recursos || 'Não informado')}</strong></div><div><small>Título das perguntas</small><strong>${escapeHtml(site.titulo_perguntas || 'Não informado')}</strong></div><div><small>Rodapé</small><strong>${escapeHtml(site.titulo_rodape || 'Não informado')}</strong></div></div></section>`;
  root().querySelector('[data-edit]').addEventListener('click', () => openForm({
    title: 'Conteúdo do site', eyebrow: 'Site institucional', record: site,
    fields: [
      { name: 'titulo', label: 'Título principal', optional: true, max: 255 }, { name: 'subtitulo', label: 'Subtítulo', optional: true, max: 255 },
      { name: 'botao1', label: 'Primeiro botão', optional: true, max: 80 }, { name: 'botao2', label: 'Segundo botão', optional: true, max: 80 },
      { name: 'botao3', label: 'Terceiro botão', optional: true, max: 80 }, { name: 'video_site', label: 'Link do vídeo', optional: true, max: 255 },
      { name: 'titulo_recursos', label: 'Título dos recursos', optional: true, max: 255 }, { name: 'titulo_perguntas', label: 'Título das perguntas', optional: true, max: 255 },
      { name: 'titulo_rodape', label: 'Título do rodapé', optional: true, max: 255 }, { name: 'botao_rodape', label: 'Botão do rodapé', optional: true, max: 100 },
      { name: 'link_rodape', label: 'Link do rodapé', optional: true, max: 255 },
      { name: 'descricao_site', label: 'Descrição do site', type: 'textarea', optional: true, full: true, max: 10000 },
      { name: 'descricao_rodape', label: 'Descrição do rodapé', type: 'textarea', optional: true, full: true, max: 10000 }
    ],
    onSubmit: async (values) => { await api('/api/content/site', { method: 'PUT', body: values }); toast('Conteúdo atualizado.'); await renderSite({ query: { tab: 'content' } }); }
  }));
}

async function renderSiteCollection(type, tabs) {
  const isFeature = type === 'features';
  const result = await api(`/api/content/site/${type}?page=1&pageSize=100`);
  root().innerHTML = `${pageHeader(isFeature ? 'Recursos do site' : 'Perguntas frequentes', isFeature ? 'Diferenciais apresentados no site institucional.' : 'Perguntas e respostas exibidas aos visitantes.', `<button class="button primary" data-new>${icon('plus')}Novo registro</button>`)}${tabs}
    <section class="panel">${table(isFeature ? [
      { key: 'posicao_recurso', label: 'Ordem', render: number }, { key: 'titulo_recurso', label: 'Título' }, { key: 'descricao_recurso', label: 'Descrição' }
    ] : [
      { key: 'posicao_pergunta', label: 'Ordem', render: number }, { key: 'titulo_pergunta', label: 'Pergunta' }, { key: 'descricao_pergunta', label: 'Resposta' }
    ], result.items, (item) => `${editButton(item.id)}<button class="button danger small" data-action="delete" data-id="${item.id}">${icon('trash')}Excluir</button>`)}</section>`;
  const byId = new Map(result.items.map((item) => [String(item.id), item]));
  const show = (record = {}) => openForm({
    title: record.id ? 'Editar registro' : 'Novo registro', eyebrow: 'Site', record,
    fields: isFeature ? [
      { name: 'titulo_recurso', label: 'Título', required: true, max: 150 }, { name: 'icone_recurso', label: 'Ícone', optional: true, max: 100 },
      { name: 'posicao_recurso', label: 'Ordem', type: 'number', min: 0, numeric: true, optional: true },
      { name: 'descricao_recurso', label: 'Descrição', type: 'textarea', required: true, full: true, max: 255 }
    ] : [
      { name: 'titulo_pergunta', label: 'Pergunta', required: true, max: 150 },
      { name: 'posicao_pergunta', label: 'Ordem', type: 'number', min: 0, numeric: true, optional: true },
      { name: 'descricao_pergunta', label: 'Resposta', type: 'textarea', required: true, full: true, max: 10000 }
    ],
    onSubmit: async (values) => { await api(`/api/content/site/${type}${record.id ? `/${record.id}` : ''}`, { method: record.id ? 'PATCH' : 'POST', body: values }); toast('Registro salvo.'); location.reload(); }
  });
  root().querySelector('[data-new]').addEventListener('click', () => show());
  root().querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
    const record = byId.get(button.dataset.id);
    if (button.dataset.action === 'edit') return show(record);
    await confirmAction('Excluir este registro do site?', async () => { await api(`/api/content/site/${type}/${record.id}`, { method: 'DELETE', body: { reason: 'Exclusão pela interface' } }); toast('Registro excluído.'); location.reload(); });
  }));
}

async function renderTutorials() {
  loading();
  const result = await api('/api/content/tutorials?page=1&pageSize=100');
  root().innerHTML = `${pageHeader('Tutoriais', 'Materiais de orientação cadastrados pela administração do sistema.')}
    <section class="panel">${table([
      { key: 'ordem', label: 'Ordem', render: number }, { key: 'titulo', label: 'Tutorial' },
      { key: 'link', label: 'Endereço', render: (value) => value ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">Abrir tutorial</a>` : 'Não informado' }
    ], result.items)}</section>`;
}

// Limite de plano para exibição: vazio/0 = ilimitado (o backend também trata assim).
function planLimit(value) {
  return (value === null || value === undefined || Number(value) <= 0) ? 'Ilimitado' : number(value);
}

async function renderSubscription() {
  loading();
  const data = await api('/api/content/subscription');
  const c = data.company;
  root().innerHTML = `${pageHeader('Assinatura e limites', 'Plano atual, consumo de recursos e mensalidades administrativas.')}
    <div class="metric-grid compact-metrics">
      <div class="metric-card"><span>Plano</span><strong>${escapeHtml(c.plano_nome || 'Sem plano')}</strong><small>${money(c.plano_valor ?? c.mensalidade)}</small></div>
      <div class="metric-card"><span>Clientes</span><strong>${number(data.usage.clientes)}</strong><small>Limite: ${planLimit(c.limite_clientes)}</small></div>
      <div class="metric-card"><span>Usuários</span><strong>${number(data.usage.usuarios)}</strong><small>Limite: ${planLimit(c.limite_usuarios)}</small></div>
      <div class="metric-card"><span>Dispositivos</span><strong>${number(data.usage.dispositivos)}</strong><small>Limite: ${planLimit(c.limite_dispositivos)}</small></div>
    </div>
    <section class="panel" style="margin-bottom:14px"><div class="toolbar"><strong>Recursos habilitados</strong></div><div class="check-list" style="padding:14px">${data.resources.length ? data.resources.map((item) => `<span class="badge success">${escapeHtml(item.nome)}</span>`).join(' ') : '<p class="muted">Nenhum recurso específico cadastrado.</p>'}</div></section>
    <section class="panel"><div class="toolbar"><strong>Últimas mensalidades</strong></div>${table([
      { key: 'descricao', label: 'Descrição' }, { key: 'vencimento', label: 'Vencimento', render: date }, { key: 'subtotal', label: 'Valor', render: money }, { key: 'pago', label: 'Pago', render: badge }, { key: 'data_pgto', label: 'Pagamento', render: date }
    ], data.billing)}</section>`;
}

function downloadCsv(filename, columns, items) {
  const safeCell = (value) => {
    let textValue = String(value ?? '');
    if (/^[=+\-@]/.test(textValue)) textValue = `'${textValue}`;
    return `"${textValue.replace(/"/g, '""')}"`;
  };
  const content = [
    columns.map((column) => safeCell(column.label)).join(';'),
    ...items.map((item) => columns.map((column) => safeCell(item[column.key])).join(';'))
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderReports(route) {
  loading();
  const configs = {
    sales: {
      label: 'Vendas', path: '/api/reports/sales', period: true,
      columns: [
        { key: 'data', label: 'Data', render: date }, { key: 'id', label: 'Venda' }, { key: 'cliente_nome', label: 'Cliente', render: text },
        { key: 'vendedor_nome', label: 'Vendedor', render: text }, { key: 'total', label: 'Total', render: money },
        { key: 'custo', label: 'Custo', render: money }, { key: 'lucro', label: 'Lucro', render: money }, { key: 'pago', label: 'Pagamento', render: badge }
      ]
    },
    'cash-flow': {
      label: 'Fluxo de caixa', path: '/api/reports/cash-flow', period: true,
      columns: [{ key: 'data', label: 'Data', render: date }, { key: 'tipo', label: 'Tipo', render: badge }, { key: 'descricao', label: 'Descrição' }, { key: 'valor', label: 'Valor', render: money }]
    },
    inventory: {
      label: 'Estoque', path: '/api/reports/inventory',
      columns: [
        { key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Produto' }, { key: 'categoria_nome', label: 'Categoria', render: text },
        { key: 'estoque', label: 'Quantidade', render: number }, { key: 'valor_estoque', label: 'Valor em estoque', render: money },
        { key: 'estoque_baixo', label: 'Estoque baixo', render: badge }
      ]
    },
    delinquency: {
      label: 'Inadimplência', path: '/api/reports/delinquency',
      columns: [
        { key: 'vencimento', label: 'Vencimento', render: date }, { key: 'cliente_nome', label: 'Cliente', render: text },
        { key: 'descricao', label: 'Descrição' }, { key: 'valor', label: 'Valor', render: money },
        { key: 'dias_atraso', label: 'Dias em atraso', render: number }, { key: 'telefone', label: 'Telefone', render: text }
      ]
    },
    'cash-registers': {
      label: 'Caixas', path: '/api/reports/cash-registers', period: true,
      columns: [
        { key: 'data_abertura', label: 'Abertura', render: date }, { key: 'operador_nome', label: 'Operador', render: text },
        { key: 'valor_abertura', label: 'Inicial', render: money }, { key: 'valor_fechamento', label: 'Final', render: money },
        { key: 'sangrias', label: 'Retiradas', render: money }, { key: 'quebra', label: 'Diferença', render: money }
      ]
    },
    'top-products': {
      label: 'Produtos mais vendidos', path: '/api/reports/top-products', period: true,
      columns: [
        { key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Produto' },
        { key: 'quantidade_vendida', label: 'Quantidade', render: number }, { key: 'valor_total', label: 'Valor total', render: money }
      ]
    },
    'annual-balance': {
      label: 'Balanço anual', path: '/api/reports/annual-balance', yearFilter: true,
      columns: [
        { key: 'mes', label: 'Mês', render: (value) => ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][Number(value) - 1] || value },
        { key: 'receitas', label: 'Receitas', render: money }, { key: 'despesas', label: 'Despesas', render: money }, { key: 'saldo', label: 'Saldo', render: money }
      ]
    },
    'synthetic-payables': {
      label: 'Sintético de despesas', path: '/api/reports/synthetic-payables', period: true,
      columns: [
        { key: 'categoria', label: 'Categoria', render: text }, { key: 'quantidade', label: 'Lançamentos', render: number },
        { key: 'pago', label: 'Pago', render: money }, { key: 'pendente', label: 'Pendente', render: money }
      ]
    },
    'synthetic-receivables': {
      label: 'Sintético a receber', path: '/api/reports/synthetic-receivables', period: true,
      columns: [
        { key: 'categoria', label: 'Categoria', render: text }, { key: 'quantidade', label: 'Lançamentos', render: number },
        { key: 'recebido', label: 'Recebido', render: money }, { key: 'pendente', label: 'Pendente', render: money }
      ]
    }
  };
  const selected = configs[route.query.tab] ? route.query.tab : 'sales';
  const config = configs[selected];
  const state = { from: route.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), to: route.query.to || today(), year: route.query.year || String(new Date().getFullYear()) };
  const query = new URLSearchParams({ page: 1, pageSize: 100 });
  if (config.period) { query.set('from', state.from); query.set('to', state.to); }
  if (config.yearFilter) query.set('year', state.year);
  const result = await api(`${config.path}?${query}`);
  const tabs = `<div class="split-tabs report-tabs">${Object.entries(configs).map(([key, item]) => `<a class="${selected === key ? 'active' : ''}" href="#/reports?tab=${key}">${item.label}</a>`).join('')}</div>`;
  root().innerHTML = `${pageHeader('Relatórios', 'Consultas consolidadas com exportação CSV segura.', `<span class="actions"><button class="button ghost" data-print>${icon('file-text')}Imprimir / PDF</button><button class="button ghost" data-export>${icon('download')}Exportar CSV</button></span>`)}${tabs}
    ${config.period ? `<section class="panel report-filter"><form class="toolbar" data-filter><label class="compact-field">De <input name="from" type="date" value="${state.from}"></label><label class="compact-field">Até <input name="to" type="date" value="${state.to}"></label><button class="button ghost">${icon('filter')}Aplicar</button></form></section>` : ''}
    ${config.yearFilter ? `<section class="panel report-filter"><form class="toolbar" data-year-filter><label class="compact-field">Ano <input name="year" type="number" min="2000" max="2100" value="${state.year}"></label><button class="button ghost">${icon('filter')}Aplicar</button></form></section>` : ''}
    <section class="panel">${table(config.columns, result.items)}</section>`;
  root().querySelector('[data-export]').addEventListener('click', () => downloadCsv(`relatorio-${selected}-${today()}.csv`, config.columns, result.items));
  root().querySelector('[data-print]').addEventListener('click', () => window.print());
  root().querySelector('[data-filter]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    location.hash = `#/reports?tab=${selected}&from=${values.from}&to=${values.to}`;
  });
  root().querySelector('[data-year-filter]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    location.hash = `#/reports?tab=${selected}&year=${values.year}`;
  });
}

export async function renderExtraRoute(route) {
  if (referenceConfigs[route.name]) { await renderReference(referenceConfigs[route.name]); return true; }
  if (route.name === 'notes') { await renderNotes(); return true; }
  if (route.name === 'tasks') { await renderTasks(route); return true; }
  if (route.name === 'tickets') { await renderTickets(); return true; }
  if (route.name === 'marketing') { await renderMarketing(route); return true; }
  if (route.name === 'cash') { await renderCash(); return true; }
  if (route.name === 'purchases') { await renderPurchases(); return true; }
  if (route.name === 'online-orders') { await renderOnlineOrders(); return true; }
  if (route.name === 'recurring') { await renderRecurring(); return true; }
  if (route.name === 'contracts') { await renderContracts(); return true; }
  if (route.name === 'commissions') { await renderCommissions(); return true; }
  if (route.name === 'hr') { await renderHr(route); return true; }
  if (route.name === 'settings') { await renderSettings(); return true; }
  if (route.name === 'site') { await renderSite(route); return true; }
  if (route.name === 'tutorials') { await renderTutorials(); return true; }
  if (route.name === 'subscription') { await renderSubscription(); return true; }
  if (route.name === 'reports') { await renderReports(route); return true; }
  return false;
}
