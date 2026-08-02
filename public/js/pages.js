import { api, uploadCertificate, uploadAttachment } from './api.js';
import { money, number, date, text, escapeHtml, badge } from './format.mjs';
import { icon } from './icons.mjs';
import { loading, pageHeader, table, pagination, openForm, confirmAction, toast, catalogImageUrl } from './ui.js';
import { renderExtraRoute } from './extra-pages.js';
import { attachmentButton, openAttachments } from './attachments.js';
import { code128SVG, sanitizeCode } from './barcode.mjs';
import { canAccess } from './session.js';
import { SHORTCUTS, AUTO_LIMIT } from './shortcuts.mjs';

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
      { name: 'complemento', label: 'Complemento', optional: true, max: 255, full: true },
      { name: 'pix', label: 'Chave Pix', optional: true, max: 50 }, { name: 'tipo_chave', label: 'Tipo da chave', optional: true, max: 100 }
    ]
  },
  products: {
    title: 'Produtos', singular: 'produto', path: '/api/catalog/products', subtitle: 'Catálogo, preço de venda e níveis de estoque.', hasImage: true,
    columns: [
      { key: 'foto', label: '', render: (value) => { const url = catalogImageUrl(value); return url ? `<img src="${url}" alt="" class="thumb">` : '<span class="thumb thumb-empty"></span>'; } },
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
        { name: 'descricao', label: 'Descrição', type: 'textarea', optional: true, full: true, max: 255 },
        { name: 'tipo_fiscal', label: 'Tipo fiscal', type: 'select', full: true, options: [{ value: 'mercadoria', label: 'Mercadoria (NF-e)' }, { value: 'servico', label: 'Serviço (NFS-e)' }] },
        { name: 'ncm', label: 'NCM (mercadoria)', optional: true, max: 8 },
        { name: 'cfop', label: 'CFOP (mercadoria)', optional: true, max: 4 },
        { name: 'cst_csosn', label: 'CST/CSOSN (mercadoria)', optional: true, max: 4 },
        { name: 'origem', label: 'Origem (0-8, mercadoria)', optional: true, max: 1 },
        { name: 'unidade_fiscal', label: 'Unidade fiscal (mercadoria)', optional: true, max: 6 },
        { name: 'codigo_lc116', label: 'Código LC 116 (serviço)', optional: true, max: 10 },
        { name: 'codigo_tributacao_municipio', label: 'Cód. tributação município (serviço)', optional: true, max: 20 },
        { name: 'aliquota_iss', label: 'Alíquota ISS % (serviço)', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
        { name: 'foto', label: 'Imagem do produto', type: 'image', full: true }
      ];
    },
    extraActions: (item) => (item.codigo ? `<button class="button ghost small" data-action="label" data-id="${item.id}">${icon('tag')}Etiqueta</button>` : '')
  },
  services: {
    title: 'Serviços', singular: 'serviço', path: '/api/catalog/services', subtitle: 'Serviços, valores e prazos praticados.', hasImage: true,
    columns: [
      { key: 'foto', label: '', render: (value) => { const url = catalogImageUrl(value); return url ? `<img src="${url}" alt="" class="thumb">` : '<span class="thumb thumb-empty"></span>'; } },
      { key: 'nome', label: 'Serviço' }, { key: 'valor', label: 'Valor', render: (value) => `<span class="money">${money(value)}</span>` },
      { key: 'dias', label: 'Prazo (dias)', render: number }, { key: 'comissao', label: 'Comissão %', render: number }, { key: 'ativo', label: 'Situação', render: badge }
    ],
    fields: [
      { name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'valor', label: 'Valor', type: 'number', step: '.01', min: 0, numeric: true, required: true },
      { name: 'dias', label: 'Prazo em dias', type: 'number', step: '1', min: 0, numeric: true, required: true },
      { name: 'comissao', label: 'Comissão %', type: 'number', step: '1', min: 0, numeric: true, optional: true },
      { name: 'mostrar_site', label: 'Mostrar no site', type: 'select', options: yesNoOptions() },
      { name: 'descricao', label: 'Descrição', type: 'textarea', optional: true, full: true, max: 5000 },
      { name: 'codigo_lc116', label: 'Código da LC 116 (NFS-e)', optional: true, max: 10 },
      { name: 'codigo_tributacao_municipio', label: 'Cód. tributação município (NFS-e)', optional: true, max: 20 },
      { name: 'aliquota_iss', label: 'Alíquota ISS % (NFS-e)', type: 'number', step: '.01', min: 0, numeric: true, optional: true },
      { name: 'foto', label: 'Imagem do serviço', type: 'image', full: true }
    ]
  },
  users: {
    title: 'Usuários', singular: 'usuário', path: '/api/users', subtitle: 'Acesso ao sistema, perfis e situação dos usuários.',
    attachmentEntity: 'users',
    columns: [
      { key: 'nome', label: 'Nome' }, { key: 'email', label: 'E-mail' }, { key: 'nivel', label: 'Perfil', render: badge },
      { key: 'telefone', label: 'Telefone', render: text }, { key: 'ativo', label: 'Situação', render: badge }
    ],
    fields: [
      { name: 'nome', label: 'Nome', required: true, max: 50 }, { name: 'email', label: 'E-mail', type: 'email', required: true, max: 50 },
      { name: 'password', label: 'Senha (mínimo 8 caracteres)', type: 'password', optional: true, max: 72 },
      { name: 'nivel', label: 'Perfil', type: 'select', required: true, options: ['Administrador', 'Gerente', 'Comum', 'Técnico', 'Tesoureiro', 'Financeiro'].map((value) => ({ value, label: value })) },
      { name: 'telefone', label: 'Telefone', optional: true, max: 20 }, { name: 'endereco', label: 'Endereço', optional: true, max: 150 },
      { name: 'numero', label: 'Número', optional: true, max: 10 }, { name: 'bairro', label: 'Bairro', optional: true, max: 50 },
      { name: 'cidade', label: 'Cidade', optional: true, max: 50 }, { name: 'estado', label: 'Estado', optional: true, max: 50 },
      { name: 'cep', label: 'CEP', optional: true, max: 20 }, { name: 'complemento', label: 'Complemento', optional: true, max: 100, full: true },
      { name: 'cpf', label: 'CPF', optional: true, max: 20 }, { name: 'data_nasc', label: 'Nascimento', type: 'date', optional: true },
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
          onSubmit: async (data, form) => {
            const saved = await api(edit ? `${config.path}/${item.id}` : config.path, { method: edit ? 'PATCH' : 'POST', body: data });
            const recordId = edit ? item.id : saved.id;
            if (config.hasImage && form) {
              const file = form.querySelector('input[type="file"]')?.files?.[0];
              if (file) await uploadAttachment(`${config.path}/${recordId}/image`, file);
            }
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
      if (action === 'label') openBarcodeLabel(item);
    }));
  };
  await load();
}

