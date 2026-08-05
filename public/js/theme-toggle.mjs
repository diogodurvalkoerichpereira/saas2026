// Seletor de tema compartilhado (Claro / Magenta) para as páginas que não usam
// o app.js do ERP: portal, loja, admin e planos. Fonte única da lógica.
// Padrão: escuro (magenta). Persiste a escolha em localStorage['theme'].
const KEY = 'theme';
const root = document.documentElement;

// Aplica o tema o quanto antes (o CSS já assume escuro por padrão via
// :root:not([data-theme="light"]), então não há flash para o tema claro/verde).
root.dataset.theme = localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
root.dataset.accent = localStorage.getItem('accent') || 'magenta';

function wire() {
  const button = document.querySelector('#theme-toggle');
  if (!button) return;
  button.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    localStorage.setItem(KEY, next);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
