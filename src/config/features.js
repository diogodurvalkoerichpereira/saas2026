'use strict';

// Recursos (features do plano) — o segundo controle de acesso, por EMPRESA/assinatura, ao lado das
// permissões por perfil. Ver PLANOS_E_RECURSOS.md.
//
// CORE: recursos sempre disponíveis em qualquer plano — o núcleo do ERP. Nunca bloqueiam.
// PREMIUM: recursos que os planos dividem; bloqueáveis quando a empresa não os tem.

// Núcleo MÍNIMO: sempre disponível, mesmo num plano que não habilita nada — só o suficiente para o
// usuário entrar, ver a tela inicial e a própria assinatura (para poder fazer upgrade). TODO o
// resto (clientes, vendas, financeiro, estoque, produtos, relatórios, etc.) é decidido pelo plano:
// o que o administrador marcar é exatamente o que a empresa recebe.
const CORE = new Set(['dashboard', 'assinatura']);

// Recursos controlados pelo plano. Praticamente todo o catálogo — o núcleo acima é a única exceção.
const PREMIUM = new Set([
  'comercial', 'clientes', 'fornecedores', 'produtos_servicos', 'vendas_pdv', 'estoque',
  'financeiro', 'cadastros_auxiliares', 'usuarios', 'configuracoes', 'relatorios', 'anexos',
  'tarefas', 'anotacoes', 'site', 'tutoriais',
  'chamados', 'comissoes', 'cupons', 'compras', 'marketing', 'orcamentos', 'ordens_servico',
  'cobrancas_recorrentes', 'contratos', 'fiscal', 'portal_cliente', 'loja_online',
  'recursos_humanos', 'auditoria'
]);

const isCore = (chave) => CORE.has(chave);

// Recursos efetivos da empresa = os contratados no plano ∪ o núcleo.
const effectiveResources = (companyChaves = []) => new Set([...CORE, ...companyChaves]);

module.exports = { CORE, PREMIUM, isCore, effectiveResources };
