const allowed = new Set([
  'menu', 'dashboard', 'clients', 'user', 'truck', 'box', 'wrench', 'inventory',
  'cart', 'clipboard', 'clipboard-check', 'wallet', 'logout', 'close', 'plus',
  'edit', 'power', 'refresh', 'shield', 'filter', 'chevron-left',
  'chevron-right', 'check', 'trash'
]);

export function icon(name, className = 'ui-icon') {
  const safeName = allowed.has(name) ? name : 'dashboard';
  return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="/icons.svg#${safeName}"></use></svg>`;
}
