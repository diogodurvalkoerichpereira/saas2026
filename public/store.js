const params = new URLSearchParams(location.search);
const companyId = Number(params.get('company') || 1);
const root = document.querySelector('#store-root');
const drawer = document.querySelector('#cart-drawer');
let catalog;
let site;
let cart = JSON.parse(localStorage.getItem(`store_cart_${companyId}`) || '[]');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
async function api(path, options = {}) {
  const response = await fetch(path, { method: options.method || 'GET', headers: options.body ? { 'content-type': 'application/json' } : {}, body: options.body ? JSON.stringify(options.body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
  return payload;
}
function saveCart() { localStorage.setItem(`store_cart_${companyId}`, JSON.stringify(cart)); renderCart(); }
function itemKey(item) { return `${item.kind}:${item.itemId}`; }
function addItem(item) {
  const existing = cart.find((entry) => itemKey(entry) === itemKey(item));
  if (existing) existing.quantity += 1; else cart.push({ ...item, quantity: 1 });
  saveCart(); drawer.hidden = false;
}
function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelector('#cart-count').textContent = count;
  document.querySelector('#cart-button').hidden = !catalog;
  document.querySelector('#cart-lines').innerHTML = cart.length ? cart.map((item) => `<div class="cart-line"><div><strong>${esc(item.name)}</strong><small class="muted">${money(item.price)} cada</small></div><input type="number" min="1" max="999" value="${item.quantity}" data-qty="${esc(itemKey(item))}"><button class="button danger small" data-remove="${esc(itemKey(item))}">Remover</button></div>`).join('') : '<div class="empty">O carrinho está vazio.</div>';
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.querySelector('#cart-total').textContent = `Subtotal: ${money(total)}`;
  document.querySelectorAll('[data-qty]').forEach((input) => input.addEventListener('change', () => { const item = cart.find((entry) => itemKey(entry) === input.dataset.qty); item.quantity = Math.max(1, Number(input.value) || 1); saveCart(); }));
  document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { cart = cart.filter((item) => itemKey(item) !== button.dataset.remove); saveCart(); }));
}
function renderStore() {
  const title = site.site.titulo || site.company.nome;
  document.title = `${title} · Loja`;
  document.querySelector('#store-name').textContent = site.config.nome || site.company.nome;
  document.querySelector('#store-phone').textContent = site.config.telefone || '';
  const products = catalog.products.map((item) => ({ ...item, kind: 'product', itemId: item.id, price: Number(item.valor_promocional || item.valor_venda), name: item.nome }));
  const services = catalog.services.map((item) => ({ ...item, kind: 'service', itemId: item.id, price: Number(item.valor), name: item.nome }));
  const items = [...products, ...services];
  root.innerHTML = `<section class="hero"><p>Catálogo online</p><h1>${esc(title)}</h1><p>${esc(site.site.subtitulo || site.site.descricao_site || 'Produtos e serviços selecionados para você.')}</p></section>
    <section><div class="page-header" style="margin-top:28px"><div><h2>Catálogo</h2><p>${items.length} opções disponíveis</p></div></div>
      <div class="catalog">${items.length ? items.map((item) => `<article class="card product"><small>${item.kind === 'product' ? esc(item.categoria_nome || 'Produto') : 'Serviço'}</small><h3>${esc(item.name)}</h3><p class="muted">${esc(item.descricao || 'Sem descrição informada.')}</p><div class="price">${money(item.price)}</div><button class="button primary" data-add="${esc(itemKey(item))}">Adicionar ao carrinho</button></article>`).join('') : '<div class="empty">Nenhum item publicado.</div>'}</div>
    </section>
    ${site.features.length ? `<section class="features">${site.features.map((feature) => `<article class="card"><strong>${esc(feature.titulo_recurso)}</strong><p class="muted">${esc(feature.descricao_recurso)}</p></article>`).join('')}</section>` : ''}
    ${site.faqs.length ? `<section><h2>${esc(site.site.titulo_perguntas || 'Dúvidas frequentes')}</h2>${site.faqs.map((faq) => `<details class="card faq"><summary>${esc(faq.titulo_pergunta)}</summary><p>${esc(faq.descricao_pergunta)}</p></details>`).join('')}</section>` : ''}`;
  const byKey = new Map(items.map((item) => [itemKey(item), item]));
  root.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => addItem(byKey.get(button.dataset.add))));
  document.querySelector('#store-payment').innerHTML = catalog.paymentMethods.map((method) => `<option value="${method.id}">${esc(method.nome)}</option>`).join('');
  renderCart();
}
document.querySelector('#cart-button').addEventListener('click', () => { drawer.hidden = false; });
document.querySelector('#cart-close').addEventListener('click', () => { drawer.hidden = true; });
document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const errorNode = document.querySelector('#checkout-error'); errorNode.textContent = '';
  if (!cart.length) { errorNode.textContent = 'Adicione pelo menos um item.'; return; }
  const form = Object.fromEntries(new FormData(event.currentTarget));
  const body = {
    customer: { name: form.name, email: form.email, phone: form.phone, document: form.document || undefined, address: form.address || undefined, number: form.number || undefined, city: form.city || undefined, state: form.state || undefined, zipCode: form.zipCode || undefined },
    items: cart.map(({ kind, itemId, quantity }) => ({ kind, itemId, quantity })),
    paymentMethodId: Number(form.paymentMethodId), coupon: form.coupon || undefined, notes: form.notes || undefined
  };
  const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const order = await api(`/api/public/${companyId}/checkout`, { method: 'POST', body });
    cart = []; saveCart(); drawer.hidden = true;
    const trackingUrl = `${location.origin}/store.html?company=${companyId}&order=${order.trackingToken}`;
    document.querySelector('#order-result').innerHTML = `<p>Pedido <strong>#${order.orderId}</strong> registrado com sucesso.</p><p>Total: <strong>${money(order.total)}</strong></p><p>Situação: ${esc(order.status)}</p><p class="muted">Nenhum pagamento externo foi processado neste ambiente. A empresa seguirá com as orientações.</p><label class="field">Link de acompanhamento<input value="${esc(trackingUrl)}" readonly></label>`;
    document.querySelector('#order-modal').showModal();
  } catch (error) { errorNode.textContent = error.message; } finally { button.disabled = false; }
});

async function init() {
  try {
    [site, catalog] = await Promise.all([api(`/api/public/${companyId}/site`), api(`/api/public/${companyId}/catalog`)]);
    renderStore();
    const trackingToken = params.get('order');
    if (trackingToken) {
      const order = await api(`/api/public/orders/${encodeURIComponent(trackingToken)}`);
      document.querySelector('#order-result').innerHTML = `<p>Pedido <strong>#${order.id}</strong></p><p>Total: <strong>${money(order.total)}</strong></p><p>Situação: ${esc(order.status)}</p><p>Pagamento: ${esc(order.pago || 'Não')}</p>`;
      document.querySelector('#order-modal').showModal();
    }
  } catch (error) { root.innerHTML = `<div class="empty error">${esc(error.message)}</div>`; }
}
init();
