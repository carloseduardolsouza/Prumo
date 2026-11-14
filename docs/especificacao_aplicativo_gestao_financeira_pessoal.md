# Especificação Funcional e Técnica

## Aplicativo de Gestão Financeira Pessoal

**Versão:** 1.0\
**Data:** 14/11/2026\
**Status:** Documento inicial de requisitos\
**Idioma e moeda padrão:** Português (Brasil) / Real brasileiro (BRL)

------------------------------------------------------------------------

## 1. Visão geral

### 1.1. Objetivo

Desenvolver uma aplicação multiplataforma de gestão financeira pessoal
que permita ao usuário controlar, em um único ambiente, suas contas e
carteiras, receitas, despesas, cartões de crédito, compras parceladas,
financiamentos, empréstimos, consórcios, investimentos, metas e
patrimônio.

O aplicativo deverá consolidar informações financeiras e apresentar
tanto a situação atual quanto previsões de compromissos e fluxo de caixa
futuro. Os módulos deverão trabalhar de forma integrada, evitando
duplicidade de lançamentos e inconsistências de saldo.

### 1.2. Objetivos específicos

-   Registrar e acompanhar entradas, saídas e transferências.
-   Administrar saldos de diferentes carteiras e instituições.
-   Controlar cartões, limites, ciclos de fatura, compras e pagamentos.
-   Gerenciar despesas recorrentes e compromissos futuros.
-   Acompanhar dívidas, financiamentos e empréstimos.
-   Controlar contribuições, reajustes e recebimentos de consórcios.
-   Consolidar investimentos de diferentes classes e instituições.
-   Calcular patrimônio bruto, passivos e patrimônio líquido.
-   Criar orçamentos e metas financeiras.
-   Apresentar relatórios, indicadores e projeções.
-   Notificar o usuário sobre vencimentos, limites e metas.
-   Disponibilizar uma base preparada para integrações bancárias e
    cotações de mercado futuras.

### 1.3. Público-alvo

Pessoas que desejam organizar suas finanças pessoais, controlar contas
bancárias e dinheiro físico, acompanhar dívidas e parcelamentos,
planejar despesas futuras e monitorar investimentos.

### 1.4. Escopo

O produto deverá possuir: - Aplicativo para Android e iOS. - Aplicação
web responsiva. - Backend e API centralizados. - Banco de dados
relacional. - Autenticação e isolamento dos dados por usuário. -
Interface em português brasileiro e valores em BRL como configuração
inicial.

A arquitetura deverá permitir futuramente múltiplas moedas, importação
de extratos, Open Finance, cotações externas e recursos de inteligência
artificial.

### 1.5. Fora do escopo inicial

Não fazem parte obrigatória da primeira versão: - Movimentação de
dinheiro real entre bancos. - Emissão de cartões ou concessão de
crédito. - Execução de ordens de compra e venda de ativos. - Custódia de
criptomoedas ou outros ativos. - Consultoria financeira, tributária ou
de investimentos. - Integração bancária automática. - Sincronização
automática com todas as corretoras e administradoras de consórcio.

O aplicativo será inicialmente um sistema de registro e acompanhamento.
Integrações externas deverão ser adicionadas mediante análise técnica,
contratual e regulatória.

------------------------------------------------------------------------

## 2. Conceitos e terminologia

  -----------------------------------------------------------------------
  Termo                               Definição
  ----------------------------------- -----------------------------------
  Carteira                            Conta ou local onde o usuário
                                      mantém dinheiro, como banco, conta
                                      digital ou dinheiro físico.

  Movimentação                        Registro financeiro de entrada,
                                      saída, transferência, aporte,
                                      resgate ou liquidação.

  Receita                             Entrada financeira reconhecida pelo
                                      usuário.

  Despesa                             Consumo ou obrigação financeira
                                      reconhecida pelo usuário.

  Transferência                       Movimentação de valor entre duas
                                      carteiras próprias.

  Cartão                              Instrumento de crédito cadastrado
                                      para controle de limite e faturas.

  Fatura                              Conjunto de compras e ajustes
                                      associados a um ciclo de cartão.

  Compra parcelada                    Compra cujo valor é distribuído em
                                      duas ou mais parcelas.

  Compromisso futuro                  Pagamento ou recebimento previsto,
                                      ainda não efetivado.

  Financiamento                       Contrato de dívida com condições,
                                      juros e cronograma de amortização.

  Consórcio                           Participação em grupo com
                                      contribuições e eventual direito à
                                      carta de crédito, conforme
                                      contrato.

  Investimento                        Ativo ou aplicação acompanhada pelo
                                      usuário.

  Aporte                              Entrada de recursos em um
                                      investimento.

  Resgate                             Retirada de recursos de um
                                      investimento.

  Valorização                         Variação do valor de mercado ou
                                      valor estimado de um ativo.

  Patrimônio bruto                    Soma dos ativos registrados.

  Passivo                             Dívidas e obrigações ainda
                                      existentes.

  Patrimônio líquido                  Ativos menos passivos.

  Previsto                            Evento financeiro planejado, ainda
                                      não confirmado.

  Efetivado                           Evento financeiro realizado e
                                      confirmado.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 3. Perfis, autenticação e conta do usuário

### 3.1. Cadastro e autenticação

O sistema deverá permitir: - Cadastro com nome, e-mail e senha. -
Validação de e-mail. - Login e logout. - Recuperação e redefinição de
senha. - Encerramento de sessões. - Alteração de dados cadastrais. -
Exclusão da conta, observadas as obrigações legais de retenção. -
Autenticação em dois fatores, em versão compatível. - Exibição de
sessões e dispositivos conectados, quando suportado.

### 3.2. Preferências do usuário

O usuário poderá configurar: - Nome de exibição. - Moeda principal. -
Formato de data. - Fuso horário. - Primeiro dia da semana. - Tema claro,
escuro ou automático. - Preferências de notificações. - Categorias e
ícones personalizados. - Ocultação de valores financeiros em telas
públicas ou quando o aplicativo estiver em segundo plano.

### 3.3. Isolamento de dados

Cada usuário deverá acessar exclusivamente seus próprios dados. Toda
consulta, criação, alteração ou exclusão deverá validar a identidade e a
autorização do usuário no backend. A simples ocultação de dados na
interface não será considerada controle de segurança suficiente.

------------------------------------------------------------------------

## 4. Módulo de dashboard

### 4.1. Objetivo

Apresentar uma visão consolidada da situação financeira, permitindo
identificar rapidamente saldos, receitas, despesas, dívidas, faturas,
investimentos e compromissos futuros.

### 4.2. Indicadores

O dashboard deverá apresentar, conforme disponibilidade dos dados: -
Saldo total disponível nas carteiras. - Receitas efetivadas no
período. - Despesas efetivadas no período. - Resultado financeiro do
período. - Total investido e valor atual dos investimentos. - Patrimônio
bruto. - Total de passivos e dívidas. - Patrimônio líquido. - Total de
faturas abertas. - Total de parcelas e compromissos futuros. -
Percentual da renda comprometida. - Percentual do orçamento consumido.

### 4.3. Gráficos

-   Receitas versus despesas por mês.
-   Evolução dos saldos das carteiras.
-   Despesas por categoria.
-   Receitas por fonte.
-   Distribuição dos investimentos por classe.
-   Evolução do patrimônio líquido.
-   Evolução das dívidas.
-   Limite utilizado por cartão.
-   Fluxo de caixa previsto.

### 4.4. Filtros

Disponibilizar filtros para hoje, semana atual, mês atual, mês anterior,
últimos 3 meses, últimos 6 meses, ano atual e período personalizado.

### 4.5. Resumo de eventos

Exibir próximos vencimentos, recebimentos previstos, faturas, parcelas
de compras, financiamentos e consórcios. Eventos previstos deverão ser
visualmente diferentes dos efetivados.

------------------------------------------------------------------------

## 5. Módulo de carteiras

### 5.1. Objetivo

Controlar onde o usuário mantém seu dinheiro e apresentar o saldo
individual e consolidado.

### 5.2. Tipos de carteira

