# Memória do Projeto — Migração PHP para Node.js

## Objetivo

Migrar o ERP legado em PHP para Node.js, preservando as regras de negócio e separando responsabilidades entre API, acesso a dados, autenticação, tarefas agendadas e interface web.

## Fonte analisada

- Diretório de referência: `Arquivos Finalizados/erp`.
- Banco de dados: MySQL, acessado hoje por PDO.
- Arquitetura atual: páginas PHP misturam HTML, sessão, regras de negócio e consultas SQL.
- Configurações e credenciais estão centralizadas em `conexao.php`; a aplicação Node deve movê-las para variáveis de ambiente.

## Módulos identificados

- Autenticação, recuperação e alteração de senha.
- Administração e permissões de usuários.
- Clientes, fornecedores e arquivos associados.
- Produtos, serviços, carrinho, cupons e checkout.
- Financeiro: contas a pagar, a receber, caixa, cobranças, recorrências e parcelamentos.
- Planos, assinaturas, recursos e páginas públicas.
- Tarefas, agenda e vídeos.
- Relatórios, recibos e exportações.
- Integrações de pagamento e WhatsApp.
- Rotinas agendadas para alertas, aprovações e cobranças.

## Direção técnica adotada

- Node.js com Express para a API.
- MySQL mantido inicialmente para reduzir risco na migração de dados.
- Camadas: rotas, controladores, serviços, repositórios e validação.
- Autenticação baseada em sessão segura ou tokens, definida durante a implementação conforme compatibilidade necessária.
- Segredos e parâmetros de infraestrutura em `.env`, nunca no código.
- Jobs agendados isolados do servidor HTTP.
- Frontend preservado durante a primeira etapa, substituindo chamadas PHP por endpoints Node.js; uma modernização visual pode ocorrer depois sem bloquear a conversão funcional.

## Riscos e decisões pendentes

- Há centenas de arquivos PHP de aplicação e grande quantidade de ativos de terceiros; a conversão deve priorizar módulos e remover duplicações entre versões “iniciais” e “finalizadas”.
- É necessário confirmar se existe um dump do banco de dados e quais integrações externas ainda estão ativas antes de colocar a versão Node em produção.
- Credenciais encontradas no código legado não devem ser reaproveitadas nem enviadas ao repositório.

## Próxima etapa

Mapear as rotas e tabelas usadas pelo ERP finalizado, criar a base Node.js e migrar os módulos por domínio, começando por autenticação, usuários e configurações.
