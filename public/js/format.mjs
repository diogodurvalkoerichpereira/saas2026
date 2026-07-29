export const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
export const number = (value) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));
export function date(value) {
  const raw = String(value || '').slice(0, 10);
  if (!raw || raw === '0000-00-00' || raw === '1111-11-11') return 'Não informado';
  const [year, month, day] = raw.split('-');
  return year && month && day ? `${day}/${month}/${year}` : 'Não informado';
}
export const text = (value) => value === null || value === undefined || value === '' ? 'Não informado' : String(value);
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
export function badge(value) {
  const label = text(value);
  const normalized = label.toLocaleLowerCase('pt-BR');
  const tone = ['sim', 'ativo', 'aprovado', 'entregue', 'finalizada'].some((item) => normalized.includes(item)) ? 'success'
    : ['não', 'cancel', 'reprovado', 'inativo'].some((item) => normalized.includes(item)) ? 'danger'
      : 'warning';
  return `<span class="badge ${tone}">${escapeHtml(label)}</span>`;
}
