# Plano de Integração de Nota Fiscal (NFS-e e NF-e)

## Objetivo

Emitir, consultar, cancelar, armazenar e imprimir documentos fiscais (NFS-e para serviço e NF-e para mercadoria) a partir das vendas e ordens de serviço do ERP, com integração oficial direta, sem provedor pago.

A impressão (DANFE para NF-e, DANFSE para NFS-e) é a última etapa e a mais simples. O esforço e o risco estão na emissão.

## Situação atual (levantamento em 2026-07-30)

O banco não possui nenhuma estrutura fiscal. Tudo precisa ser criado. Resumo do gap:

- Emitente (`empresas`): tem apenas `cpf`, endereço e contato. Faltam CNPJ, razão social, nome fantasia, inscrição estadual, inscrição municipal, regime tributário (CRT), CNAE e código IBGE do município.
- Cliente/tomador (`clientes`): tem apenas `cpf`. Faltam CNPJ, inscrição estadual, indicador de contribuinte (indIEDest) e código IBGE do município.
- Produto (`produtos`) e serviço (`servicos`): sem qualquer campo fiscal. Não há sequer um campo que classifique o item como serviço ou mercadoria. Faltam NCM, CEST, CFOP, origem, CST/CSOSN, unidade fiscal e alíquotas (ICMS, PIS, COFINS) para mercadoria; código da LC 116, alíquota de ISS e CNAE para serviço.
- Venda (`receber`, `itens_venda`): nenhum campo de retorno fiscal (número, série, chave de acesso, protocolo, status, XML).
- Não existem tabelas de documentos fiscais, controle de numeração/série, eventos fiscais, nem local para o certificado digital. A tabela `config` guarda tokens de integrações (WhatsApp, Asaas), mas nada fiscal.

O modelo de auditoria existente (`node_audit_log`) pode ser reutilizado para rastrear emissões e cancelamentos.

## Decisões já tomadas

- Emitir os dois documentos: NFS-e (serviço) e NF-e (mercadoria).
- Integração oficial direta, sem provedor fiscal pago ou de terceiros. Para NF-e, webservices da SEFAZ. Para NFS-e, Padrão Nacional da NFS-e (API do ambiente nacional) quando o município tiver aderido, ou webservice da prefeitura quando não tiver.
- Pré-requisitos fiscais informados como disponíveis (certificado digital A1, dados do emitente).
- Implementar NFS-e e NF-e em paralelo. Ressalva registrada: dobra o esforço e o risco iniciais e atrasa o primeiro documento emitido em homologação. Decisão do responsável.
- HML-first. Nada em produção sem homologação validada, GO explícito do responsável e validação do contador.

## Dados do emitente (confirmados em 2026-07-30)

- Município e UF: Palhoça/SC. Código IBGE 4211900 (a confirmar).
- Regime tributário: Simples Nacional. Implica CSOSN em vez de CST na NF-e, e marcação de optante pelo Simples com alíquota conforme o anexo na NFS-e.
- Operação: serviço. O catálogo hoje é de serviços, então a NFS-e é o documento efetivamente usado. A NF-e será construída conforme decidido (os dois em paralelo), mas não terá item para emitir enquanto não houver mercadoria cadastrada.
- Sistema de NFS-e do município: Palhoça emite pelo sistema Betha (portal e-gov.betha.com.br/e-nota), padrão de prefeitura da família ABRASF. Santa Catarina consta com 100% dos municípios conveniados ao Padrão Nacional, mas convênio para recebimento não é o mesmo que emissão pela API nacional.

## Via de emissão definida (2026-07-30)

