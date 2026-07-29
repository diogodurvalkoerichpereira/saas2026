# Plano de Integração de Nota Fiscal

## Objetivo

Adicionar emissão, consulta, cancelamento e armazenamento de documentos fiscais ao ERP migrado para Node.js.

## Decisões iniciais necessárias

- Definir o tipo de documento: NFS-e para serviços, NF-e para mercadorias ou ambos.
- Confirmar municípios, estados, CNPJ emitente e regimes tributários atendidos.
- Escolher um provedor fiscal com ambiente de homologação e produção.
- Definir quem informa certificado digital, inscrições fiscais e regras tributárias.

## Arquitetura proposta

- Módulo `fiscal` isolado na API Node.js.
- Adaptador de provedor para não acoplar a regra de negócio a uma única empresa fiscal.
- Fila para emissão e consulta assíncronas, evitando travar vendas ou ordens de serviço.
- Registro de solicitações, respostas, XML, PDF, chave de acesso e eventos no banco MySQL.
- Segredos e certificados fora do repositório, em variáveis de ambiente ou cofre de segredos.

## Etapas

1. Levantar os campos fiscais disponíveis em clientes, produtos, serviços, empresas e vendas.
2. Criar tabelas para configurações fiscais, documentos, itens, eventos e tentativas de emissão.
3. Implementar validação dos dados obrigatórios antes do envio ao provedor.
4. Implementar emissão em homologação e guardar o retorno completo de cada solicitação.
5. Adicionar consulta de status, cancelamento e reprocessamento seguro.
6. Exibir documentos e status nas telas de vendas, ordens de serviço e financeiro.
7. Executar testes com cenários de sucesso, rejeição, indisponibilidade e duplicidade.
8. Validar com contador ou responsável fiscal antes de habilitar produção.

## Critérios de aceite

- Uma venda ou ordem de serviço elegível gera documento fiscal sem duplicidade.
- Falhas não apagam a operação comercial e podem ser reprocessadas.
- XML e representação em PDF ficam acessíveis somente a usuários autorizados.
- Cancelamentos e alterações são auditáveis.
- Nenhuma credencial fiscal fica versionada no Git.

## Riscos

- Regras fiscais variam por tipo de nota, município, estado e regime tributário.
- Dados legados podem não ter todos os campos exigidos para emissão.
- Certificado digital, ambiente de homologação e autorização fiscal precisam ser fornecidos pelo emissor.