// Etiqueta com código de barras Code128 do produto (espelha gerar-codigo.php do legado).
// Permite escolher quantas cópias imprimir; a impressão sai por um iframe oculto.
function openBarcodeLabel(product) {
  const codigo = sanitizeCode(product.codigo);
  if (!codigo) { toast('Este produto não tem código para gerar etiqueta.', 'error'); return; }
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  const svg = code128SVG(codigo);
  const label = `<div class="barcode-label"><strong>${escapeHtml(product.nome)}</strong><span class="money">${money(product.valor_venda)}</span>${svg}<small>${escapeHtml(codigo)}</small></div>`;
  document.querySelector('#modal-title').textContent = 'Etiqueta do produto';
  document.querySelector('#modal-eyebrow').textContent = 'Código de barras';
  document.querySelector('#modal-body').innerHTML = `<div class="modal-grid">
    <div class="full barcode-preview">${label}</div>
    <label class="field">Cópias<input name="copies" type="number" min="1" max="100" step="1" value="1"></label>
  </div>`;
  document.querySelector('#modal-error').textContent = '';
  document.querySelector('#modal-submit-label').textContent = 'Imprimir';
  const handler = (event) => {
    event.preventDefault();
    const copies = Math.min(Math.max(Number(form.querySelector('[name=copies]').value) || 1, 1), 100);
    printLabels(label.repeat(copies));
    dialog.close();
  };
  if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
  form._submitHandler = handler;
  form.addEventListener('submit', handler);
  dialog.showModal();
}