-   Banco tradicional.
-   Banco digital.
-   Conta corrente.
-   Conta poupança.
-   Conta de pagamento.
-   Carteira digital.
-   Dinheiro físico.
-   Conta internacional.
-   Outra carteira personalizada.

Exemplos de instituições poderão ser sugeridos, mas o usuário deverá
poder cadastrar qualquer instituição ou carteira.

### 5.3. Campos do cadastro

  ------------------------------------------------------------------------
  Campo                                  Obrigatório Descrição
  --------------------- ---------------------------- ---------------------
  Nome                                           Sim Nome identificador da
                                                     carteira.

  Tipo                                           Sim Tipo da carteira.

  Instituição                                    Não Banco ou instituição.

  Saldo inicial                                  Sim Saldo na data de
                                                     referência.

  Data do saldo inicial                          Sim Data a partir da qual
                                                     o saldo será
                                                     controlado.

  Moeda                                          Sim BRL por padrão.

  Cor                                            Não Cor de identificação.

  Ícone                                          Não Ícone de
                                                     identificação.

  Observações                                    Não Informações
                                                     complementares.

  Status                                         Sim Ativa ou arquivada.
  ------------------------------------------------------------------------

### 5.4. Funcionalidades

-   Criar, editar, consultar e arquivar carteiras.
-   Consultar saldo atual e histórico.
-   Consultar extrato por período.
-   Registrar entradas e saídas.
-   Transferir valores entre carteiras.
-   Filtrar por instituição, tipo e status.
-   Consultar evolução do saldo.
-   Identificar carteiras com saldo negativo, se permitido pela
    configuração.

### 5.5. Regras específicas

-   O saldo inicial deverá ser registrado como saldo de abertura, não
    como receita do período.
-   Uma transferência deverá gerar registros vinculados de saída e
    entrada.
-   Transferências entre carteiras próprias não poderão alterar o
    patrimônio total.
-   A soma das movimentações efetivadas deverá reconciliar com o saldo
    apresentado.
-   Carteiras arquivadas manterão seu histórico e não poderão receber
    novas movimentações comuns, salvo reativação ou ajuste autorizado.

------------------------------------------------------------------------

## 6. Módulo de cartões de crédito

### 6.1. Objetivo

Permitir cadastrar cartões, controlar limite total, limite comprometido,
limite disponível, ciclos de fechamento e vencimento, compras e faturas.

### 6.2. Cadastro do cartão

Campos: - Nome identificador. - Instituição emissora. - Bandeira. -
Titular. - Últimos quatro dígitos (opcional). - Limite total. - Dia de
fechamento. - Dia de vencimento. - Melhor dia de compra (calculado e
editável apenas se necessário). - Cor e ícone. - Status: ativo,
bloqueado, cancelado ou arquivado. - Observações.

Não armazenar número completo do cartão, código de segurança ou senha.

### 6.3. Controle de limite

O sistema deverá apresentar: - Limite total. - Limite comprometido. -
Limite disponível. - Percentual utilizado. - Comprometimento por compras
à vista. - Comprometimento por parcelas futuras. - Ajustes manuais de
limite, com justificativa e histórico.

A política de comprometimento deverá ser configurável para refletir o
comportamento do emissor. Como padrão de controle conservador, compras
parceladas poderão comprometer o valor das parcelas ainda não
liquidadas. O aplicativo deverá deixar claro que o limite exibido é uma
estimativa de controle e pode divergir do limite oficial do banco.

### 6.4. Faturas

Cada cartão deverá possuir faturas por ciclo, contendo: - Mês ou período
de referência. - Data de início do ciclo. - Data de fechamento. - Data
de vencimento. - Compras e ajustes vinculados. - Total da fatura. -
Total pago. - Saldo restante. - Situação: aberta, fechada, parcialmente
paga, paga, vencida ou cancelada.

### 6.5. Pagamento da fatura

Permitir: - Pagamento total. - Pagamento parcial. - Registro de
pagamento mínimo, quando aplicável. - Seleção da carteira de origem. -
Data efetiva do pagamento. - Inclusão de juros, multas e encargos. -
Histórico de pagamentos.

O pagamento deverá reduzir o saldo da carteira e liquidar a obrigação
correspondente. Não deverá gerar uma segunda despesa de consumo para
compras já reconhecidas na data da compra.

### 6.6. Compras no cartão

Campos: - Descrição. - Estabelecimento. - Categoria. - Cartão. - Data da
compra. - Valor total. - Quantidade de parcelas. - Valor das parcelas. -
Primeira fatura prevista. - Observações. - Anexo opcional de
comprovante.

Permitir compra à vista ou parcelada, estorno, cancelamento, ajuste e
consulta do histórico.

### 6.7. Parcelas

Cada parcela deverá conter: - Número da parcela. - Total de parcelas. -
Valor original. - Valor atualizado, se houver ajuste. - Fatura
associada. - Data prevista. - Data de pagamento da fatura. - Situação. -
Identificação da compra de origem.

O sistema deverá distribuir as parcelas nos ciclos de fatura de acordo
com a data da compra e o fechamento do cartão. Regras de compras
próximas ao fechamento deverão ser tratadas de forma consistente e
testável.

------------------------------------------------------------------------

## 7. Módulo de receitas e despesas

### 7.1. Objetivo

Registrar receitas e despesas pontuais ou recorrentes, permitindo
acompanhar valores previstos e realizados.

### 7.2. Fontes de renda

Exemplos: - Salário. - Freelance. - Prestação de serviços. - Comissão. -
Aluguel recebido. - Dividendos. - Rendimentos. - Bonificações. - Outras
receitas.

Campos: - Nome da fonte. - Categoria. - Descrição. - Valor previsto. -
Valor efetivo. - Data prevista. - Data efetiva. - Frequência. - Data
inicial e final. - Carteira de destino. - Status. - Observações.

### 7.3. Despesas

Exemplos de despesas fixas: - Internet. - Energia. - Água. - Aluguel. -
Parcela da casa. - Condomínio. - Plano de saúde. - Academia. -
Streaming. - Mensalidades.

Exemplos de despesas variáveis: - Alimentação. - Combustível. -
Restaurantes. - Compras. - Lazer. - Viagens. - Saúde. - Vestuário.

Campos: - Nome. - Categoria e subcategoria. - Descrição. - Valor
previsto. - Valor efetivo. - Data de competência. - Data de
vencimento. - Data efetiva do pagamento. - Frequência. - Carteira ou
cartão utilizado. - Status. - Anexos e observações.

### 7.4. Recorrência

Suportar: - Única. - Diária. - Semanal. - Quinzenal. - Mensal. -
Bimestral. - Trimestral. - Semestral. - Anual. - Personalizada.

A recorrência deverá permitir data inicial, data final ou quantidade de
ocorrências, dia de referência e tratamento para meses sem o dia
escolhido.

### 7.5. Categorias

Cada categoria deverá conter nome, tipo (receita ou despesa), ícone,
cor, categoria pai opcional e status. O usuário poderá criar categorias
e subcategorias personalizadas.

------------------------------------------------------------------------

## 8. Módulo de financiamentos e empréstimos

### 8.1. Objetivo

Controlar contratos de dívida, cronogramas de pagamento, amortizações,
juros e saldo devedor.

### 8.2. Tipos

-   Financiamento imobiliário.
-   Financiamento de veículo.
-   Empréstimo pessoal.
-   Empréstimo consignado.
-   Crédito estudantil.
-   Empréstimo particular.
-   Outros.

### 8.3. Cadastro

Campos: - Nome do contrato. - Credor ou instituição. - Tipo. - Valor
contratado. - Valor de entrada. - Valor financiado. - Taxa de juros e
periodicidade. - Sistema de amortização (SAC, Price ou outro). - CET,
quando conhecido. - Quantidade de parcelas. - Valor inicial da
parcela. - Data de contratação. - Data da primeira parcela. - Dia de
vencimento. - Carteira de pagamento. - Seguro, tarifas e encargos,
quando aplicáveis. - Documento ou contrato anexado. - Observações.

### 8.4. Cronograma e acompanhamento

