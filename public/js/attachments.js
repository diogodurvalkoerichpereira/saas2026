import { api, uploadAttachment, downloadAttachment } from './api.js';
import { escapeHtml, date } from './format.mjs';
import { icon } from './icons.mjs';
import { toast } from './ui.js';

export function attachmentButton(entity, id) {
  return `<button class="button ghost small" data-action="attachments" data-attachments="${escapeHtml(entity)}" data-attachment-id="${id}">${icon('file-text')}Anexos</button>`;
}

export async function openAttachments({ entity, id, title }) {
  const dialog = document.querySelector('#app-modal');
  const form = document.querySelector('#modal-form');
  const body = document.querySelector('#modal-body');
  document.querySelector('#modal-title').textContent = `Anexos · ${title}`;
  document.querySelector('#modal-eyebrow').textContent = 'Arquivos seguros';
  document.querySelector('#modal-submit-label').textContent = 'Enviar arquivo';
  document.querySelector('#modal-error').textContent = '';

  const load = async () => {
    const result = await api(`/api/files/${entity}/${id}`);
    body.innerHTML = `<label class="field full">Arquivo (até 8 MB)
      <input type="file" name="attachment" required accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.xls,.xlsx,.mp3,.ogg,.wav">
      <small class="muted">PDF, imagens, planilhas, texto ou áudio. O nome interno nunca é exposto.</small>
    </label>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Arquivo</th><th>Tipo</th><th>Tamanho</th><th>Data</th><th>Ações</th></tr></thead><tbody>
      ${result.items.length ? result.items.map((item) => `<tr><td>${escapeHtml(item.nome_original)}</td><td>${escapeHtml(item.mime_type)}</td><td>${(Number(item.tamanho) / 1024).toFixed(1)} KB</td><td>${date(item.criado_em)}</td><td class="actions"><button type="button" class="button ghost small" data-download="${item.id}" data-name="${escapeHtml(item.nome_original)}">${icon('download')}Baixar</button><button type="button" class="button danger small" data-remove="${item.id}">${icon('trash')}Excluir</button></td></tr>`).join('') : '<tr><td colspan="5">Nenhum arquivo anexado.</td></tr>'}
    </tbody></table></div>`;
    body.querySelectorAll('[data-download]').forEach((button) => button.addEventListener('click', async () => {
      try { await downloadAttachment(`/api/files/${entity}/${id}/${button.dataset.download}/download`, button.dataset.name); }
      catch (error) { document.querySelector('#modal-error').textContent = error.message; }
    }));
    body.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Excluir este anexo?')) return;
      try {
        await api(`/api/files/${entity}/${id}/${button.dataset.remove}`, { method: 'DELETE', body: { reason: 'Exclusão pela interface' } });
        toast('Anexo excluído.');
        await load();
      } catch (error) { document.querySelector('#modal-error').textContent = error.message; }
    }));
  };
  await load();
  const handler = async (event) => {
    event.preventDefault();
    const file = form.querySelector('[name="attachment"]')?.files?.[0];
    if (!file) return;
    const submit = document.querySelector('#modal-submit');
    submit.disabled = true;
    try {
      await uploadAttachment(`/api/files/${entity}/${id}`, file);
      toast('Arquivo anexado.');
      await load();
    } catch (error) { document.querySelector('#modal-error').textContent = error.message; }
    finally { submit.disabled = false; }
  };
  if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
  form._submitHandler = handler;
  form.addEventListener('submit', handler);
  dialog.addEventListener('close', () => { document.querySelector('#modal-submit-label').textContent = 'Salvar'; }, { once: true });
  dialog.showModal();
}