- NFS-e: Padrão Nacional da NFS-e (API REST do SEFIN Nacional, ambiente de dados nacional em gov.br/nfse). Como o emitente é Simples Nacional e a partir de 2026 o Padrão Nacional passou a ser a via da NFS-e para o Simples, integramos direto com o ambiente nacional, sem depender do webservice proprietário do município (Betha ou AtendeNet, conflitantes nas fontes, e agora irrelevantes). É oficial, gratuito, documentado e com ambiente de homologação (produção restrita). O documento gerado pelo contribuinte é o DPS, que vira NFS-e após autorização.
- Homologação (produção restrita): SEFIN Nacional em sefin.producaorestrita.nfse.gov.br e ADN em adn.producaorestrita.nfse.gov.br. Confiança dos detalhes finos de layout e credenciais em torno de 75 por cento, a fechar na homologação com certificado real.
- NF-e: webservices da SEFAZ, leiaute 4.00, quando houver mercadoria cadastrada. No Simples usa CSOSN.

## Progresso

Fundação de dados:
- Migration migrations/003_fiscal.sql: campos fiscais em empresas, clientes, produtos (mercadoria e serviço) e servicos, e tabelas node_fiscal_config, node_fiscal_numeracao, node_fiscal_documentos, node_fiscal_documento_itens e node_fiscal_eventos. Certificado e senha ficam fora do banco. Ainda não aplicada em banco.

Backend do módulo fiscal (NFS-e Padrão Nacional):
- src/modules/fiscal/nfse-payload.js: montagem e validação do DPS. 7 testes em test/fiscal.payload.test.js.
- src/modules/fiscal/providers/nfse-nacional.js: leitura do certificado A1 do caminho protegido, assinatura XML-DSig (RSA-SHA256) e transmissão ao SEFIN Nacional. Assinatura validada em test/fiscal.signature.test.js com par descartável (3 testes), sem tocar no certificado real.
- src/modules/fiscal/fiscal.service.js: emitNfseFromSale (numeração atômica, persistência, documento fica pendente se o certificado não estiver no ambiente), config fiscal por empresa, consulta.
- src/modules/fiscal/fiscal.routes.js e registro em src/app.js sob /api/fiscal. Boot do app validado (require sem erro). Dependências novas: xml-crypto, @xmldom/xmldom, node-forge.
- Bibliotecas e algoritmos de assinatura padrão; layout do DPS e contrato de transporte com confiança ~75 por cento, a fechar contra o manual na homologação.

Pendências para emitir em homologação:
- Aplicar a migration no banco de desenvolvimento/homologação.
- Frontend: botão de emitir e imprimir NFS-e na venda e tela de configuração fiscal.
- Certificado A1 em pasta protegida do servidor e senha na variável de ambiente FISCAL_CERT_PASSWORD (responsabilidade do emissor).
- Nada em produção sem homologação validada, GO e validação do contador.

## Premissas assumidas (a confirmar pelo responsável fiscal ou contador)

- Emissão inicial somente em ambiente de homologação, sem valor fiscal.
- Certificado digital A1 fornecido em arquivo, armazenado cifrado fora do repositório, com a senha em variável de ambiente ou cofre. Certificado e senha nunca versionados nem trafegados em texto no chat.
- Cada empresa (multi-tenant por `empresa`) tem sua própria configuração fiscal e seu próprio certificado.
- A representação impressa (DANFE e DANFSE) é gerada a partir do XML autorizado; a numeração oficial só existe após autorização do fisco.

## Arquitetura proposta

- Módulo `fiscal` isolado na API, sem acoplar regra fiscal ao restante do ERP.
- Adaptador por tipo de documento e por autorizador (NF-e por UF; NFS-e por Padrão Nacional ou por padrão de prefeitura), para isolar as diferenças de layout e transporte.
- Assinatura digital do XML e transporte com o certificado A1 (TLS mútuo para SEFAZ; assinatura e credenciais conforme o padrão da NFS-e).
- Emissão assíncrona com fila e reprocesso seguro, para não travar a venda em caso de indisponibilidade do fisco. Falha na emissão não desfaz a operação comercial.
- Persistência do XML, do PDF, da chave de acesso, do protocolo e dos eventos. Numeração e série controladas por tabela própria, por empresa e por documento.
- Segredos e certificados fora do repositório.

