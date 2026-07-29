const routes = {
  dashboard: 'Dashboard',
  clients: 'Clientes',
  users: 'Usuários',
  suppliers: 'Fornecedores',
  products: 'Produtos',
  services: 'Serviços',
  inventory: 'Estoque',
  sales: 'Vendas / PDV',
  quotes: 'Orçamentos',
  orders: 'Ordens de serviço',
  finance: 'Financeiro'
};

export function parseRoute(hash = location.hash) {
  const value = hash.replace(/^#\/?/, '');
  const [path = 'dashboard', queryString = ''] = value.split('?');
  const name = routes[path] ? path : 'dashboard';
  return { name, title: routes[name], query: Object.fromEntries(new URLSearchParams(queryString)) };
}

let started = false;
export function startRouter(render) {
  const run = () => render(parseRoute()).catch((error) => {
    document.querySelector('#page-root').innerHTML = `<div class="panel empty-state"><div><strong>Não foi possível abrir este módulo.</strong><p>${error.message}</p></div></div>`;
  });
  if (!started) window.addEventListener('hashchange', run);
  started = true;
  run();
}