Exibir: - Total contratado. - Total pago. - Principal amortizado. -
Juros pagos. - Encargos. - Saldo devedor estimado. - Parcelas pagas e
restantes. - Próximo vencimento. - Data estimada de quitação.

Permitir registrar pagamento, atraso, multa, juros, amortização
extraordinária, antecipação e quitação.

### 8.5. Cálculos

O saldo devedor deverá respeitar o sistema de amortização e os dados do
contrato. Se não houver informações suficientes, o sistema deverá
identificar o valor como estimado e permitir ajuste manual. Não deverá
apresentar uma estimativa como saldo oficial do credor.

------------------------------------------------------------------------

## 9. Módulo de consórcios

### 9.1. Objetivo

Acompanhar contratos de consórcio, contribuições, parcelas, reajustes,
contemplação e recebimento ou utilização da carta de crédito.

### 9.2. Cadastro

Campos: - Nome do consórcio. - Administradora. - Grupo e cota
(opcionais). - Tipo: imóvel, veículo, serviço ou outro. - Valor inicial
da carta. - Valor atual da carta. - Valor contratado. - Quantidade de
parcelas. - Valor da parcela atual. - Data de contratação. - Data da
primeira contribuição. - Dia de vencimento. - Taxa de administração. -
Fundo de reserva. - Seguro e outros encargos. - Índice ou regra de
reajuste contratual. - Carteira de pagamento. - Status: ativo,
contemplado, cancelado, encerrado. - Anexos e observações.

### 9.3. Parcelas e contribuições

Gerar cronograma de contribuições, permitindo: - Registrar pagamento. -
Registrar pagamento parcial, se aplicável. - Registrar atraso, multa e
juros. - Registrar antecipação. - Consultar parcelas pagas e
pendentes. - Registrar reajustes. - Consultar histórico de
contribuições.

### 9.4. Valorização da carta

O sistema deverá distinguir: 1. Total efetivamente pago pelo usuário. 2.
Valor atualizado da carta de crédito. 3. Reajuste ou valorização
estimada por período. 4. Saldo devedor ou obrigações restantes. 5. Valor
efetivamente recebido ou crédito utilizado.

O usuário poderá informar aumento mensal em reais ou percentual, com
data de início e término. O sistema deverá manter o histórico das
alterações e permitir registrar valores atualizados conforme extrato ou
informação da administradora.

A valorização da carta não deverá ser considerada dinheiro disponível,
receita realizada ou lucro automaticamente.

### 9.5. Contemplação e recebimento

Permitir registrar: - Data da contemplação. - Tipo de contemplação. -
Valor da carta liberada. - Data de liberação. - Data de recebimento ou
utilização. - Valor efetivamente recebido ou aplicado. - Bem adquirido,
se houver. - Saldo de obrigações após contemplação. - Documentos e
observações.

O fluxo de contemplação deverá respeitar as condições do contrato e não
presumir que a carta será paga em dinheiro livre ao consorciado.

------------------------------------------------------------------------

## 10. Módulo de investimentos

### 10.1. Objetivo

Consolidar investimentos e ativos patrimoniais, registrar aportes e
resgates, acompanhar valorização e calcular resultados.

### 10.2. Classes suportadas

**Renda fixa** - CDB. - LCI. - LCA. - Tesouro Direto. - Debêntures. -
Outros títulos.

**Renda variável** - Ações. - Fundos imobiliários (FIIs). - ETFs. -
BDRs.

**Criptoativos** - Bitcoin. - Ethereum. - Solana. - Outros criptoativos.

**Ativos físicos** - Ouro. - Prata. - Imóveis. - Terrenos. - Outros
bens.

**Investimentos próprios ou personalizados** - Participação em
empresas. - Negócios próprios. - Empréstimos particulares. - Outros
ativos informados pelo usuário.

### 10.3. Cadastro do investimento

Campos: - Nome. - Classe e categoria. - Código ou identificador do
ativo. - Instituição, corretora ou custodiante. - Data da primeira
aplicação ou aquisição. - Quantidade. - Preço médio. - Valor
investido. - Valor atual. - Moeda. - Liquidez e vencimento, quando
aplicável. - Taxa contratada ou indexador, quando aplicável. - Status. -
Observações.

### 10.4. Movimentações

Registrar: - Aplicação ou aporte. - Compra de ativo. - Venda. -
Resgate. - Dividendos. - Juros e rendimentos. - Taxas. - Impostos. -
Bonificações. - Desdobramentos e agrupamentos, quando aplicáveis. -
Transferência de custódia, se suportada.

### 10.5. Valorização e rentabilidade

O sistema deverá armazenar histórico de avaliações com data, valor,
origem (manual ou integração) e observação.

Apresentar: - Capital aportado líquido. - Valor atual. - Ganho ou perda
estimada. - Rentabilidade percentual. - Rendimentos recebidos. -
Evolução por período. - Distribuição por classe e instituição.

A metodologia de rentabilidade deverá ser documentada. O sistema deverá
diferenciar valorização não realizada de lucro realizado e considerar
aportes, resgates e proventos para não distorcer os indicadores.

### 10.6. Atualização de preços

Na primeira versão, permitir atualização manual. Em versão futura,
integrar provedores de cotações, com identificação da fonte, horário da
última atualização e tratamento para cotações indisponíveis ou
defasadas.

------------------------------------------------------------------------

## 11. Calendário e planejamento financeiro

### 11.1. Objetivo

Consolidar em uma agenda os eventos financeiros efetivados e previstos.

### 11.2. Eventos

-   Receitas.
-   Despesas.
-   Contas recorrentes.
-   Faturas.
-   Parcelas de compras.
-   Financiamentos.
-   Empréstimos.
-   Consórcios.
-   Recebimentos previstos.
-   Aportes programados.
-   Resgates previstos.

### 11.3. Visualizações

-   Dia.
-   Semana.
-   Mês.
-   Lista cronológica.
-   Filtros por módulo, categoria, carteira e situação.

### 11.4. Projeção de fluxo de caixa

O sistema deverá projetar entradas e saídas futuras a partir de eventos
previstos e compromissos conhecidos.

A projeção deverá: - Informar o saldo inicial utilizado. - Considerar
somente eventos previstos dentro do período. - Distinguir cenários
previstos de valores efetivos. - Permitir simular alterações de receitas
e despesas. - Sinalizar datas com saldo projetado negativo. -
Identificar compromissos sem valor confirmado. - Atualizar previsões
após pagamento, recebimento ou cancelamento.

A projeção será uma estimativa e não uma garantia de saldo futuro.

------------------------------------------------------------------------

## 12. Relatórios e análises

### 12.1. Relatórios obrigatórios

-   Receitas por período e categoria.
-   Despesas por período e categoria.
-   Resultado mensal.
-   Extrato por carteira.
-   Transferências entre carteiras.
-   Gastos por cartão.
-   Faturas e pagamentos.
-   Parcelas futuras de compras.
-   Dívidas e financiamentos.
-   Histórico de consórcios.
-   Investimentos por classe.
-   Aportes, resgates e rendimentos.
-   Evolução patrimonial.
-   Patrimônio líquido.
-   Orçamentos versus realizado.
-   Fluxo de caixa previsto versus realizado.

### 12.2. Indicadores

-   Média mensal de receitas.
-   Média mensal de despesas.
-   Taxa de poupança.
-   Percentual da renda comprometida.
-   Percentual do orçamento consumido.
-   Total de dívidas.
-   Relação entre dívidas e patrimônio.
-   Patrimônio líquido.
-   Rentabilidade dos investimentos.

### 12.3. Exportação

Quando implementado, permitir exportar relatórios em CSV, PDF e XLSX,
respeitando permissões e privacidade.

------------------------------------------------------------------------

## 13. Orçamentos e metas

### 13.1. Orçamentos

O usuário poderá definir limites por categoria e período, especialmente
mensal.

Campos: - Nome do orçamento. - Categoria ou conjunto de categorias. -
Valor limite. - Período. - Data de início e término. - Alertas em
percentuais configuráveis.

O sistema deverá comparar despesas efetivadas com o limite e apresentar
o valor restante ou excedido.

### 13.2. Metas financeiras