function printLabels(html) {
  document.querySelector('#barcode-print-frame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'barcode-print-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas</title><style>
    body { margin: 0; font-family: system-ui, sans-serif; display: flex; flex-wrap: wrap; gap: 6mm; padding: 6mm; }
    .barcode-label { border: 1px solid #ccc; padding: 3mm; text-align: center; page-break-inside: avoid; }
    .barcode-label strong { display: block; font-size: 11pt; }
    .barcode-label .money { display: block; font-size: 13pt; font-weight: 700; margin: 1mm 0; }
    .barcode-label small { display: block; font-family: monospace; letter-spacing: 1px; }
    .barcode-label svg { max-width: 60mm; height: auto; }
  </style></head><body>${html}</body></html>`);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1000);
}

// Nomes dos grupos do catálogo de acessos (coluna `grupo`), para a tela não ser uma lista solta.
const PERMISSION_GROUPS = {
  1: 'Pessoas', 2: 'Produtos e estoque', 3: 'Financeiro', 4: 'Vendas e serviços',
  5: 'Recursos humanos', 6: 'Contratos', 7: 'Tarefas e atendimento', 8: 'Marketing', 9: 'Sistema'
};

async function openPermissions(user) {
  const [options, selected] = await Promise.all([api('/api/users/permissions/options'), api(`/api/users/${user.id}/permissions`)]);
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  const chosen = new Set(selected);
  document.querySelector('#modal-title').textContent = `Permissões de ${user.nome}`;
  document.querySelector('#modal-eyebrow').textContent = 'Controle de acesso';

  // Agrupa por área e ordena os grupos pelo nome.
  const groups = new Map();
  for (const option of options) {
    const label = PERMISSION_GROUPS[option.grupo] || 'Outros';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(option);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));

  const isAdmin = user.nivel === 'Administrador';
  document.querySelector('#modal-body').innerHTML = `
    ${isAdmin ? '<p class="perm-note">Este usuário é <strong>Administrador</strong> e já enxerga todos os módulos permitidos pelo plano — as marcações abaixo servem se o perfil for alterado depois.</p>' : ''}
    <div class="perm-toolbar">
      <input type="search" class="perm-search" placeholder="Buscar permissão…" aria-label="Buscar permissão">
      <span class="perm-count" data-perm-count></span>
      <button type="button" class="button ghost small" data-perm-all>Marcar todas</button>
      <button type="button" class="button ghost small" data-perm-none>Limpar</button>
    </div>
    <div class="perm-groups">${ordered.map(([label, items]) => `
      <section class="perm-group" data-group>
        <header>
          <strong>${escapeHtml(label)}</strong>
          <button type="button" class="button ghost small" data-group-toggle>Alternar</button>
        </header>
        <div class="perm-items">${items.map((option) => `
          <label class="perm-item" data-name="${escapeHtml(option.nome.toLowerCase())}">
            <input type="checkbox" name="permissionIds" value="${option.id}" ${chosen.has(option.id) ? 'checked' : ''}>
            <span>${escapeHtml(option.nome)}</span>
          </label>`).join('')}</div>
      </section>`).join('')}</div>`;
  document.querySelector('#modal-error').textContent = '';
  document.querySelector('#modal-submit-label').textContent = 'Salvar';

  const body = document.querySelector('#modal-body');
  const boxes = () => [...body.querySelectorAll('[name=permissionIds]')];
  const refreshCount = () => {
    const total = boxes().length;
    const marked = boxes().filter((b) => b.checked).length;
    body.querySelector('[data-perm-count]').textContent = `${marked} de ${total} marcadas`;
  };
  refreshCount();
  body.addEventListener('change', refreshCount);
  body.querySelector('[data-perm-all]').addEventListener('click', () => { boxes().forEach((b) => { b.checked = true; }); refreshCount(); });
  body.querySelector('[data-perm-none]').addEventListener('click', () => { boxes().forEach((b) => { b.checked = false; }); refreshCount(); });
  body.querySelectorAll('[data-group-toggle]').forEach((button) => button.addEventListener('click', () => {
    const group = button.closest('[data-group]');
    const items = [...group.querySelectorAll('[name=permissionIds]')];
    const marcarTodos = items.some((b) => !b.checked);
    items.forEach((b) => { b.checked = marcarTodos; });
    refreshCount();
  }));
  // Busca: esconde os itens que não casam e os grupos que ficaram vazios.
  body.querySelector('.perm-search').addEventListener('input', (event) => {
    const term = event.target.value.trim().toLowerCase();
    body.querySelectorAll('[data-group]').forEach((group) => {
      let visiveis = 0;
      group.querySelectorAll('.perm-item').forEach((item) => {
        const casa = !term || item.dataset.name.includes(term);
        item.hidden = !casa;
        if (casa) visiveis += 1;
      });
      group.hidden = visiveis === 0;
    });
  });

  const handler = async (event) => {
    event.preventDefault();
    try {
      const permissionIds = boxes().filter((b) => b.checked).map((b) => Number(b.value));
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
  // Os indicadores financeiros são restritos a alguns perfis (Comum e Técnico recebem 403).
  // A visão geral precisa continuar abrindo para eles, mostrando só o que podem ver.
  const [financeResult, operationsResult] = await Promise.allSettled([api('/api/reports/financial'), api('/api/reports/operational')]);
  const finance = financeResult.status === 'fulfilled' ? financeResult.value : null;
  const operations = operationsResult.status === 'fulfilled' ? operationsResult.value : {};
  // Métricas e atalhos só aparecem quando o usuário realmente pode abrir a tela: precisa da
  // permissão do perfil E do recurso no plano da empresa (o mesmo par que o backend exige).
  const cards = [
    finance && canAccess(['financeiro', 'receber'], 'financeiro') && metric('A receber', money(finance.a_receber), 'Contas pendentes', '#/finance?type=receivables'),
    finance && canAccess(['financeiro', 'pagar'], 'financeiro') && metric('A pagar', money(finance.a_pagar), 'Compromissos pendentes', '#/finance?type=payables'),
    canAccess('produtos', 'produtos_servicos') && metric('Produtos', number(operations.stock?.produtos), 'Itens cadastrados', '#/products'),
    canAccess(['estoque', 'produtos'], 'estoque') && metric('Estoque baixo', number(operations.stock?.estoque_baixo), 'Requer atenção', '#/inventory')
  ].filter(Boolean);

  // Atalhos: só os que o usuário pode abrir (perfil + plano). A ORDEM vem da personalização dele;
  // sem personalização, entram os mais usados primeiro (contagem por tela), com o catálogo de
  // desempate — assim o dashboard já chega útil sem ninguém configurar nada.
  const disponiveis = SHORTCUTS.filter((item) => canAccess(item.permissao, item.recurso));
  let prefs = { atalhos: null, uso: {} };
  try { prefs = await api('/api/content/dashboard/shortcuts'); } catch { /* segue no automático */ }

  let shortcuts;
  if (prefs.atalhos?.length) {
    const porChave = new Map(disponiveis.map((item) => [item.chave, item]));
    shortcuts = prefs.atalhos.map((chave) => porChave.get(chave)).filter(Boolean);
  } else {
    const uso = prefs.uso || {};
    shortcuts = [...disponiveis]
      .sort((a, b) => (uso[b.chave] || 0) - (uso[a.chave] || 0) || disponiveis.indexOf(a) - disponiveis.indexOf(b))
      .slice(0, AUTO_LIMIT);
  }

  const personalizado = Boolean(prefs.atalhos?.length);
  root().innerHTML = `${pageHeader('Visão geral', 'Indicadores atualizados da empresa e atalhos operacionais.')}
    ${cards.length ? `<section class="metric-grid">${cards.join('')}</section>` : ''}
    <section class="panel" style="margin-top:16px">
      <div class="toolbar"><strong>Acesso rápido</strong>
        <span class="muted" style="margin-left:auto;font-size:.8rem">${personalizado ? 'Sua seleção' : 'Ordenado pelas telas que você mais usa'}</span>
        <button class="button ghost small" data-customize>${icon('settings')}Personalizar</button>
      </div>
      ${shortcuts.length ? `<div class="quick-actions">${shortcuts.map((item) => `
        <a class="quick-action" href="${item.href}">
          <span class="quick-action-icon">${icon(item.icone)}</span>
          <span class="quick-action-text"><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.desc)}</small></span>
        </a>`).join('')}</div>`
        : '<p class="muted" style="padding:16px">Nenhum atalho disponível para o seu perfil e plano.</p>'}
    </section>`;

  root().querySelector('[data-customize]').addEventListener('click', () => openShortcutPicker(disponiveis, prefs.atalhos));
}

// Personalização: o usuário escolhe quais atalhos quer e em que ordem (a ordem é a de marcação).
function openShortcutPicker(disponiveis, atuais) {
  const escolhidos = new Set(atuais || []);
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  document.querySelector('#modal-title').textContent = 'Personalizar acesso rápido';
  document.querySelector('#modal-eyebrow').textContent = 'Dashboard';
  document.querySelector('#modal-submit-label').textContent = 'Salvar';
  document.querySelector('#modal-error').textContent = '';
  document.querySelector('#modal-body').innerHTML = `
    <p class="muted" style="margin:0 0 10px">Marque os atalhos que quer no dashboard. Sem nenhum marcado, eles voltam a ser escolhidos automaticamente pelas telas que você mais usa.</p>
    <div class="perm-items">${disponiveis.map((item) => `
      <label class="perm-item">
        <input type="checkbox" name="atalho" value="${item.chave}" ${escolhidos.has(item.chave) ? 'checked' : ''}>
        <span>${escapeHtml(item.titulo)}</span>
      </label>`).join('')}</div>`;

  const handler = async (event) => {
    event.preventDefault();
    try {
      const marcados = [...form.querySelectorAll('[name=atalho]:checked')].map((input) => input.value);
      if (marcados.length) await api('/api/content/dashboard/shortcuts', { method: 'PUT', body: { atalhos: marcados } });
      else await api('/api/content/dashboard/shortcuts', { method: 'DELETE' });
      dialog.close();
      toast(marcados.length ? 'Atalhos atualizados.' : 'Atalhos voltaram ao automático.');
      await renderDashboard();
    } catch (error) { document.querySelector('#modal-error').textContent = error.message; }
  };
  if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
  form._submitHandler = handler;
  form.addEventListener('submit', handler);
  dialog.showModal();
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
      ${table([{ key: 'id', label: 'Venda' }, { key: 'data_lanc', label: 'Data', render: date }, { key: 'cliente_nome', label: 'Cliente', render: text }, { key: 'forma_pgto_nome', label: 'Forma', render: text }, { key: 'total_venda', label: 'Total', render: (value, item) => `<span class="money">${money(value || item.valor)}</span>` }, { key: 'pago', label: 'Pagamento', render: badge }, { key: 'node_status', label: 'Situação', render: badge }], result.items, (item) => `${attachmentButton('sales', item.id)}<button class="button ghost small" data-receipt="${item.id}">${icon('file-text')}Recibo</button>${item.node_status === 'cancelado' ? '' : `<button class="button ghost small" data-nfse="${item.id}">${icon('file-text')}NFS-e</button><button class="button ghost small" data-nfe="${item.id}">${icon('file-text')}NF-e</button><button class="button danger small" data-cancel-sale="${item.id}">${icon('close')}Cancelar</button>`}`)}${pagination(result.pagination)}</section>`;
    root().querySelector('#sales-filter').addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); state.search = data.search; state.status = data.status; state.page = 1; load(); });
    root().querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); load(); }));
    root().querySelectorAll('[data-action="attachments"]').forEach((button) => button.addEventListener('click', () => openAttachments({ entity: 'sales', id: Number(button.dataset.attachmentId), title: `venda #${button.dataset.attachmentId}` })));
    root().querySelectorAll('[data-receipt]').forEach((button) => button.addEventListener('click', async () => {
      try {
        const [sale, settings] = await Promise.all([api(`/api/sales/${button.dataset.receipt}`), api('/api/content/settings').catch(() => null)]);
        printSaleReceipt(sale, settings || {});
      } catch (error) { toast(error.message, 'error'); }
    }));
    root().querySelector('[data-new-sale]').addEventListener('click', async () => {
      const [clients, products, services, paymentMethods] = await Promise.all([allItems('/api/clients'), allItems('/api/catalog/products'), allItems('/api/catalog/services'), allItems('/api/finance/payment-methods', false)]);
      openSaleForm(clients, products.filter((item) => item.ativo === 'Sim'), services.filter((item) => item.ativo === 'Sim'), paymentMethods, load);
    });
    root().querySelectorAll('[data-cancel-sale]').forEach((button) => button.addEventListener('click', async () => { const reason = prompt('Informe o motivo do cancelamento da venda:'); if (reason) { await api(`/api/sales/${button.dataset.cancelSale}`, { method: 'DELETE', body: { reason } }); toast('Venda cancelada e estoque restaurado.'); await load(); } }));
    root().querySelectorAll('[data-nfse]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const doc = await api(`/api/fiscal/nfse/from-sale/${button.dataset.nfse}`, { method: 'POST' });
        if (doc.status === 'autorizado') { toast(`NFS-e ${doc.numero} autorizada.`); printFiscalDocument(doc); }
        else if (doc.status === 'pendente') { toast('NFS-e registrada como pendente: configure o certificado no módulo de notas para transmitir.', 'error'); printFiscalDocument(doc); }
        else { toast(`NFS-e ${doc.status}. Veja o motivo no módulo de notas.`, 'error'); }
        await load();
      } catch (error) { toast(error.message, 'error'); } finally { button.disabled = false; }
    }));
    root().querySelectorAll('[data-nfe]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const doc = await api(`/api/fiscal/nfe/from-sale/${button.dataset.nfe}`, { method: 'POST' });
        if (doc.status === 'autorizado') { toast(`NF-e ${doc.numero} autorizada.`); printFiscalDocument(doc); }
        else if (doc.status === 'pendente') { toast('NF-e registrada como pendente: configure o certificado no módulo de notas para transmitir.', 'error'); printFiscalDocument(doc); }
        else { toast(`NF-e ${doc.status}. Veja o motivo no módulo de notas.`, 'error'); }
        await load();
      } catch (error) { toast(error.message, 'error'); } finally { button.disabled = false; }
    }));
  };
  await load();
}

