'use strict';

// Recursos (features do plano) — o segundo controle de acesso, por EMPRESA/assinatura, ao lado das
// permissões por perfil. Ver PLANOS_E_RECURSOS.md.
//
// CORE: recursos sempre disponíveis em qualquer plano — o núcleo do ERP. Nunca bloqueiam.
// PREMIUM: recursos que os planos dividem; bloqueáveis quando a empresa não os tem.

const CORE = new Set([
  'dashboard', 'clientes', 'fornecedores', 'produtos_servicos', 'vendas_pdv', 'estoque',
  'financeiro', 'cadastros_auxiliares', 'usuarios', 'configuracoes', 'relatorios', 'anexos',
  'tarefas', 'anotacoes', 'assinatura', 'tutoriais', 'site', 'comercial'
]);

const PREMIUM = new Set([
  'chamados', 'comissoes', 'cupons', 'compras', 'marketing', 'orcamentos', 'ordens_servico',
  'cobrancas_recorrentes', 'contratos', 'fiscal', 'portal_cliente', 'loja_online',
  'recursos_humanos', 'auditoria'
]);

const isCore = (chave) => CORE.has(chave);

// Recursos efetivos da empresa = os contratados no plano ∪ o núcleo.
const effectiveResources = (companyChaves = []) => new Set([...CORE, ...companyChaves]);

module.exports = { CORE, PREMIUM, isCore, effectiveResources };