Campos: - Nome da meta. - Descrição. - Valor desejado. - Valor
acumulado. - Data inicial. - Data-alvo. - Carteira ou investimento
associado, opcional. - Aportes planejados. - Status.

Exemplos: reserva de emergência, compra de veículo, aquisição de imóvel,
viagem, quitação de dívida ou objetivo de patrimônio.

------------------------------------------------------------------------

## 14. Notificações e lembretes

### 14.1. Eventos notificáveis

-   Conta próxima do vencimento.
-   Fatura próxima do vencimento.
-   Fatura vencida.
-   Parcela de financiamento próxima do vencimento.
-   Parcela de consórcio próxima do vencimento.
-   Receita prevista ainda não recebida.
-   Limite do cartão próximo do máximo.
-   Orçamento próximo do limite.
-   Meta atingida ou próxima de ser atingida.
-   Falha de sincronização ou integração, quando houver.

### 14.2. Configurações

O usuário poderá: - Ativar ou desativar categorias de alertas. - Definir
antecedência. - Escolher canais disponíveis. - Definir horário
silencioso. - Consultar histórico de notificações.

Notificações não deverão, por si só, efetivar pagamentos ou
movimentações.

------------------------------------------------------------------------

## 15. Assistente financeiro e automações futuras

Como evolução, o produto poderá incorporar um assistente que responda
perguntas sobre os dados do próprio usuário, por exemplo: - Quanto
gastei com alimentação neste mês? - Quais contas vencem nos próximos
sete dias? - Quanto tenho em parcelas futuras? - Qual foi a evolução do
meu patrimônio? - Quanto da minha renda está comprometida?

O assistente deverá utilizar apenas dados autorizados, informar o
período considerado e explicar quando os resultados forem estimativas.
Não deverá executar movimentações financeiras sem confirmação explícita
do usuário.

------------------------------------------------------------------------

## 16. Requisitos funcionais

Os requisitos funcionais abaixo descrevem comportamentos que o sistema
deverá implementar. A prioridade indicada é: **Alta**, necessária para o
núcleo do produto; **Média**, importante para completar a experiência;
**Futura**, prevista para evolução.

### 16.1. Conta e acesso

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF001                   O sistema deverá        Alta
                          permitir cadastro de    
                          usuário com nome,       
                          e-mail e senha.         

  RF002                   O sistema deverá        Alta
                          validar o endereço de   
                          e-mail cadastrado.      

  RF003                   O sistema deverá        Alta
                          permitir autenticação e 
                          encerramento de sessão. 

  RF004                   O sistema deverá        Alta
                          permitir recuperação e  
                          redefinição de senha.   

  RF005                   O sistema deverá        Média
                          permitir alteração dos  
                          dados cadastrais e      
                          preferências.           

  RF006                   O sistema deverá        Média
                          permitir solicitação de 
                          exclusão da conta.      

  RF007                   O sistema deverá        Média
                          permitir configurar     
                          tema, moeda, fuso       
                          horário e preferências  
                          regionais.              

  RF008                   O sistema deverá        Futura
                          oferecer autenticação   
                          em dois fatores.        
  -----------------------------------------------------------------------

### 16.2. Dashboard

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF009                   O sistema deverá        Alta
                          apresentar saldo        
                          consolidado das         
                          carteiras.              

  RF010                   O sistema deverá        Alta
                          apresentar receitas e   
                          despesas do período     
                          selecionado.            

  RF011                   O sistema deverá        Alta
                          apresentar compromissos 
                          futuros.                

  RF012                   O sistema deverá        Alta
                          apresentar faturas e    
                          limites dos cartões.    

  RF013                   O sistema deverá        Média
                          apresentar patrimônio   
                          bruto, passivos e       
                          patrimônio líquido.     

  RF014                   O sistema deverá        Média
                          apresentar gráficos por 
                          período e categoria.    

  RF015                   O sistema deverá        Alta
                          permitir filtrar o      
                          dashboard por período.  
  -----------------------------------------------------------------------

### 16.3. Carteiras

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF016                   O sistema deverá        Alta
                          permitir cadastrar      
                          carteiras bancárias,    
                          digitais e físicas.     

  RF017                   O sistema deverá        Alta
                          permitir informar saldo 
                          e data de abertura.     

  RF018                   O sistema deverá        Alta
                          permitir editar,        
                          consultar e arquivar    
                          carteiras.              

  RF019                   O sistema deverá        Alta
                          permitir registrar      
                          entradas e saídas em    
                          carteiras.              

  RF020                   O sistema deverá        Alta
                          permitir transferências 
                          entre carteiras         
                          próprias.               

  RF021                   O sistema deverá        Alta
                          apresentar extrato e    
                          evolução do saldo.      

  RF022                   O sistema deverá        Média
                          permitir filtrar        
                          carteiras por tipo,     
                          instituição e status.   
  -----------------------------------------------------------------------

### 16.4. Cartões e faturas

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF023                   O sistema deverá        Alta
                          permitir cadastrar      
                          cartões de crédito.     

  RF024                   O sistema deverá        Alta
                          armazenar limite,       
                          fechamento e vencimento 
                          do cartão.              

  RF025                   O sistema deverá        Alta
                          calcular limite         
                          comprometido e          
                          disponível.             

  RF026                   O sistema deverá gerar  Alta
                          e organizar faturas por 
                          ciclo.                  

  RF027                   O sistema deverá        Alta
                          permitir registrar      
                          compras à vista e       
                          parceladas.             

  RF028                   O sistema deverá        Alta
                          distribuir parcelas nas 
                          faturas                 
                          correspondentes.        

  RF029                   O sistema deverá        Alta
                          permitir pagamento      
                          total e parcial de      
                          faturas.                

  RF030                   O sistema deverá        Média
                          permitir estorno e      
                          cancelamento com        
                          histórico.              

  RF031                   O sistema deverá        Alta
                          apresentar parcelas     
                          futuras e               
                          comprometimento do      
                          limite.                 
  -----------------------------------------------------------------------

### 16.5. Receitas e despesas

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF032                   O sistema deverá        Alta
                          permitir cadastrar      
                          fontes de renda.        

  RF033                   O sistema deverá        Alta
                          permitir cadastrar      
                          despesas fixas e        
                          variáveis.              

  RF034                   O sistema deverá        Alta
                          permitir criar          
                          categorias e            
                          subcategorias.          

  RF035                   O sistema deverá        Alta
                          permitir lançamentos    
                          pontuais e recorrentes. 

  RF036                   O sistema deverá        Alta
                          distinguir valores      
                          previstos e efetivados. 

  RF037                   O sistema deverá        Alta
                          permitir confirmar      
                          recebimento ou          
                          pagamento.              

  RF038                   O sistema deverá        Alta
                          permitir editar,        
                          cancelar e consultar    
                          lançamentos.            

  RF039                   O sistema deverá        Média
                          permitir anexar         
                          comprovantes, quando    
                          habilitado.             
  -----------------------------------------------------------------------

### 16.6. Financiamentos e empréstimos

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF040                   O sistema deverá        Alta
                          permitir cadastrar      
                          contratos de            
                          financiamento e         
                          empréstimo.             

  RF041                   O sistema deverá gerar  Alta
                          ou importar cronograma  
                          de parcelas.            

  RF042                   O sistema deverá        Alta
                          registrar pagamentos e  
                          atrasos.                

  RF043                   O sistema deverá        Alta
                          calcular ou armazenar   
                          saldo devedor estimado. 

  RF044                   O sistema deverá        Média
                          permitir registrar      
                          amortizações            
                          extraordinárias e       
                          quitação.               

  RF045                   O sistema deverá        Média
                          apresentar histórico de 
                          juros, encargos e       
                          amortizações.           
  -----------------------------------------------------------------------

