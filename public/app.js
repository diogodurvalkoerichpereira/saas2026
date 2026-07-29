import { api } from './js/api.js';
import { session } from './js/session.js';
import { startRouter } from './js/router.mjs';
import { renderRoute } from './js/pages.js';
import { toast } from './js/ui.js';

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  const user = session.user;
  document.querySelector('#sidebar-user-name').textContent = user?.name || 'Usuário';
  document.querySelector('#sidebar-user-role').textContent = user?.role || 'Perfil';
  document.querySelector('#user-avatar').textContent = (user?.name || 'U').trim().charAt(0).toUpperCase();
  if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
  startRouter(async (route) => {
    document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === route.name));
    document.querySelector('#page-title').textContent = route.title;
    document.querySelector('#breadcrumb-current').textContent = route.title;
    await renderRoute(route);
    document.querySelector('#page-root').focus({ preventScroll: true });
    if (innerWidth <= 700) document.querySelector('#sidebar').classList.remove('open');
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const button = loginForm.querySelector('button');
  button.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(loginForm));
    const result = await api('/api/auth/login', { method: 'POST', body: data, authenticated: false });
    session.set(result);
    showApp();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#logout').addEventListener('click', () => {
  session.clear();
  location.hash = '';
  location.reload();
});
document.querySelector('#menu-toggle').addEventListener('click', () => {
  if (innerWidth <= 700) document.querySelector('#sidebar').classList.toggle('open');
  else document.body.classList.toggle('sidebar-collapsed');
});
document.querySelectorAll('[data-modal-close]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector('#app-modal').close());
});
window.addEventListener('auth:expired', () => {
  session.clear();
  toast('Sua sessão expirou. Entre novamente.', 'error');
  setTimeout(() => location.reload(), 900);
});

if (session.token && session.user) showApp();