## Modelo de dados proposto (migrations, a aplicar somente após aprovação)

Alterações em cadastros:
- `empresas`: cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, crt (regime), cnae, codigo_ibge.
- `clientes`: cnpj, inscricao_estadual, ind_ie_dest, codigo_ibge.
- `produtos`: tipo_fiscal (servico ou mercadoria), ncm, cest, cfop, origem, cst_csosn, unidade_fiscal, aliq_icms, aliq_pis, aliq_cofins.
- `servicos`: codigo_lc116, aliquota_iss, cnae, cst_iss.

Novas tabelas:
- `fiscal_config`: por empresa, ambiente (homologação ou produção), série corrente, referência ao certificado e demais parâmetros do autorizador.
- `fiscal_documentos`: empresa, tipo (nfe ou nfse), venda de origem, numero, serie, chave, protocolo, status, ambiente, caminho do XML e do PDF, datas.
- `fiscal_documento_itens`: itens fiscais com os valores e tributos calculados por item.
- `fiscal_eventos`: cancelamento, carta de correção e demais eventos, com XML e status.
- `fiscal_numeracao`: sequência por empresa, documento e série.

Certificado digital: armazenado cifrado, com referência em `fiscal_config`. Nunca em texto no banco nem no repositório.

## Fluxo de emissão por venda

1. Venda concluída dispara a elegibilidade fiscal (tipo do item, dados obrigatórios presentes).
2. Validação dos dados obrigatórios do emitente, do tomador ou destinatário e dos itens. Faltando dado, a venda continua válida e o documento fica pendente com o motivo.
3. Montagem do payload, cálculo dos tributos, assinatura e transmissão ao ambiente de homologação.
4. Tratamento do retorno: autorizado, rejeitado ou pendente. Persistência do XML, do PDF, da chave e do protocolo.
5. Exibição do status na tela da venda e botão para imprimir ou baixar o DANFE ou o DANFSE.
6. Eventos: cancelamento e correção, auditáveis.

## Fases

- Fase 0. Fundação. Aplicar as três definições pendentes, criar as migrations de cadastro, a tela de configuração fiscal por empresa e o cadastro seguro do certificado. Ambiente de homologação.
- Fase 1. NFS-e em homologação, ponta a ponta, para o município do emitente.
- Fase 2. NF-e em homologação, ponta a ponta, para a UF do emitente.
- Fase 3. Impressão do DANFE e do DANFSE, cancelamento, reprocesso e consulta de status.
- Fase 4. Validação com o contador, GO do responsável e habilitação de produção, documento a documento.

As Fases 1 e 2 correm em paralelo por decisão do responsável.

## Critérios de aceite

- Uma venda elegível gera documento fiscal em homologação sem duplicidade.
- Falha de emissão não apaga a operação comercial e pode ser reprocessada.
- XML e PDF acessíveis somente a usuários autorizados.
- Cancelamentos e correções auditáveis.
- Nenhuma credencial ou certificado fiscal versionado no Git.

## Riscos

- Regras fiscais variam por documento, município, estado e regime. A NFS-e depende do padrão adotado pelo município.
- Construir emissor oficial em Node, sem biblioteca madura equivalente à do ecossistema PHP, exige código próprio substancial e manutenção contínua dos leiautes.
- Certificado digital, ambiente de homologação e autorização fiscal são responsabilidade do emissor.
- Responsabilidade fiscal do que for emitido é da empresa. Produção somente após validação do contador.

## Gates ITS

- Premortem antes de iniciar a implementação.
- Security-review na área afetada (migrations, segredos e certificado, multi-tenant, auditoria).
- Pre-merge review antes de promover.
- Deploy-smoke após subir em homologação.

## Próximo passo

Fornecer as três definições pendentes. Com o município, verifico a adesão ao Padrão Nacional da NFS-e e destravo a Fase 1. Em seguida rodo o premortem e inicio a Fase 0 em homologação, com o plano aprovado.
