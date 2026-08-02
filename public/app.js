import { api } from './js/api.js';
import { session } from './js/session.js';
import { startRouter } from './js/router.mjs';
import { renderRoute } from './js/pages.js';
import { toast, openForm } from './js/ui.js';
import { money, date, escapeHtml } from './js/format.mjs';

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');

// Destaca o item ativo (por rota + status) e abre o grupo que o contém.
function updateActiveNav(route) {
  const currentStatus = route.query?.status || '';
  let activeLink = null;
  document.querySelectorAll('.sidebar-nav a[data-route]').forEach((link) => {
    const match = link.dataset.route === route.name && (link.dataset.status || '') === currentStatus;
    link.classList.toggle('active', match);
    if (match) activeLink = link;
  });
  if (!activeLink) {
    activeLink = [...document.querySelectorAll('.sidebar-nav a[data-route]')].find((l) => l.dataset.route === route.name && !l.dataset.status) || null;
    if (activeLink) activeLink.classList.add('active');
  }
  document.querySelectorAll('.side-group').forEach((group) => group.classList.remove('active-group'));
  const group = activeLink?.closest('.side-group');
  if (group) group.classList.add('open', 'active-group');
}

// Esconde grupos cujos itens estão todos ocultos por permissão.
function hideEmptyGroups() {
  document.querySelectorAll('.side-group').forEach((group) => {
    const anyVisible = [...group.querySelectorAll('.side-group-list a')].some((a) => !a.hidden);
    group.hidden = !anyVisible;
  });
}

function setupSidebarGroups() {
  document.querySelectorAll('.side-group-toggle').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.side-group').classList.toggle('open'));
  });
}

function setupTheme() {
  document.documentElement.dataset.theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

function setupBells() {
  document.querySelectorAll('.nav-bell [data-bell-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = btn.parentElement.querySelector('.bell-menu');
      const wasOpen = !menu.hidden;
      document.querySelectorAll('.bell-menu').forEach((m) => { m.hidden = true; });
      menu.hidden = wasOpen;
    });
  });
  document.addEventListener('click', () => document.querySelectorAll('.bell-menu').forEach((m) => { m.hidden = true; }));
}

// Menu do usuário no topo (Configurações, Alterar senha, Sair) — abre/fecha como os sinos.
function setupProfileMenu() {
  const toggle = document.querySelector('[data-profile-toggle]');
  const menu = document.querySelector('#nav-profile .profile-menu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  });
  // Clicar num item (ou fora) fecha o menu; os handlers de cada item continuam nos seus ids.
  menu.addEventListener('click', () => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('click', () => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); });
}

function applyGreeting(user) {
  const el = document.querySelector('#topbar-greeting');
  if (!el) return;
  const hour = new Date().getHours();
  const saudacao = hour < 6 ? 'Boa madrugada' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const first = (user?.name || '').trim().split(/\s+/)[0] || 'Usuário';
  el.textContent = `${saudacao}, ${first}`;
}

function fillBell(container, payload, label) {
  if (!container || !payload) return;
  const count = payload.count || 0;
  const badge = container.querySelector('.bell-badge');
  const list = container.querySelector('.bell-list');
  container.hidden = false;
  badge.hidden = count === 0;
  badge.textContent = count > 99 ? '99+' : String(count);
  container.classList.toggle('has-alert', count > 0);
  list.innerHTML = payload.items && payload.items.length
    ? payload.items.map((item) => `<div class="bell-item"><strong>${escapeHtml(item.descricao || 'Conta')}</strong><span>${date(item.vencimento)} · ${money(item.valor)}</span></div>`).join('')
    : `<p class="bell-empty">Nenhuma conta ${label} vencida.</p>`;
}

async function loadFinanceAlerts() {
  const receivables = document.querySelector('#bell-receivables');
  const payables = document.querySelector('#bell-payables');
  if (!receivables && !payables) return;
  let data;
  try { data = await api('/api/finance/alerts'); } catch { return; }
  fillBell(receivables, data.receivables, 'a receber');
  fillBell(payables, data.payables, 'a pagar');
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  const user = session.user;
  document.querySelector('#sidebar-user-name').textContent = user?.name || 'Usuário';
  document.querySelector('#sidebar-user-role').textContent = user?.role || 'Perfil';
  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();
  document.querySelector('#user-avatar').textContent = initial;
  // Espelha os dados do usuário também no menu do topo (avatar + cabeçalho do dropdown).
  document.querySelector('#topbar-avatar').textContent = initial;
  document.querySelector('#profile-menu-name').textContent = user?.name || 'Usuário';
  document.querySelector('#profile-menu-role').textContent = user?.role || 'Perfil';
  const permissions = new Set(user?.permissions || []);
  document.querySelectorAll('[data-permission]').forEach((element) => {
    const accepted = element.dataset.permission.split(',').map((value) => value.trim());
    element.hidden = user?.role !== 'Administrador' && !accepted.some((key) => permissions.has(key));
  });
  hideEmptyGroups();
  applyGreeting(user);
  loadFinanceAlerts();
  if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
  startRouter(async (route) => {
    updateActiveNav(route);
    document.querySelector('#page-title').textContent = route.title;
    document.querySelector('#breadcrumb-current').textContent = route.title;
    await renderRoute(route);
    document.querySelector('#page-root').focus({ preventScroll: true });
    if (innerWidth <= 700) document.querySelector('#sidebar').classList.remove('open');
  });
}

