const grid = document.querySelector('#plans-grid');
const modal = document.querySelector('#sub-modal');
const form = document.querySelector('#sub-form');
const successBox = document.querySelector('#sub-success');
const errorEl = document.querySelector('#sub-error');
const planName = document.querySelector('#sub-plan-name');
const planPrice = document.querySelector('#sub-plan-price');

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 0 ou vazio = ilimitado (mesma regra do backend).
const limitLabel = (value, unit) => (Number(value) > 0 ? `${value} ${unit}` : `${unit} ilimitados`);

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

function planCard(plan, popular) {
  const limits = [limitLabel(plan.usuarios, 'usuários'), limitLabel(plan.clientes, 'clientes')].join(' · ');
  return `<article class="plan-card${popular ? ' popular' : ''}">
    ${popular ? '<span class="plan-ribbon">Mais popular</span>' : ''}
    <div class="plan-name">${esc(plan.nome)}</div>
    <div class="plan-price">${money(plan.valor)}<small> /mês</small></div>
    <div class="plan-trial">3 dias grátis para testar</div>
    ${plan.itens && plan.itens.length ? `<ul class="plan-items">${plan.itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    <p class="plan-limits">${esc(limits)}</p>
    <div class="cta"><button class="btn ${popular ? 'ghost' : 'ghost'}" data-plan="${plan.id}" data-nome="${esc(plan.nome)}" data-valor="${esc(plan.valor)}">Assinar ${esc(plan.nome)}</button></div>
  </article>`;
}

function openSubscribe(planId, nome, valor) {
  form.hidden = false;
  successBox.hidden = true;
  successBox.innerHTML = '';
  form.reset();
  errorEl.textContent = '';
  document.querySelector('#sub-plan-id').value = planId;
  planName.textContent = nome;
  planPrice.innerHTML = `${money(valor)}<small> /mês</small>`;
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
      <h2 style="margin:0">Conta criada! 🎉</h2>
      <p class="muted">Sua conta do plano <strong>${esc(result.plano.nome)}</strong> foi criada com 3 dias de teste grátis.</p>
      <div class="cred-box">
        <div>Acesso: <code>${esc(result.email)}</code></div>
        <div>Senha temporária: <code>${esc(result.tempPassword)}</code></div>
        <div class="muted">Guarde esta senha e troque no primeiro acesso.</div>
      </div>
      ${result.mensalidade ? `<p class="muted">Primeira mensalidade de <strong>${money(result.mensalidade.valor)}</strong> gerada como pendente — a cobrança acontece após o período de teste.</p>` : ''}
      <a class="btn primary" href="/index.html?acesso=1">Acessar o sistema</a>`;
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function load() {
  try {
    const plans = await api('/api/public/plans');
    if (!plans.length) { grid.innerHTML = '<p class="muted">Nenhum plano disponível no momento.</p>'; return; }
    // Destaca o "Profissional" como mais popular; se não houver, o segundo plano.
    let popularIndex = plans.findIndex((p) => /profissional/i.test(p.nome));
    if (popularIndex < 0) popularIndex = plans.length > 2 ? 1 : -1;
    grid.innerHTML = plans.map((plan, index) => planCard(plan, index === popularIndex)).join('');
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
