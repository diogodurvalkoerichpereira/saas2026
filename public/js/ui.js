import { escapeHtml } from './format.mjs';
import { normalizeFormValues, validateFormValues } from './form-values.mjs';
import { icon } from './icons.mjs';

export function toast(message, type = 'success') {
  const region = document.querySelector('#toast-region');
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 3500);
}

export function loading() {
  document.querySelector('#page-root').innerHTML = '<div class="panel loading-state">Carregando dados…</div>';
}

export function pageHeader(title, subtitle, action = '') {
  return `<div class="page-header"><div><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(subtitle)}</p></div>${action}</div>`;
}

export function table(columns, items, actions = () => '') {
  if (!items.length) return '<div class="empty-state"><div><strong>Nenhum registro encontrado.</strong><p>Ajuste os filtros ou crie um novo registro.</p></div></div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}<th aria-label="Ações"></th></tr></thead><tbody>${items.map((item) => `<tr>${columns.map((column) => `<td>${column.render ? column.render(item[column.key], item) : escapeHtml(item[column.key])}</td>`).join('')}<td class="actions">${actions(item)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function pagination(meta) {
  return `<div class="pagination"><span>Página ${meta.page} de ${meta.pages} · ${meta.total} registros</span><button class="button ghost small" data-page="${meta.page - 1}" ${meta.page <= 1 ? 'disabled' : ''}>${icon('chevron-left')}Anterior</button><button class="button ghost small" data-page="${meta.page + 1}" ${meta.page >= meta.pages ? 'disabled' : ''}>Próxima${icon('chevron-right')}</button></div>`;
}

function fieldMarkup(field, value) {
  const required = field.required ? 'required' : '';
  const full = field.full ? 'full' : '';
  const safe = value === null || value === undefined ? '' : (field.type === 'date' ? String(value).slice(0, 10) : String(value));
  if (field.type === 'select') {
    return `<label class="field ${full}">${escapeHtml(field.label)}<select name="${field.name}" ${required}>${(field.options || []).map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value ?? field.default ?? '') ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
  }
  if (field.type === 'textarea') return `<label class="field ${full}">${escapeHtml(field.label)}<textarea name="${field.name}" maxlength="${field.max || 1000}" ${required}>${escapeHtml(safe)}</textarea></label>`;
  return `<label class="field ${full}">${escapeHtml(field.label)}<input name="${field.name}" type="${field.type || 'text'}" value="${escapeHtml(safe)}" ${field.step ? `step="${field.step}"` : ''} ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max ? `maxlength="${field.max}"` : ''} ${required}></label>`;
}

export function openForm({ title, eyebrow = 'Cadastro', fields, record = {}, submitLabel = 'Salvar', onSubmit }) {
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  document.querySelector('#modal-title').textContent = title;
  document.querySelector('#modal-eyebrow').textContent = eyebrow;
  document.querySelector('#modal-body').innerHTML = `<div class="modal-grid">${fields.map((field) => fieldMarkup(field, record[field.name])).join('')}</div>`;
  document.querySelector('#modal-error').textContent = '';
  document.querySelector('#modal-submit-label').textContent = submitLabel;
  const handler = async (event) => {
    event.preventDefault();
    const submit = document.querySelector('#modal-submit');
    submit.disabled = true;
    try {
      const rawValues = Object.fromEntries(new FormData(form));
      const errors = validateFormValues(rawValues, fields);
      if (errors.length) throw new Error(errors[0]);
      const values = normalizeFormValues(rawValues, fields);
      await onSubmit(values);
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

export async function confirmAction(message, action) {
  if (!window.confirm(message)) return false;
  await action();
  return true;
}