function openSaleForm(clients, products, services, paymentMethods, reload) {
  if (!clients.length || (!products.length && !services.length)) {
    toast('Cadastre um cliente e ao menos um produto ou serviço ativo antes da venda.', 'error');
    return;
  }
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  const productById = new Map(products.map((entry) => [String(entry.id), entry]));
  const lines = []; // { kind: 'produto'|'servico', itemId, quantity } — o caixa começa vazio e escaneia.
  document.querySelector('#modal-title').textContent = 'Nova venda';
  document.querySelector('#modal-eyebrow').textContent = 'PDV / Caixa';
  document.querySelector('#modal-submit-label').textContent = 'Concluir venda';
  document.querySelector('#modal-error').textContent = '';

  const entryOf = (line) => (line.kind === 'produto' ? productById.get(String(line.itemId)) : services.find((s) => String(s.id) === String(line.itemId)));
  // Usa valor_venda para bater exatamente com o que o servidor cobra em createSale.
  const unitOf = (line) => { const e = entryOf(line); return e ? (Number(line.kind === 'produto' ? e.valor_venda : e.valor) || 0) : 0; };

  const computeTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + unitOf(line) * line.quantity, 0);
    const descInput = Number(form.querySelector('[name="desconto"]').value || 0);
    const tipo = form.querySelector('[name="tipo_desconto"]').value;
    const desconto = tipo === 'Percentual' ? subtotal * (descInput / 100) : descInput;
    const total = Math.max(0, subtotal - desconto);
    const paid = form.querySelector('[name="paid"]').value === 'true';
    const pago = Number(form.querySelector('[name="valorPago"]').value || 0);
    return { subtotal, desconto, total, paid, troco: paid ? Math.max(0, pago - total) : 0 };
  };
  const renderTotals = () => {
    const t = computeTotals();
    form.querySelector('#sale-totals').innerHTML = `
      <div><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div>
      <div><span>Desconto</span><strong>${money(t.desconto)}</strong></div>
      <div class="sale-total-main"><span>Total</span><strong>${money(t.total)}</strong></div>
      ${t.paid ? `<div class="sale-troco"><span>Troco</span><strong>${money(t.troco)}</strong></div>` : ''}`;
    form.querySelector('#valor-pago-wrap').hidden = !t.paid;
  };

  const renderLines = () => {
    const container = form.querySelector('#sale-lines');
    if (!lines.length) {
      container.innerHTML = '<div class="sale-empty muted">Escaneie um código de barras ou adicione um item pelos botões acima.</div>';
    } else {
      container.innerHTML = lines.map((line, index) => {
        const e = entryOf(line);
        const url = line.kind === 'produto' ? catalogImageUrl(e && e.foto) : '';
        const thumb = url ? `<img src="${url}" alt="" class="thumb">` : '<span class="thumb thumb-empty"></span>';
        return `<div class="sale-line" data-sale-line="${index}">
          ${thumb}
          <div class="sale-line-info"><strong>${escapeHtml(e ? e.nome : '—')}</strong><small>${money(unitOf(line))}${line.kind === 'produto' && e ? ` · saldo ${number(e.estoque)}` : ''}</small></div>
          <input class="sale-line-qty" data-line-quantity type="number" min="1" step="1" value="${line.quantity}" aria-label="Quantidade">
          <strong class="sale-line-total">${money(unitOf(line) * line.quantity)}</strong>
          <button class="button danger small" type="button" data-remove-line="${index}" aria-label="Remover">${icon('trash')}</button>
        </div>`;
      }).join('');
    }
    container.querySelectorAll('[data-remove-line]').forEach((button) => button.addEventListener('click', () => { lines.splice(Number(button.dataset.removeLine), 1); renderLines(); }));
    container.querySelectorAll('[data-line-quantity]').forEach((input, i) => input.addEventListener('input', () => {
      lines[i].quantity = Math.max(1, Math.floor(Number(input.value) || 1));
      input.closest('.sale-line').querySelector('.sale-line-total').textContent = money(unitOf(lines[i]) * lines[i].quantity);
      renderTotals();
    }));
    renderTotals();
  };

  const addProduct = (id) => {
    const existing = lines.find((line) => line.kind === 'produto' && String(line.itemId) === String(id));
    if (existing) existing.quantity += 1;
    else lines.push({ kind: 'produto', itemId: Number(id), quantity: 1 });
    renderLines();
  };

  document.querySelector('#modal-body').innerHTML = `<div class="modal-grid">
    <label class="field full">Código de barras<input name="barcode" placeholder="Escaneie ou digite o código e tecle Enter" autocomplete="off"></label>
    <div class="full sale-add-manual">${products.length ? `<button class="button ghost small" type="button" data-add-line="produto">${icon('plus')}Produto</button> ` : ''}${services.length ? `<button class="button ghost small" type="button" data-add-line="servico">${icon('plus')}Serviço</button>` : ''}</div>
    <div class="full" id="sale-lines"></div>
    <div class="full sale-totals" id="sale-totals"></div>
    <label class="field full">Cliente<select name="clientId" required>${clients.map((client) => `<option value="${client.id}">${escapeHtml(client.nome)}</option>`).join('')}</select></label>
    <label class="field">Desconto<input name="desconto" type="number" step=".01" min="0" value="0"></label>
    <label class="field">Tipo do desconto<select name="tipo_desconto"><option value="Valor">Valor</option><option value="Percentual">Percentual</option></select></label>
    <label class="field">Pagamento imediato<select name="paid"><option value="false">Não</option><option value="true">Sim</option></select></label>
    <label class="field">Forma de pagamento<select name="paymentMethodId"><option value="0">Não informado</option>${paymentMethods.map((method) => `<option value="${method.id}">${escapeHtml(method.nome)}</option>`).join('')}</select></label>
    <label class="field" id="valor-pago-wrap" hidden>Valor pago<input name="valorPago" type="number" step=".01" min="0" value="0"></label>
    <label class="field">Vencimento<input name="dueDate" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label>
    <label class="field full">Observações<textarea name="obs" maxlength="100"></textarea></label>
  </div>`;
  renderLines();

  const barcodeInput = form.querySelector('[name="barcode"]');
  barcodeInput.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const codigo = barcodeInput.value.trim();
    if (!codigo) return;
    barcodeInput.value = '';
    try {
      let product = products.find((p) => String(p.codigo) === codigo);
      if (!product) {
        product = await api(`/api/catalog/products/by-code/${encodeURIComponent(codigo)}`);
        if (!productById.has(String(product.id))) { products.push(product); productById.set(String(product.id), product); }
      }
      document.querySelector('#modal-error').textContent = '';
      addProduct(product.id);
    } catch (error) {
      document.querySelector('#modal-error').textContent = error.message;
    }
    barcodeInput.focus();
  });

  form.querySelectorAll('[data-add-line]').forEach((button) => button.addEventListener('click', () => {
    const kind = button.dataset.addLine;
    const catalog = kind === 'produto' ? products : services;
    if (catalog.length) { lines.push({ kind, itemId: catalog[0].id, quantity: 1 }); renderLines(); }
  }));
  form.querySelector('[name="desconto"]').addEventListener('input', renderTotals);
  form.querySelector('[name="tipo_desconto"]').addEventListener('change', renderTotals);
  form.querySelector('[name="paid"]').addEventListener('change', renderTotals);
  form.querySelector('[name="valorPago"]').addEventListener('input', renderTotals);

  const handler = async (event) => {
    event.preventDefault();
    const submit = document.querySelector('#modal-submit');
    submit.disabled = true;
    document.querySelector('#modal-error').textContent = '';
    try {
      const values = Object.fromEntries(new FormData(form));
      const items = lines.map((line) => ({ type: line.kind, id: Number(line.itemId), quantity: Number(line.quantity) }));
      if (!items.length) throw new Error('Adicione ao menos um item à venda.');
      if (items.some((item) => !item.id || !Number.isInteger(item.quantity) || item.quantity < 1)) throw new Error('Revise os itens e as quantidades.');
      await api('/api/sales', { method: 'POST', body: { clientId: Number(values.clientId), paymentMethodId: Number(values.paymentMethodId), dueDate: values.dueDate, paid: values.paid === 'true', desconto: Number(values.desconto || 0), tipo_desconto: values.tipo_desconto, obs: values.obs, items } });
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
  setTimeout(() => barcodeInput.focus(), 80);
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

async function renderWork(type, route = {}) {
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
  const state = { page: 1, search: '', status: config.statuses.includes(route.query?.status) ? route.query.status : '' };
  const load = async () => {
    const params = new URLSearchParams({ page: state.page, pageSize: 25, search: state.search });
    if (state.status) params.set('status', state.status);
    const result = await api(`/api/work/${type}?${params}`);
    root().innerHTML = `${pageHeader(config.title, 'Acompanhamento por cliente, equipamento, data e situação.', `<button class="button primary" data-new-work>${icon('plus')}${config.newLabel}</button>`)}
      <section class="panel"><form class="toolbar" id="work-filter"><input class="search" name="search" value="${escapeHtml(state.search)}" placeholder="Buscar cliente, equipamento ou responsável"><select name="status"><option value="">Todas as situações</option>${config.statuses.map((status) => `<option value="${escapeHtml(status)}" ${state.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select><button class="button ghost">${icon('filter')}Filtrar</button></form>
      ${table([{ key: 'id', label: 'Número' }, { key: 'data', label: 'Data', render: date }, { key: 'cliente_nome', label: 'Cliente', render: text }, { key: 'equipamento', label: 'Equipamento', render: text }, { key: 'subtotal', label: 'Total', render: (value) => `<span class="money">${money(value)}</span>` }, { key: 'status', label: 'Situação', render: badge }, ...(type === 'quotes' ? [{ key: 'dias_validade', label: 'Validade', render: (value, item) => workVencido(item) }] : [{ key: 'data_entrega', label: 'Entrega', render: (value, item) => workEntrega(item) }])], result.items, (item) => `${editButton(item.id)}${attachmentButton(type, item.id)}<button class="button ghost small" data-print-work="${item.id}">${icon('file-text')}Imprimir</button>${/Cancel/.test(item.status) ? '' : `<button class="button danger small" data-action="cancel" data-id="${item.id}">${icon('close')}Cancelar</button>`}`)}${pagination(result.pagination)}</section>`;
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
    root().querySelectorAll('[data-print-work]').forEach((button) => button.addEventListener('click', async () => {
      try {
        const [work, settings] = await Promise.all([api(`/api/work/${type}/${button.dataset.printWork}`), api('/api/content/settings').catch(() => null)]);
        printWorkDocument(work, type, settings || {});
      } catch (error) { toast(error.message, 'error'); }
    }));
  };
  await load();
}

function workVencido(item) {
  if (item.status !== 'Pendente' || !item.data || !Number(item.dias_validade)) return '<span class="badge">—</span>';
  const limite = new Date(item.data);
  limite.setDate(limite.getDate() + Number(item.dias_validade));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return limite < hoje ? '<span class="badge danger">Vencido</span>' : `<span class="badge success">até ${date(limite.toISOString().slice(0, 10))}</span>`;
}

function workEntrega(item) {
  if (!item.data_entrega) return '<span class="badge">—</span>';
  const entrega = String(item.data_entrega).slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);
  return item.status === 'Entregue' && entrega === hoje ? '<span class="badge success">Hoje</span>' : `<span>${date(entrega)}</span>`;
}

function printWorkDocument(work, type, settings) {
  const win = window.open('', '_blank');
  if (!win) { toast('Habilite pop-ups para imprimir.', 'error'); return; }
  const rotulo = type === 'orders' ? 'Ordem de serviço' : 'Orçamento';
  const itens = (work.items || []).map((item) => `<tr><td>${escapeHtml(item.nome || item.descricao || '')}</td><td class="r">${number(item.quantity ?? item.quantidade ?? 1)}</td><td class="r">${money(item.total)}</td></tr>`).join('');
  const linha = (rotuloCampo, valor) => valor ? `<p><small>${rotuloCampo}: ${escapeHtml(String(valor))}</small></p>` : '';
  const assina = settings.assinatura_cliente === 'Sim';
  win.document.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>${rotulo} ${work.id}</title>
    <style>body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 2px}small{color:#555}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border-bottom:1px solid #ddd;padding:6px;font-size:13px;text-align:left}.r{text-align:right}.tot{text-align:right;font-weight:bold;margin-top:12px;font-size:15px}.assina{margin-top:48px;border-top:1px solid #333;width:60%;padding-top:6px;font-size:12px;color:#555}</style>
    </head><body>
    <h1>${escapeHtml(settings.nome || 'Empresa')}</h1>
    <small>${rotulo} nº ${work.id} · ${date(work.data)} · ${escapeHtml(String(work.status || ''))}</small>
    ${linha('Cliente', work.cliente_nome)}
    ${linha('Equipamento', [work.equipamento, work.marca, work.modelo].filter(Boolean).join(' '))}
    ${linha('Defeito relatado', work.defeito)}
    ${linha('Laudo técnico', work.laudo)}
    ${linha('Condições', work.condicoes)}
    ${itens ? `<table><thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Total</th></tr></thead><tbody>${itens}</tbody></table>` : ''}
    <p class="tot">Total: ${money(work.subtotal || work.valor)}</p>
    ${assina ? '<div class="assina">Assinatura do cliente</div>' : ''}
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  win.document.close();
}

async function renderFiscal(route = {}) {
  loading();
  const tab = route.query?.tab === 'config' ? 'config' : 'documentos';
  const tabs = `<div class="split-tabs"><a class="${tab === 'documentos' ? 'active' : ''}" href="#/fiscal">Documentos</a><a class="${tab === 'config' ? 'active' : ''}" href="#/fiscal?tab=config">Configuração</a></div>`;
  if (tab === 'config') return renderFiscalConfig(tabs);

  const result = await api('/api/fiscal');
  root().innerHTML = `${pageHeader('Notas fiscais', 'Documentos emitidos a partir das vendas. NFS-e pelo Padrão Nacional; homologação antes de produção.')}${tabs}
    <section class="panel">${table([
      { key: 'id', label: 'Doc' },
      { key: 'modelo', label: 'Modelo', render: (value) => value ? String(value).toUpperCase() : '' },
      { key: 'numero', label: 'Número', render: text },
      { key: 'venda', label: 'Venda', render: text },
      { key: 'valor_total', label: 'Valor', render: (value) => `<span class="money">${money(value)}</span>` },
      { key: 'ambiente', label: 'Ambiente', render: badge },
      { key: 'status', label: 'Situação', render: badge },
      { key: 'criado_em', label: 'Emitido', render: date }
    ], result.items, (item) => `<button class="button ghost small" data-print-fiscal="${item.id}">${icon('file-text')}Imprimir</button>`)}</section>`;
  root().querySelectorAll('[data-print-fiscal]').forEach((button) => button.addEventListener('click', async () => {
    try { printFiscalDocument(await api(`/api/fiscal/${button.dataset.printFiscal}`)); } catch (error) { toast(error.message, 'error'); }
  }));
}

async function renderFiscalConfig(tabs) {
  const { config, emitente } = await api('/api/fiscal/config');
  const cfg = config || {};
  const validade = cfg.certificado_validade ? date(cfg.certificado_validade) : 'Nenhum certificado enviado';
  root().innerHTML = `${pageHeader('Notas fiscais', 'Configuração de emissão, dados fiscais da empresa e certificado digital.')}${tabs}
    <section class="panel">
      <div class="toolbar"><strong>Configuração fiscal</strong><button class="button primary small" data-edit-fiscal>${icon('edit')}Editar dados fiscais</button></div>
      <div class="detail-list" style="padding:16px">
        <div><small>Ambiente</small><strong>${escapeHtml(cfg.ambiente || 'homologacao')}</strong></div>
        <div><small>Emite NFS-e</small><strong>${escapeHtml(cfg.emite_nfse || 'Sim')}</strong></div>
        <div><small>Emite NF-e</small><strong>${escapeHtml(cfg.emite_nfe || 'Nao')}</strong></div>
        <div><small>CNPJ</small><strong>${escapeHtml(emitente.cnpj || 'Não informado')}</strong></div>
        <div><small>Inscrição municipal</small><strong>${escapeHtml(emitente.inscricao_municipal || 'Não informada')}</strong></div>
        <div><small>Código IBGE</small><strong>${escapeHtml(emitente.codigo_ibge || 'Não informado')}</strong></div>
        <div><small>Regime</small><strong>${escapeHtml(emitente.regime_tributario || 'Não informado')}</strong></div>
      </div>
    </section>
    <section class="panel">
      <div class="toolbar"><strong>Certificado digital A1</strong></div>
      <div style="padding:16px">
        ${cfg.certificado_configurado
          ? `<div class="detail-list" style="margin-bottom:12px"><div><small>Arquivo</small><strong>${escapeHtml(cfg.certificado_nome || 'certificado.pfx')}</strong></div><div><small>Validade</small><strong>${validade}</strong></div><div><small>Situação</small><strong>Cadastrado</strong></div></div>`
          : '<p class="muted">Nenhum certificado cadastrado.</p>'}
        <p class="muted">O arquivo fica em pasta protegida e a senha é guardada cifrada, nunca reexibida. Enviar novamente substitui o atual.</p>
        <div class="modal-grid">
          <label class="field">Arquivo .pfx / .p12<input type="file" id="cert-file" accept=".pfx,.p12"></label>
          <label class="field">Senha do certificado<input type="password" id="cert-password" autocomplete="off"></label>
          <div class="full"><button class="button primary" id="cert-upload">${icon('upload')}Enviar certificado</button></div>
        </div>
      </div>
    </section>`;

  root().querySelector('[data-edit-fiscal]').addEventListener('click', () => {
    openForm({
      title: 'Dados fiscais da empresa', eyebrow: 'Configuração fiscal', submitLabel: 'Salvar',
      fields: [
        { name: 'ambiente', label: 'Ambiente', type: 'select', options: [{ value: 'homologacao', label: 'Homologação' }, { value: 'producao', label: 'Produção' }] },
        { name: 'emiteNfse', label: 'Emite NFS-e', type: 'select', options: [{ value: 'Sim', label: 'Sim' }, { value: 'Nao', label: 'Não' }] },
        { name: 'emiteNfe', label: 'Emite NF-e', type: 'select', options: [{ value: 'Sim', label: 'Sim' }, { value: 'Nao', label: 'Não' }] },
        { name: 'cnpj', label: 'CNPJ', optional: true, max: 18 },
        { name: 'razaoSocial', label: 'Razão social', optional: true, max: 150, full: true },
        { name: 'inscricaoEstadual', label: 'Inscrição estadual', optional: true, max: 20 },
        { name: 'inscricaoMunicipal', label: 'Inscrição municipal', optional: true, max: 20 },
        { name: 'codigoIbge', label: 'Código IBGE (7 dígitos)', optional: true, max: 7 },
        { name: 'regimeTributario', label: 'Regime tributário', type: 'select', options: [{ value: 'Simples Nacional', label: 'Simples Nacional' }, { value: 'Lucro Presumido', label: 'Lucro Presumido' }, { value: 'Lucro Real', label: 'Lucro Real' }] },
        { name: 'cnae', label: 'CNAE', optional: true, max: 10 }
      ],
      record: {
        ambiente: cfg.ambiente || 'homologacao', emiteNfse: cfg.emite_nfse || 'Sim', emiteNfe: cfg.emite_nfe || 'Nao',
        cnpj: emitente.cnpj || '', razaoSocial: emitente.razao_social || '', inscricaoEstadual: emitente.inscricao_estadual || '',
        inscricaoMunicipal: emitente.inscricao_municipal || '', codigoIbge: emitente.codigo_ibge || '', regimeTributario: emitente.regime_tributario || 'Simples Nacional', cnae: emitente.cnae || ''
      },
      onSubmit: async (values) => {
        const { ambiente, emiteNfse, emiteNfe, ...emit } = values;
        await api('/api/fiscal/config', { method: 'PUT', body: { ambiente, emiteNfse, emiteNfe, emitente: emit } });
        toast('Configuração fiscal salva.');
        await renderFiscalConfig(tabs);
      }
    });
  });

  root().querySelector('#cert-upload').addEventListener('click', async () => {
    const file = root().querySelector('#cert-file').files[0];
    const senha = root().querySelector('#cert-password').value;
    if (!file) return toast('Selecione o arquivo do certificado.', 'error');
    if (!senha) return toast('Informe a senha do certificado.', 'error');
    try {
      const result = await uploadCertificate('/api/fiscal/certificate', file, senha);
      toast(`Certificado cadastrado. Válido até ${date(result.validade)}.`);
      await renderFiscalConfig(tabs);
    } catch (error) { toast(error.message, 'error'); }
  });
}

function printFiscalDocument(doc) {
  const win = window.open('', '_blank');
  if (!win) { toast('Habilite pop-ups para imprimir a nota.', 'error'); return; }
  const itens = (doc.itens || []).map((item) => `<tr><td>${escapeHtml(item.descricao || '')}</td><td class="r">${money(item.valor_total)}</td></tr>`).join('');
  const semValor = doc.status !== 'autorizado';
  const rotulo = String(doc.modelo || 'nfse').toUpperCase();
  win.document.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>${rotulo} ${doc.numero || ''}</title>
    <style>body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}small{color:#555}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border-bottom:1px solid #ddd;padding:6px;font-size:13px;text-align:left}.r{text-align:right}.tot{text-align:right;font-weight:bold;margin-top:12px}.tag{display:inline-block;padding:2px 8px;border:1px solid #999;border-radius:4px;font-size:11px}.aviso{background:#fff4e5;border:1px solid #f0c36d;padding:8px;border-radius:4px;margin:12px 0;font-size:12px}</style>
    </head><body>
    <h1>${rotulo} ${doc.numero ? 'nº ' + doc.numero : '(sem número)'} · série ${doc.serie || '-'}</h1>
    <small>Modelo ${String(doc.modelo || '').toUpperCase()} · Ambiente ${escapeHtml(String(doc.ambiente || ''))} · Situação <span class="tag">${escapeHtml(String(doc.status || ''))}</span></small>
    ${doc.chave_acesso ? `<p><small>Chave de acesso: ${escapeHtml(String(doc.chave_acesso))}</small></p>` : ''}
    ${semValor ? `<div class="aviso"><strong>Documento sem autorização fiscal.</strong> Representação interna para conferência, sem valor fiscal enquanto não autorizado pelo fisco.</div>` : ''}
    <table><thead><tr><th>Serviço</th><th class="r">Valor</th></tr></thead><tbody>${itens}</tbody></table>
    <p class="tot">Total: ${money(doc.valor_total)}</p>
    ${doc.motivo_rejeicao ? `<p><small>Retorno do fisco: ${escapeHtml(String(doc.motivo_rejeicao))}</small></p>` : ''}
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  win.document.close();
}

function printSaleReceipt(sale, settings) {
  const win = window.open('', '_blank');
  if (!win) { toast('Habilite pop-ups para imprimir o recibo.', 'error'); return; }
  const itens = (sale.items || []).map((item) => `<tr><td>${escapeHtml(item.produto_nome || '')}</td><td class="r">${number(item.quantidade)}</td><td class="r">${money(item.valor)}</td><td class="r">${money(item.total)}</td></tr>`).join('');
  const assina = settings.assinatura_recibo === 'Sim';
  win.document.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Recibo venda ${sale.id}</title>
    <style>body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 2px}small{color:#555}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border-bottom:1px solid #ddd;padding:6px;font-size:13px;text-align:left}.r{text-align:right}.tot{text-align:right;font-weight:bold;margin-top:12px;font-size:15px}.assina{margin-top:48px;border-top:1px solid #333;width:60%;padding-top:6px;font-size:12px;color:#555}</style>
    </head><body>
    <h1>${escapeHtml(settings.nome || 'Empresa')}</h1>
    <small>Recibo de venda nº ${sale.id} · ${date(sale.data_lanc)}</small>
    <p><small>Cliente: ${escapeHtml(sale.cliente_nome || 'Não informado')} · Pagamento: ${sale.pago === 'Sim' ? 'Pago' : 'Pendente'}</small></p>
    <table><thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Total</th></tr></thead><tbody>${itens}</tbody></table>
    <p class="tot">Total: ${money(sale.total_venda || sale.valor)}</p>
    ${assina ? '<div class="assina">Assinatura do cliente</div>' : ''}
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  win.document.close();
}

export async function renderRoute(route) {
  if (await renderExtraRoute(route)) return;
  if (route.name === 'dashboard') return renderDashboard();
  if (entityConfigs[route.name]) return renderCrud(entityConfigs[route.name]);
  if (route.name === 'inventory') return renderInventory();
  if (route.name === 'finance') return renderFinance(route);
  if (route.name === 'sales') return renderSales();
  if (route.name === 'fiscal') return renderFiscal(route);
  if (route.name === 'orders' || route.name === 'quotes') return renderWork(route.name, route);
  return renderDashboard();
}
