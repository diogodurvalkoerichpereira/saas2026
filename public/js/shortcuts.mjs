// Catálogo de atalhos do dashboard. Cada item declara a rota, a permissão do PERFIL e o recurso do
// PLANO — o mesmo par que o backend exige (permit + feature), para nunca oferecer um atalho que a
// API vai recusar. `chave` é o identificador salvo quando o usuário personaliza.
export const SHORTCUTS = [
  { chave: 'sales', titulo: 'Nova venda', desc: 'Abrir o PDV e registrar uma venda', href: '#/sales', icone: 'cart', permissao: 'vendas', recurso: 'vendas_pdv' },
  { chave: 'clients', titulo: 'Novo cliente', desc: 'Cadastrar um cliente', href: '#/clients', icone: 'clients', permissao: 'clientes', recurso: 'clientes' },
  { chave: 'products', titulo: 'Novo produto', desc: 'Cadastrar produto ou serviço', href: '#/products', icone: 'box', permissao: 'produtos', recurso: 'produtos_servicos' },
  { chave: 'receivables', titulo: 'Contas a receber', desc: 'Acompanhar recebimentos', href: '#/finance?type=receivables', icone: 'wallet', permissao: ['financeiro', 'receber'], recurso: 'financeiro' },
  { chave: 'payables', titulo: 'Contas a pagar', desc: 'Compromissos do período', href: '#/finance?type=payables', icone: 'wallet', permissao: ['financeiro', 'pagar'], recurso: 'financeiro' },
  { chave: 'inventory', titulo: 'Movimentar estoque', desc: 'Entradas e saídas', href: '#/inventory', icone: 'inventory', permissao: ['estoque', 'produtos'], recurso: 'estoque' },
  { chave: 'orders', titulo: 'Ordens de serviço', desc: 'Acompanhar as OS abertas', href: '#/orders', icone: 'clipboard-check', permissao: 'os', recurso: 'ordens_servico' },
  { chave: 'quotes', titulo: 'Orçamentos', desc: 'Criar e acompanhar propostas', href: '#/quotes', icone: 'clipboard', permissao: 'orcamentos', recurso: 'orcamentos' },
  { chave: 'cash', titulo: 'Caixa', desc: 'Abrir, conferir e fechar o caixa', href: '#/cash', icone: 'wallet', permissao: 'caixas', recurso: 'vendas_pdv' },
  { chave: 'purchases', titulo: 'Compras', desc: 'Registrar compra de fornecedor', href: '#/purchases', icone: 'truck', permissao: 'compras', recurso: 'compras' },
  { chave: 'marketing', titulo: 'Campanhas', desc: 'Disparos de WhatsApp', href: '#/marketing', icone: 'megaphone', permissao: ['marketing', 'grupos_disparos'], recurso: 'marketing' },
  { chave: 'tasks', titulo: 'Tarefas', desc: 'Agenda e pendências', href: '#/tasks', icone: 'calendar', permissao: ['tarefas', 'tarefas_clientes'], recurso: 'tarefas' },
  { chave: 'tickets', titulo: 'Chamados', desc: 'Suporte e atendimentos', href: '#/tickets', icone: 'help', permissao: 'chamados', recurso: 'chamados' },
  { chave: 'reports', titulo: 'Relatórios', desc: 'Vendas, financeiro e estoque', href: '#/reports', icone: 'file-text', permissao: ['rel_financeiro', 'rel_vendas', 'home'], recurso: 'relatorios' },
  { chave: 'suppliers', titulo: 'Fornecedores', desc: 'Cadastro de parceiros de compra', href: '#/suppliers', icone: 'truck', permissao: 'fornecedores', recurso: 'fornecedores' },
  { chave: 'contracts', titulo: 'Contratos', desc: 'Gerar e acompanhar contratos', href: '#/contracts', icone: 'clipboard', permissao: ['listar_contratos', 'rel_contratos'], recurso: 'contratos' },
  { chave: 'users', titulo: 'Usuários', desc: 'Acessos e permissões da equipe', href: '#/users', icone: 'user', permissao: 'usuarios', recurso: 'usuarios' },
  { chave: 'notes', titulo: 'Anotações', desc: 'Registros rápidos da equipe', href: '#/notes', icone: 'file-text', permissao: ['anotacoes', 'home'], recurso: 'anotacoes' }
];

// Quantos atalhos mostrar quando o usuário não personalizou.
export const AUTO_LIMIT = 8;

// Rota da URL (#/products?x=1) → chave do atalho, para contabilizar o uso.
export const routeToKey = (routeName, query = '') => {
  if (routeName === 'finance') return String(query).includes('payables') ? 'payables' : 'receivables';
  return SHORTCUTS.some((item) => item.chave === routeName) ? routeName : null;
};