### 16.7. Consórcios

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF046                   O sistema deverá        Alta
                          permitir cadastrar      
                          contratos de consórcio. 

  RF047                   O sistema deverá gerar  Alta
                          cronograma de           
                          contribuições.          

  RF048                   O sistema deverá        Alta
                          registrar pagamentos,   
                          atrasos e antecipações. 

  RF049                   O sistema deverá        Alta
                          armazenar valor inicial 
                          e atualizado da carta.  

  RF050                   O sistema deverá        Alta
                          permitir informar       
                          reajuste em valor ou    
                          percentual.             

  RF051                   O sistema deverá manter Alta
                          histórico de reajustes  
                          e contribuições.        

  RF052                   O sistema deverá        Média
                          permitir registrar      
                          contemplação e          
                          recebimento ou          
                          utilização da carta.    
  -----------------------------------------------------------------------

### 16.8. Investimentos

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF053                   O sistema deverá        Alta
                          permitir cadastrar      
                          investimentos de        
                          diferentes classes.     

  RF054                   O sistema deverá        Alta
                          registrar aportes,      
                          compras, vendas e       
                          resgates.               

  RF055                   O sistema deverá        Média
                          registrar dividendos,   
                          juros e outros          
                          rendimentos.            

  RF056                   O sistema deverá        Alta
                          armazenar avaliações    
                          históricas dos ativos.  

  RF057                   O sistema deverá        Alta
                          calcular valor atual e  
                          resultado estimado.     

  RF058                   O sistema deverá        Média
                          apresentar distribuição 
                          e evolução da carteira. 

  RF059                   O sistema deverá        Alta
                          permitir atualização    
                          manual de preços.       

  RF060                   O sistema poderá        Futura
                          integrar provedores de  
                          cotações.               
  -----------------------------------------------------------------------

### 16.9. Planejamento, relatórios e metas

  -----------------------------------------------------------------------
  ID                      Requisito               Prioridade
  ----------------------- ----------------------- -----------------------
  RF061                   O sistema deverá        Alta
                          apresentar calendário   
                          financeiro.             

  RF062                   O sistema deverá        Alta
                          projetar fluxo de caixa 
                          futuro.                 

  RF063                   O sistema deverá        Média
                          alertar sobre projeções 
                          de saldo negativo.      

  RF064                   O sistema deverá        Alta
                          disponibilizar          
                          relatórios de receitas  
                          e despesas.             

  RF065                   O sistema deverá        Média
                          disponibilizar          
                          relatórios de cartões,  
                          dívidas e               
                          investimentos.          

  RF066                   O sistema deverá        Média
                          permitir cadastrar      
                          orçamentos por          
                          categoria.              

  RF067                   O sistema deverá        Média
                          acompanhar metas        
                          financeiras.            

  RF068                   O sistema deverá        Futura
                          permitir exportar       
                          relatórios.             

  RF069                   O sistema deverá        Média
                          permitir configurar     
                          notificações.           

  RF070                   O sistema poderá        Futura
                          disponibilizar          
                          assistente financeiro   
                          baseado nos dados       
                          autorizados.            
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 17. Regras de negócio

As regras de negócio definem como o sistema deverá se comportar
independentemente da interface utilizada.

### 17.1. Regras gerais e integridade financeira

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN001                               Todo registro financeiro deverá
                                      pertencer a um usuário autenticado
                                      e autorizado.

  RN002                               Valores monetários deverão ser
                                      armazenados com precisão decimal
                                      adequada, nunca usando ponto
                                      flutuante binário para cálculos
                                      financeiros.

  RN003                               O sistema deverá armazenar datas e
                                      horários de forma consistente,
                                      respeitando o fuso configurado pelo
                                      usuário.

  RN004                               Toda movimentação deverá possuir
                                      tipo, valor, data, status e origem
                                      ou destino quando aplicável.

  RN005                               Lançamentos previstos não poderão
                                      alterar saldos efetivos.

  RN006                               Somente movimentações efetivadas
                                      deverão compor o saldo realizado.

  RN007                               Alterações em registros financeiros
                                      deverão manter trilha de auditoria.

  RN008                               Exclusões de registros com impacto
                                      financeiro deverão ser tratadas
                                      preferencialmente como cancelamento
                                      ou estorno, preservando o
                                      histórico.

  RN009                               O sistema deverá impedir valores
                                      inválidos, datas inconsistentes e
                                      associações entre registros de
                                      usuários diferentes.

  RN010                               Operações que alterem múltiplos
                                      registros relacionados deverão ser
                                      atômicas: todas as alterações serão
                                      confirmadas ou nenhuma será
                                      aplicada.

  RN011                               O sistema deverá utilizar
                                      identificadores únicos e mecanismos
                                      de idempotência em operações
                                      sujeitas a repetição.

  RN012                               O sistema deverá distinguir data de
                                      competência, data de vencimento e
                                      data efetiva de pagamento ou
                                      recebimento.
  -----------------------------------------------------------------------

### 17.2. Carteiras e transferências

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN013                               O saldo atual de uma carteira será
                                      calculado a partir do saldo inicial
                                      e das movimentações efetivadas,
                                      incluindo ajustes autorizados.

  RN014                               Uma transferência entre carteiras
                                      próprias deverá gerar uma saída na
                                      origem e uma entrada no destino,
                                      vinculadas ao mesmo evento.

  RN015                               Transferências próprias não serão
                                      contabilizadas como receita ou
                                      despesa nos relatórios de
                                      resultado.

  RN016                               O valor debitado da origem deverá
                                      ser igual ao valor creditado no
                                      destino, exceto quando houver taxa
                                      explicitamente registrada.

  RN017                               Taxas de transferência deverão ser
                                      registradas separadamente como
                                      despesa.

  RN018                               Ajustes manuais de saldo deverão
                                      exigir justificativa e gerar
                                      histórico.

  RN019                               Carteira arquivada não poderá
                                      receber lançamentos comuns sem
                                      reativação ou permissão específica.
  -----------------------------------------------------------------------

### 17.3. Receitas e despesas

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN020                               Uma receita somente afetará o saldo
                                      da carteira após ser marcada como
                                      recebida e vinculada a um destino.

  RN021                               Uma despesa paga por carteira
                                      somente afetará seu saldo após
                                      confirmação do pagamento.

  RN022                               Uma despesa paga com cartão deverá
                                      ser associada à compra e à fatura,
                                      sem debitar imediatamente uma
                                      carteira bancária.

  RN023                               Despesas recorrentes deverão gerar
                                      ocorrências futuras sem marcar
                                      automaticamente essas ocorrências
                                      como pagas.

  RN024                               A edição de uma regra recorrente
                                      deverá permitir escolher se a
                                      alteração afeta somente ocorrências
                                      futuras ou também ocorrências ainda
                                      não efetivadas.

  RN025                               O sistema deverá impedir que uma
                                      ocorrência recorrente seja gerada
                                      mais de uma vez para a mesma regra
                                      e período.

  RN026                               Pagamentos parciais deverão manter
                                      o saldo restante em aberto.

  RN027                               A diferença entre valor previsto e
                                      valor efetivo deverá ser preservada
                                      para relatórios.
  -----------------------------------------------------------------------

### 17.4. Cartões, compras e faturas

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN028                               Cada cartão deverá possuir limite
                                      total, dia de fechamento e dia de
                                      vencimento válidos.

  RN029                               O sistema deverá determinar o ciclo
                                      da fatura com base na data da
                                      compra e no fechamento do cartão.

  RN030                               Compras realizadas após o
                                      fechamento deverão ser direcionadas
                                      ao ciclo seguinte, conforme regra
                                      de ciclo definida.

  RN031                               Compras parceladas deverão gerar
                                      parcelas vinculadas à compra
                                      original e às faturas
                                      correspondentes.

  RN032                               A soma das parcelas deverá
                                      corresponder ao total da compra,
                                      respeitando eventuais ajustes de
                                      centavos na distribuição.

  RN033                               O limite comprometido deverá
                                      considerar compras e parcelas
                                      pendentes segundo a política de
                                      limite configurada.

  RN034                               O limite disponível será o limite
                                      total menos o limite comprometido e
                                      ajustes aplicáveis.

  RN035                               O pagamento de fatura deverá gerar
                                      saída na carteira selecionada e
                                      reduzir a obrigação da fatura.

  RN036                               O pagamento de fatura não deverá
                                      gerar novamente a despesa de
                                      consumo correspondente às compras
                                      já registradas.

  RN037                               Pagamentos parciais deverão manter
                                      a fatura parcialmente aberta e
                                      atualizar o saldo restante.

  RN038                               Juros, multas, IOF e encargos
                                      deverão ser registrados
                                      separadamente quando conhecidos.

  RN039                               Estorno de compra deverá gerar
                                      ajuste vinculado à compra original
                                      e refletir na fatura e no limite
                                      conforme a situação do ciclo.

  RN040                               Faturas fechadas não deverão ter
                                      compras alteradas silenciosamente;
                                      ajustes deverão manter histórico e
                                      justificativa.

  RN041                               O sistema deverá permitir
                                      divergência entre limite calculado
                                      e limite informado pelo banco,
                                      sinalizando que o limite oficial é
                                      o do emissor.
  -----------------------------------------------------------------------

