const grid = document.querySelector('#plans-grid');
const modal = document.querySelector('#sub-modal');
const form = document.querySelector('#sub-form');
const successBox = document.querySelector('#sub-success');
const errorEl = document.querySelector('#sub-error');
const planTag = document.querySelector('#sub-plan-tag');

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

function planCard(plan) {
  const limits = [
    plan.clientes ? `${plan.clientes} clientes` : null,
    plan.usuarios ? `${plan.usuarios} usuários` : null,
    plan.dispositivos ? `${plan.dispositivos} dispositivos` : null
  ].filter(Boolean).join(' · ');
  return `<article class="card plan-card">
    <div><strong>${esc(plan.nome)}</strong></div>
    <div class="plan-price">${money(plan.valor)}<small> /mês</small></div>
    ${plan.itens && plan.itens.length ? `<ul class="plan-items">${plan.itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    ${limits ? `<p class="plan-limits">${esc(limits)}</p>` : ''}
    <button class="button primary" data-plan="${plan.id}" data-nome="${esc(plan.nome)}" data-valor="${esc(plan.valor)}">Assinar</button>
  </article>`;
}

function openSubscribe(planId, nome, valor) {
  form.hidden = false;
  successBox.hidden = true;
  successBox.innerHTML = '';
  form.reset();
  errorEl.textContent = '';
  document.querySelector('#sub-plan-id').value = planId;
  planTag.textContent = `${nome} · ${money(valor)}/mês`;
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
      <h2 style="margin:0">Assinatura criada!</h2>
      <p class="muted">Sua conta do plano <strong>${esc(result.plano.nome)}</strong> foi criada com 3 dias de teste.</p>
      <div class="cred-box">
        <div>Acesso: <code>${esc(result.email)}</code></div>
        <div>Senha temporária: <code>${esc(result.tempPassword)}</code></div>
        <div class="muted">Troque a senha no primeiro acesso.</div>
      </div>
      ${result.mensalidade ? `<p class="muted">Primeira mensalidade de <strong>${money(result.mensalidade.valor)}</strong> gerada como pendente. O pagamento é feito após o acesso.</p>` : ''}
      <a class="button primary" href="/index.html?acesso=1" style="width:100%;text-align:center">Acessar o sistema</a>`;
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function load() {
  try {
    const plans = await api('/api/public/plans');
    grid.innerHTML = plans.length
      ? plans.map(planCard).join('')
      : '<p class="muted">Nenhum plano disponível no momento.</p>';
  } catch (error) {
    grid.innerHTML = `<p class="muted">Não foi possível carregar os planos: ${esc(error.message)}</p>`;
  }
}

grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-plan]');
  if (button) openSubscribe(button.dataset.plan, button.dataset.nome, button.dataset.valor);
});
form.addEventListener('submit', submitSubscribe);
modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
modal.addEventListener('click', (event) => { if (event.target === modal) modal.close(); });

load();
