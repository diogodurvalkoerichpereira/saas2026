# Cobertura da migração

**Revisão:** 29 de julho de 2026, 17:09 (horário de Brasília).

## Escopo Node.js concluído nesta entrega

Todos os módulos atualmente expostos pela API Node.js têm uma interface operacional:

- autenticação, sessão, usuários, perfis e permissões;
- clientes, fornecedores, produtos e serviços;
- entradas e saídas imutáveis de estoque;
- vendas com vários itens, recebível, baixa e restauração transacional de estoque no cancelamento;
- contas a pagar e receber, com baixa, reabertura, cancelamento motivado e auditoria;
- ordens de serviço e orçamentos, com itens, responsáveis e transições de status;
- painel e resumos financeiro e operacional;
- cliente técnico para Asaas e WhatsApp, configurado somente por ambiente.

As listagens respeitam empresa, busca, filtros, ordenação e paginação. Datas sentinela do legado são tratadas como ausentes. Senhas e hashes não são devolvidos pelas APIs.

## Funcionalidades do PHP fora do escopo desta entrega

Esta entrega não declara paridade integral com todo o ERP PHP. Permanecem fora do conjunto atual de APIs Node.js:

- RH, folha, cargos e frequências;
- compras, cupons, comissões, caixa, sangria e conciliação;
- contratos, planos, assinaturas e mensalidades;
- chamados, tarefas, campanhas, site e tutoriais;
- anexos, impressão, PDFs e exportações avançadas;
- emissão fiscal, ainda dependente da escolha e homologação de um provedor;
- homologação real de Asaas/WhatsApp, webhooks e retentativas persistentes.

## Banco legado

O backup foi validado somente em MySQL local e descartável. Há valores vazios em colunas numéricas/de data que exigem saneamento antes de uma importação em modo estrito.

Antes de qualquer troca de produção:

1. restaurar uma cópia em ambiente isolado;
2. sanear valores incompatíveis;
3. importar novamente com modo estrito;
4. reconciliar contagens, estoque e totais financeiros;
5. homologar integrações externas;
6. executar os testes ponta a ponta e obter aceite funcional;
7. aprovar um plano de implantação e reversão.

Não foi realizado deploy em produção.