### 17.5. Financiamentos e empréstimos

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN042                               Cada contrato deverá possuir
                                      condições suficientes para gerar ou
                                      armazenar seu cronograma.

  RN043                               O sistema deverá identificar se o
                                      cronograma é calculado, importado
                                      ou informado manualmente.

  RN044                               Saldo devedor calculado sem dados
                                      completos deverá ser identificado
                                      como estimativa.

  RN045                               Pagamento de parcela deverá
                                      atualizar sua situação e registrar
                                      a movimentação financeira
                                      correspondente.

  RN046                               Amortizações extraordinárias
                                      deverão reduzir o saldo devedor
                                      conforme a regra contratual
                                      informada.

  RN047                               Juros, principal, seguros, tarifas
                                      e encargos deverão ser separados
                                      quando os dados estiverem
                                      disponíveis.

  RN048                               Quitação deverá encerrar parcelas
                                      futuras ou marcá-las como
                                      canceladas por quitação,
                                      preservando o histórico.

  RN049                               O sistema não deverá afirmar que o
                                      saldo calculado é o saldo oficial
                                      do credor.
  -----------------------------------------------------------------------

### 17.6. Consórcios

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN050                               Cada consórcio deverá possuir
                                      contrato e cronograma de
                                      contribuições próprios.

  RN051                               Pagamentos deverão atualizar o
                                      histórico de contribuições e a
                                      carteira de origem.

  RN052                               Reajustes da carta e da parcela
                                      deverão ser armazenados com data de
                                      vigência e origem da informação.

  RN053                               O aumento mensal informado poderá
                                      ser fixo em reais ou percentual,
                                      conforme escolha do usuário.

  RN054                               O valor atualizado da carta não
                                      deverá ser confundido com valor
                                      pago ou saldo disponível.

  RN055                               A contemplação deverá ser
                                      registrada como evento específico,
                                      com data, modalidade e valor.

  RN056                               O recebimento ou utilização da
                                      carta somente deverá ser
                                      considerado efetivo após
                                      confirmação do usuário.

  RN057                               O sistema deverá permitir registrar
                                      obrigações que permaneçam após a
                                      contemplação.

  RN058                               O sistema não deverá presumir que a
                                      carta contemplada será recebida em
                                      dinheiro livre.
  -----------------------------------------------------------------------

### 17.7. Investimentos

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN059                               Aportes deverão reduzir a carteira
                                      de origem e aumentar o capital
                                      alocado no investimento, sem serem
                                      tratados como despesa de consumo.

  RN060                               Resgates deverão reduzir a posição
                                      do investimento e creditar a
                                      carteira de destino quando
                                      efetivados.

  RN061                               Rendimentos recebidos deverão ser
                                      registrados separadamente da
                                      valorização não realizada.

  RN062                               O valor de mercado deverá possuir
                                      data e origem da avaliação.

  RN063                               Avaliações manuais deverão ser
                                      identificadas como informadas pelo
                                      usuário.

  RN064                               O sistema deverá diferenciar
                                      resultado realizado e não
                                      realizado.

  RN065                               Compras e vendas de ativos deverão
                                      atualizar quantidade e custo
                                      conforme método de apuração
                                      definido.

  RN066                               Taxas e impostos deverão ser
                                      registrados separadamente quando
                                      conhecidos.

  RN067                               Ativos sem cotação automática
                                      deverão permitir atualização
                                      manual.

  RN068                               Cotações externas deverão registrar
                                      fonte e horário de atualização e
                                      não poderão ser tratadas como preço
                                      garantido de execução.
  -----------------------------------------------------------------------

### 17.8. Calendário, projeções e relatórios

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN069                               O calendário deverá consolidar
                                      eventos de diferentes módulos sem
                                      duplicar seu impacto financeiro.

  RN070                               Eventos previstos e efetivados
                                      deverão ser visualmente
                                      diferenciados.

  RN071                               A projeção de saldo deverá
                                      considerar saldo inicial e eventos
                                      futuros ainda não efetivados.

  RN072                               Quando um evento previsto for
                                      efetivado, a projeção deverá ser
                                      atualizada sem somar o mesmo evento
                                      duas vezes.

  RN073                               Relatórios de receitas e despesas
                                      deverão excluir transferências
                                      próprias e aportes de investimentos
                                      da classificação de consumo.

  RN074                               Relatórios deverão permitir
                                      identificar o período, os filtros e
                                      a metodologia utilizados.

  RN075                               Patrimônio líquido deverá ser
                                      calculado a partir de ativos e
                                      passivos sem duplicidade entre
                                      módulos.
  -----------------------------------------------------------------------

