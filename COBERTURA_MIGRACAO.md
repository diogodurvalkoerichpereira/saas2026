# Cobertura da migração

**Revisão:** 29 de julho de 2026, 15:42 (horário de Brasília).

Este documento compara a base Node.js atual com os módulos identificados no ERP legado. “Base funcional” significa que há API e regra principal testada; não significa paridade completa de todas as telas e variações do sistema PHP.

## Base funcional validada

- Autenticação, usuários, perfis e permissões com isolamento por empresa.
- Clientes, fornecedores, produtos e serviços.
- Contas a pagar e receber, incluindo baixa protegida contra duplicidade.
- Vendas com itens, recebível e movimentação transacional de estoque.
- Entradas e saídas de estoque com bloqueio de saldo negativo.
- Consulta de ordens de serviço e orçamentos, com transições básicas de status.
- Resumos financeiro e operacional.
- Identificação de recebíveis vencidos.
- Clientes técnicos para Asaas e WhatsApp, sem credenciais no código.
- Frontend inicial de login e painel.

## Parcial, ainda sem paridade com o legado

- Vendas: faltam edição, cancelamento, descontos, cupons, comissões, múltiplas formas de pagamento e impressão.
- Estoque: faltam inventário, ajustes administrativos, compras e rastreabilidade completa.
- Ordens de serviço e orçamentos: faltam criação e edição completas, itens, equipamentos, anexos, impressão e conversões entre fluxos.
- Financeiro: faltam caixa, sangria, conciliação, cobranças, mensalidades, planos e contratos.
- Relatórios: faltam filtros avançados, exportação, PDFs e relatórios específicos do legado.
- Jobs: falta um agendador persistente, retentativas, auditoria e observabilidade.
- Integrações: faltam homologação em sandbox, webhooks, idempotência e tratamento de indisponibilidade.
- Frontend: faltam as telas operacionais dos módulos e testes ponta a ponta.

## Ainda não migrado

- Cargos, funcionários, frequências, RH e folha relacionada.
- Categorias, subcategorias, marcas, modelos, equipamentos e demais tabelas auxiliares.
- Chamados, anotações, tarefas e tarefas de clientes.
- Compras, cupons, comissões e comissões pessoais.
- Contratos, planos, assinaturas e mensalidades.
- Marketing e grupos de disparo.
- Dispositivos, conteúdo do site e tutoriais.
- Emissão fiscal. Existe apenas o plano em `PLANO_INTEGRACAO_NOTA_FISCAL.md`; o provedor e os requisitos fiscais ainda precisam ser definidos e homologados.

## Banco legado

O backup foi validado em um MySQL 8.4 local. Ele contém valores vazios em campos numéricos ou de data e, por isso, a importação de teste exigiu uma sessão sem modo estrito. Isso é uma característica dos dados legados, não uma recomendação para produção.

Antes da migração definitiva:

1. restaurar uma cópia em ambiente isolado;
2. inventariar os valores incompatíveis;
3. convertê-los para `NULL` ou valores válidos conforme a regra de negócio;
4. repetir a importação com o modo estrito habilitado;
5. comparar contagens e totais financeiros com a origem;
6. obter aceite funcional antes de qualquer troca de produção.

## Critério para considerar a migração completa

A migração só deve ser considerada completa quando os módulos necessários ao negócio tiverem paridade aprovada, os dados forem importáveis em modo estrito, os testes ponta a ponta passarem, as integrações forem homologadas e houver um plano de reversão aprovado. Nenhum merge em `main` ou deploy de produção faz parte desta entrega sem autorização explícita.
