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
  'online-orders': 'Pedidos online',
  finance: 'Financeiro',
  categories: 'Categorias',
  subcategories: 'Subcategorias',
  brands: 'Marcas',
  equipment: 'Equipamentos',
  models: 'Modelos',
  'payment-methods': 'Formas de pagamento',
  positions: 'Cargos',
  frequencies: 'Frequências',
  'account-plans': 'Plano de contas',
  coupons: 'Cupons',
  'contract-templates': 'Modelos de contrato',
  notes: 'Anotações',
  tasks: 'Tarefas',
  tickets: 'Chamados',
  marketing: 'WhatsApp e campanhas',
  cash: 'Caixas',
  purchases: 'Compras',
  recurring: 'Cobranças recorrentes',
  contracts: 'Contratos',
  commissions: 'Comissões',
  hr: 'Recursos humanos',
  settings: 'Configurações',
  subscription: 'Assinatura',
  site: 'Dados do site',
  tutorials: 'Tutoriais',
  reports: 'Relatórios'
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