### 17.9. Metas e orçamentos

  -----------------------------------------------------------------------
  ID                                  Regra de negócio
  ----------------------------------- -----------------------------------
  RN076                               O orçamento deverá comparar
                                      despesas efetivadas com o limite
                                      definido para o período.

  RN077                               Despesas previstas deverão ser
                                      exibidas separadamente do consumo
                                      efetivo do orçamento.

  RN078                               Uma despesa deverá ser atribuída a
                                      uma categoria principal para fins
                                      de orçamento.

  RN079                               O progresso da meta deverá
                                      considerar somente valores
                                      efetivamente associados à meta.

  RN080                               O mesmo valor não poderá ser
                                      contado duas vezes em metas ou
                                      carteiras vinculadas.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 18. Requisitos não funcionais

  -----------------------------------------------------------------------
  ID                      Categoria               Requisito
  ----------------------- ----------------------- -----------------------
  RNF001                  Segurança               Toda comunicação entre
                                                  cliente e servidor
                                                  deverá utilizar
                                                  HTTPS/TLS.

  RNF002                  Segurança               Senhas deverão ser
                                                  armazenadas com
                                                  algoritmo moderno de
                                                  hash apropriado, como
                                                  Argon2id ou bcrypt com
                                                  parâmetros adequados.

  RNF003                  Segurança               Tokens e sessões
                                                  deverão possuir
                                                  validade, renovação e
                                                  revogação controladas.

  RNF004                  Segurança               O backend deverá
                                                  validar autorização por
                                                  usuário em todas as
                                                  operações sobre dados
                                                  privados.

  RNF005                  Segurança               Dados sensíveis deverão
                                                  ser protegidos em
                                                  trânsito e, quando
                                                  aplicável, em repouso.

  RNF006                  Segurança               Segredos, chaves e
                                                  credenciais não poderão
                                                  ser armazenados no
                                                  código-fonte ou no
                                                  aplicativo cliente.

  RNF007                  Segurança               O sistema deverá
                                                  aplicar proteção contra
                                                  SQL injection, XSS,
                                                  CSRF quando aplicável,
                                                  brute force e abuso de
                                                  API.

  RNF008                  Segurança               Operações críticas
                                                  deverão gerar logs de
                                                  auditoria sem expor
                                                  senhas, tokens ou dados
                                                  sigilosos.

  RNF009                  Privacidade             O sistema deverá
                                                  observar a LGPD,
                                                  incluindo
                                                  transparência,
                                                  finalidade, minimização
                                                  e direitos dos
                                                  titulares.

  RNF010                  Privacidade             O usuário deverá poder
                                                  solicitar acesso,
                                                  correção e exclusão de
                                                  dados, respeitadas
                                                  obrigações legais.

  RNF011                  Integridade             Operações financeiras
                                                  relacionadas deverão
                                                  utilizar transações de
                                                  banco de dados.

  RNF012                  Integridade             Valores monetários
                                                  deverão utilizar tipos
                                                  decimais de precisão
                                                  adequada.

  RNF013                  Integridade             O sistema deverá manter
                                                  trilha de auditoria
                                                  para alterações
                                                  financeiras.

  RNF014                  Disponibilidade         O serviço deverá
                                                  possuir monitoramento,
                                                  logs e estratégia de
                                                  recuperação.

  RNF015                  Backup                  O banco de dados deverá
                                                  possuir backups
                                                  periódicos e testes de
                                                  restauração.

  RNF016                  Desempenho              Operações comuns de
                                                  consulta deverão
                                                  responder em até 2
                                                  segundos no percentil
                                                  95, em condições
                                                  normais e com carga
                                                  dimensionada.

  RNF017                  Desempenho              Consultas de relatórios
                                                  extensos deverão
                                                  utilizar paginação,
                                                  agregações e
                                                  estratégias de
                                                  otimização.

  RNF018                  Escalabilidade          A arquitetura deverá
                                                  permitir escalar API,
                                                  tarefas assíncronas e
                                                  banco de dados conforme
                                                  crescimento.

  RNF019                  Compatibilidade         A aplicação web deverá
                                                  funcionar nas versões
                                                  atuais dos principais
                                                  navegadores.

  RNF020                  Compatibilidade         Aplicativos mobile
                                                  deverão suportar
                                                  versões de Android e
                                                  iOS definidas na
                                                  política de lançamento.

  RNF021                  Usabilidade             A interface deverá ser
                                                  responsiva, consistente
                                                  e adequada a usuários
                                                  sem conhecimento
                                                  contábil.

  RNF022                  Acessibilidade          Componentes deverão
                                                  observar boas práticas
                                                  de contraste, foco,
                                                  leitura por tecnologias
                                                  assistivas e tamanho de
                                                  toque.

  RNF023                  Internacionalização     A primeira versão
                                                  deverá utilizar
                                                  português brasileiro,
                                                  BRL e formatos locais,
                                                  mantendo arquitetura
                                                  preparada para outros
                                                  idiomas e moedas.

  RNF024                  Manutenibilidade        O código deverá ser
                                                  modular, documentado e
                                                  possuir padrões de
                                                  desenvolvimento
                                                  definidos.

  RNF025                  Testabilidade           Regras financeiras
                                                  críticas deverão
                                                  possuir testes
                                                  unitários, de
                                                  integração e ponta a
                                                  ponta.

  RNF026                  Observabilidade         O sistema deverá
                                                  registrar métricas,
                                                  erros, rastreamento de
                                                  requisições e eventos
                                                  operacionais.

  RNF027                  Confiabilidade          Tarefas recorrentes e
                                                  notificações deverão
                                                  ser idempotentes para
                                                  evitar duplicidade.

  RNF028                  Portabilidade           A infraestrutura deverá
                                                  permitir implantação
                                                  por containers e
                                                  ambientes separados de
                                                  desenvolvimento,
                                                  homologação e produção.

  RNF029                  Exportação              Exportações deverão
                                                  respeitar filtros,
                                                  autorização e proteção
                                                  dos dados pessoais.

  RNF030                  Retenção                Políticas de retenção e
                                                  descarte deverão ser
                                                  documentadas e
                                                  compatíveis com
                                                  obrigações legais.
  -----------------------------------------------------------------------

Os números de desempenho são metas iniciais e deverão ser validados por
testes de carga, considerando volume de usuários, dados e infraestrutura
contratada.

------------------------------------------------------------------------

## 19. Modelo de dados conceitual

A modelagem física deverá ser refinada durante o projeto, mas
recomenda-se iniciar pelas entidades abaixo.

  -------------------------------------------------------------------------
  Entidade                  Finalidade              Relacionamentos
                                                    principais
  ------------------------- ----------------------- -----------------------
  users                     Usuários do sistema     Possui carteiras,
                                                    cartões e registros
                                                    financeiros.

  user_preferences          Preferências            Pertence a um usuário.

  wallets                   Carteiras               Pertence a um usuário.

  wallet_transactions       Movimentações de        Relaciona carteira e
                            carteira                evento financeiro.

  transfers                 Transferências próprias Relaciona carteira de
                                                    origem e destino.

  categories                Categorias              Pode possuir categoria
                                                    pai.

  income_sources            Fontes de renda         Pertence a um usuário.

  recurring_rules           Regras recorrentes      Gera ocorrências
                                                    financeiras.

  financial_transactions    Receitas e despesas     Relaciona categoria,
                                                    carteira ou origem de
                                                    pagamento.

  credit_cards              Cartões                 Pertence a um usuário.

  credit_card_cycles        Ciclos de fatura        Pertence a um cartão.

  credit_card_invoices      Faturas                 Contém compras e
                                                    ajustes.

  credit_card_purchases     Compras                 Pertence a um cartão.

  purchase_installments     Parcelas                Pertence a uma compra e
                                                    pode estar em uma
                                                    fatura.

  invoice_payments          Pagamentos de fatura    Relaciona fatura e
                                                    carteira.

  financings                Contratos de dívida     Pertence a um usuário.

  financing_installments    Parcelas de             Pertence a um contrato.
                            financiamento           

  financing_payments        Pagamentos e            Relaciona contrato e
                            amortizações            carteira.

  consortiums               Contratos de consórcio  Pertence a um usuário.

  consortium_installments   Contribuições           Pertence a um
                                                    consórcio.

  consortium_adjustments    Reajustes               Registra alteração de
                                                    carta ou parcela.

  consortium_events         Contemplação e          Pertence a um
                            recebimento             consórcio.

  investments               Ativos e aplicações     Pertence a um usuário.

  investment_transactions   Aportes, resgates e     Pertence a um
                            rendimentos             investimento.

  investment_valuations     Histórico de avaliação  Pertence a um
                                                    investimento.

  budgets                   Orçamentos              Pertence a um usuário e
                                                    período.

  financial_goals           Metas                   Pertence a um usuário.

  goal_contributions        Contribuições para      Relaciona meta e
                            metas                   movimentação.

  notifications             Notificações            Pertence a um usuário.

  attachments               Arquivos anexos         Relaciona arquivo a
                                                    entidade autorizada.

  audit_logs                Auditoria               Registra ações
                                                    relevantes.
  -------------------------------------------------------------------------

### 19.1. Diretrizes de modelagem

-   Utilizar chaves primárias únicas.
-   Incluir `user_id` nas entidades pertencentes ao usuário.
-   Criar índices para consultas por usuário, data, status e
    relacionamentos.
-   Definir restrições de integridade referencial.
-   Utilizar exclusão lógica quando necessário para preservar histórico.
-   Armazenar valores monetários em `NUMERIC/DECIMAL` com escala
    adequada.
-   Armazenar timestamps de forma consistente e apresentar no fuso do
    usuário.
-   Separar modelos de previsão e efetivação.
-   Evitar duplicar saldo como dado independente sem estratégia de
    reconciliação.
-   Considerar livro-razão de lançamentos (ledger) ou mecanismo
    equivalente para garantir rastreabilidade dos impactos financeiros.

### 19.2. Diretriz de ledger

Recomenda-se que movimentações financeiras relevantes sejam registradas
em um livro-razão imutável ou com correções por estorno. O ledger deverá
representar os débitos e créditos gerados por cada evento. Saldos
apresentados poderão ser calculados ou mantidos em estruturas de
consulta otimizadas, desde que possam ser reconciliados com os
lançamentos originais.

Exemplos: - Transferência: débito na carteira A e crédito na carteira
B. - Compra no cartão: reconhecimento de despesa e obrigação do cartão,
sem saída imediata da conta bancária. - Pagamento da fatura: baixa da
obrigação e saída da carteira. - Aporte: saída da carteira e aumento da
posição de investimento, sem classificar como despesa de consumo. -
Resgate: redução da posição e entrada na carteira. - Dividendo: entrada
financeira e registro de rendimento.

------------------------------------------------------------------------