async function doLogin(email, password) {
  loginError.textContent = '';
  const button = loginForm.querySelector('button');
  button.disabled = true;
  try {
    const result = await api('/api/auth/login', { method: 'POST', body: { email, password }, authenticated: false });
    if (Number(result.user.companyId) === 0) {
      sessionStorage.setItem('admin_session', JSON.stringify(result));
      location.assign('/admin.html');
      return;
    }
    session.set(result);
    showApp();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(loginForm));
  doLogin(data.email, data.password);
});

// Acesso rápido (fase de teste): botões que entram com cada perfil em um clique. O backend só
// devolve algo quando os usuários de teste existem e SHOW_TEST_LOGINS não está desligado.
async function setupQuickLogin() {
  const box = document.querySelector('#quick-login');
  const list = document.querySelector('#quick-login-list');
  if (!box || !list) return;
  try {
    const { users } = await api('/api/auth/test-logins', { authenticated: false });
    if (!users || !users.length) return;
    list.innerHTML = users.map((user, index) =>
      `<button type="button" class="quick-login-item" data-i="${index}"><strong>${escapeHtml(user.nivel)}${user.isSaas ? ' · SaaS' : ''}</strong><small>${escapeHtml(user.email)}</small></button>`
    ).join('');
    list.querySelectorAll('[data-i]').forEach((btn) => {
      const user = users[Number(btn.dataset.i)];
      btn.addEventListener('click', () => {
        // Preenche os campos (para o usuário ver o que entrou) e já autentica.
        loginForm.querySelector('[name=email]').value = user.email;
        loginForm.querySelector('[name=password]').value = user.password;
        doLogin(user.email, user.password);
      });
    });
    box.hidden = false;
  } catch { /* sem acesso rápido: segue o login normal */ }
}

document.querySelector('#change-password').addEventListener('click', () => {
  openForm({
    title: 'Alterar senha',
    eyebrow: 'Segurança',
    fields: [
      { name: 'currentPassword', label: 'Senha atual', type: 'password', required: true, full: true },
      { name: 'newPassword', label: 'Nova senha (mínimo 8 caracteres)', type: 'password', required: true, full: true }
    ],
    submitLabel: 'Salvar nova senha',
    onSubmit: async (values) => {
      await api('/api/users/me/password', { method: 'PATCH', body: values });
      toast('Senha alterada com sucesso.');
    }
  });
});
document.querySelector('#logout').addEventListener('click', () => {
  session.clear();
  location.hash = '';
  location.reload();
});
document.querySelector('#menu-toggle').addEventListener('click', (event) => {
  if (innerWidth <= 700) document.querySelector('#sidebar').classList.toggle('open');
  else document.body.classList.toggle('sidebar-collapsed');
  event.stopPropagation();
});
// No celular, tocar fora da sidebar aberta fecha o menu (o hambúrguer fica coberto por ela).
document.addEventListener('click', (event) => {
  if (innerWidth > 700) return;
  const sidebar = document.querySelector('#sidebar');
  if (sidebar.classList.contains('open') && !sidebar.contains(event.target)) {
    sidebar.classList.remove('open');
  }
});
document.querySelectorAll('[data-modal-close]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector('#app-modal').close());
});
window.addEventListener('auth:expired', () => {
  session.clear();
  toast('Sua sessão expirou. Entre novamente.', 'error');
  setTimeout(() => location.reload(), 900);
});

// Página de entrada (legado pagina_entrada): visitante não logado vê o Site ou a tela de Login.
// Com ?acesso na URL, sempre mostra o login (para acessar o sistema a partir do site).
async function bootstrapEntry() {
  if (new URLSearchParams(location.search).has('acesso')) return;
  try {
    const entry = await api('/api/public/entry', { authenticated: false });
    if (entry?.paginaEntrada === 'Site') location.replace('/planos.html');
  } catch { /* mantém a tela de login */ }
}

setupSidebarGroups();
setupBells();
setupProfileMenu();
setupTheme();

if (session.token && session.user) showApp();
else { bootstrapEntry(); setupQuickLogin(); }