## 20. Arquitetura técnica sugerida

### 20.1. Tecnologias

  Camada                Tecnologia sugerida
  --------------------- ---------------------------------------------------
  Web                   React + TypeScript
  Mobile                React Native + Expo
  Backend               Node.js + NestJS
  Banco de dados        PostgreSQL
  ORM                   Prisma
  Cache e filas         Redis + BullMQ
  Autenticação          JWT com refresh token ou provedor especializado
  Gráficos              ECharts ou Recharts
  Notificações mobile   Expo Notifications
  Infraestrutura        Docker + Nginx
  Monitoramento         Logs estruturados e ferramenta de observabilidade

As tecnologias são recomendações iniciais e poderão ser substituídas
após avaliação de requisitos, equipe e custos.

### 20.2. Organização modular do backend

Sugestão de módulos: - AuthModule. - UsersModule. - WalletsModule. -
TransactionsModule. - CategoriesModule. - CreditCardsModule. -
InvoicesModule. - PurchasesModule. - RecurrencesModule. -
FinancingsModule. - ConsortiumsModule. - InvestmentsModule. -
PlanningModule. - BudgetsModule. - GoalsModule. - ReportsModule. -
NotificationsModule. - AuditModule.

### 20.3. API

A API deverá: - Ser versionada. - Utilizar validação de entrada. -
Padronizar respostas e erros. - Aplicar autenticação e autorização. -
Possuir paginação e filtros. - Documentar endpoints. - Aplicar
idempotência em operações críticas. - Não confiar em cálculos
financeiros enviados pelo cliente; os cálculos oficiais deverão ocorrer
no backend.

------------------------------------------------------------------------

## 21. Segurança, privacidade e conformidade

1.  Aplicar princípio do menor privilégio.
2.  Proteger dados em trânsito e em repouso.
3.  Nunca armazenar dados completos de cartão bancário ou CVV.
4.  Não registrar senhas, tokens ou segredos em logs.
5.  Limitar tentativas de autenticação.
6.  Validar arquivos enviados e restringir tamanho e tipo.
7.  Separar ambientes e credenciais.
8.  Manter backups criptografados e testar restauração.
9.  Documentar finalidade e base legal do tratamento de dados.
10. Disponibilizar política de privacidade e termos de uso.
11. Definir procedimento para incidentes de segurança.
12. Permitir exportação e solicitação de exclusão dos dados, conforme
    legislação aplicável.
13. Avaliar fornecedores de cotações, Open Finance e notificações antes
    de compartilhar dados.
14. Não apresentar o aplicativo como instituição financeira ou
    consultoria de investimentos sem as autorizações pertinentes.

------------------------------------------------------------------------

## 22. Critérios gerais de aceite

O produto poderá ser considerado apto para uma primeira publicação
quando:

-   O usuário conseguir criar conta, autenticar-se e recuperar acesso.
-   O usuário conseguir cadastrar múltiplas carteiras e consultar seus
    saldos.
-   Entradas, saídas e transferências atualizarem corretamente os
    saldos.
-   O usuário conseguir cadastrar cartões com limite, fechamento e
    vencimento.
-   Compras parceladas forem distribuídas corretamente nas faturas.
-   O pagamento de fatura reduzir a carteira e liquidar a obrigação sem
    duplicar despesas.
-   Receitas e despesas recorrentes gerarem previsões sem efetivação
    automática.
-   Financiamentos e consórcios possuírem cronogramas e histórico.
-   Investimentos aceitarem aportes, resgates e avaliações.
-   O dashboard reconciliar com os registros dos módulos.
-   O calendário distinguir eventos previstos e realizados.
-   Relatórios apresentarem filtros e totais coerentes.
-   Usuários não conseguirem acessar dados de outras contas.
-   Testes automatizados cobrirem as principais regras financeiras.
-   Backup e restauração tiverem sido testados.
-   Não houver erros críticos conhecidos que possam alterar saldos ou
    duplicar movimentações.

------------------------------------------------------------------------

## 23. Plano de implantação por fases

### Fase 1 --- MVP: núcleo financeiro

-   Autenticação e preferências.
-   Carteiras.
-   Categorias.
-   Receitas e despesas.
-   Transferências.
-   Dashboard básico.
-   Extrato e relatórios básicos.
-   Ledger ou mecanismo de rastreabilidade financeira.

### Fase 2 --- Cartões e recorrências

-   Cartões de crédito.
-   Ciclos e faturas.
-   Compras à vista e parceladas.
-   Pagamento de faturas.
-   Despesas e receitas recorrentes.
-   Calendário e notificações.

### Fase 3 --- Dívidas e consórcios

-   Financiamentos.
-   Empréstimos.
-   Cronogramas.
-   Amortizações.
-   Consórcios.
-   Reajustes de carta e parcelas.
-   Contemplação e recebimento.

### Fase 4 --- Investimentos

-   Cadastro de ativos.
-   Aportes e resgates.
-   Rendimentos.
-   Avaliações históricas.
-   Rentabilidade e relatórios.
-   Integração de cotações, se viável.

### Fase 5 --- Planejamento e inteligência

-   Orçamentos.
-   Metas.
-   Projeção avançada de fluxo de caixa.
-   Assistente financeiro.
-   Importação de dados.
-   Integração Open Finance, sujeita a viabilidade técnica e
    regulatória.

------------------------------------------------------------------------

## 24. Riscos e decisões que precisam ser validadas

Antes do desenvolvimento, deverão ser definidas as decisões abaixo:

1.  **Método de saldo:** saldo calculado diretamente pelo ledger ou
    saldo materializado com reconciliação.
2.  **Compras parceladas:** regra exata de comprometimento do limite,
    considerando diferenças entre emissores.
3.  **Ciclos de cartão:** tratamento de compras no dia do fechamento,
    finais de semana e feriados.
4.  **Fatura parcial:** tratamento de juros, rotativo, parcelamento de
    fatura e encargos.
5.  **Financiamentos:** quais sistemas de amortização serão calculados
    automaticamente.
6.  **Consórcios:** quais reajustes serão automáticos e quais dependerão
    de informação manual.
7.  **Investimentos:** metodologia de rentabilidade, custo médio,
    impostos e eventos corporativos.
8.  **Patrimônio:** tratamento de imóveis, veículos, bens pessoais e
    valores de consórcios sem dupla contagem.
9.  **Moedas:** se a primeira versão será exclusivamente BRL.
10. **Integrações:** quais provedores externos serão contratados e quais
    dados poderão ser importados.
11. **Retenção:** política de retenção de dados e documentos após
    cancelamento da conta.
12. **Escopo do MVP:** funcionalidades obrigatórias para o primeiro
    lançamento.

------------------------------------------------------------------------

## 25. Glossário financeiro e observações

-   **Saldo disponível:** dinheiro efetivamente disponível nas
    carteiras, conforme os registros do aplicativo.
-   **Limite disponível do cartão:** estimativa do limite ainda não
    comprometido; o emissor é a fonte oficial.
-   **Fatura fechada:** ciclo encerrado para novas compras, conforme
    regra do cartão.
-   **Despesa efetiva:** consumo ou obrigação reconhecida, não
    necessariamente já paga.
-   **Pagamento:** liquidação total ou parcial de uma obrigação.
-   **Aporte:** transferência de recursos para uma posição de
    investimento.
-   **Valorização:** aumento estimado do valor de um ativo, ainda que
    não tenha sido vendido.
-   **Patrimônio líquido:** ativos menos passivos, conforme critérios de
    avaliação definidos.
-   **Fluxo de caixa:** entradas e saídas de dinheiro em determinado
    período.
-   **Projeção:** estimativa baseada nos eventos e premissas
    cadastrados, sujeita a alterações.

**Nota final:** este documento representa a especificação inicial do
produto. Antes da implementação, a equipe deverá detalhar os fluxos de
tela, contratos de API, modelo físico do banco, fórmulas financeiras,
permissões e critérios de aceite por funcionalidade. Cálculos de juros,
amortização, rentabilidade, impostos e consórcios deverão ser validados
com as condições contratuais e, quando necessário, por profissionais
especializados.
