# Catálogo inicial de KPIs

Estas definições são propostas técnicas e precisam de validação com uma amostra real do Newsoft e com o responsável de negócio.

A implementação viva está em `src/modules/kpis/domain/catalog.ts`, com a versão da definição de cada KPI. Este documento é o registo da discussão; o código é a fonte de verdade.

**Estado a partir da Fase 3**: os KPIs de agenda estão ativos e calculados. Nenhum tem ainda `definitionApproved: true` — o ecrã marca-os como "definição provisória". Os financeiros e os de pacientes continuam bloqueados, por falta de definição de negócio e de amostras validadas.

**Fase 4A**: os dados por trás destes KPIs são exclusivamente sintéticos (perfil `SYNTHETIC_AGENDA_V1`, gerador determinístico em `src/modules/imports/domain/synthetic-dataset.ts`). Cada resultado de KPI transporta agora a sua proveniência completa — período, filtros, numerador/denominador, lotes de origem e data da última atualização — para que um número no dashboard possa sempre ser reconstruído. A adaptação a exportações reais do Newsoft (Fase 4) continua pendente de amostras anonimizadas.

## Denominador das taxas de agenda (v1, D-019)

As três taxas partilham o mesmo denominador: **consultas com desfecho conhecido**, ou seja realizadas + faltas + canceladas. As consultas ainda por realizar ficam de fora, para que olhar para o mês corrente a meio do mês não mostre uma taxa de realização artificialmente baixa. As remarcadas não entram em nenhum total: contam na data para onde foram movidas.

Consequência útil: as três taxas somam 100%.

| Chave | Nome | Fórmula proposta | Estado |
|---|---|---|---|
| `appointments_scheduled` | Consultas agendadas | contagem no período, exceto remarcadas | **ativo** v1, por aprovar |
| `appointments_completed` | Consultas realizadas | contagem com estado `COMPLETED` | **ativo** v1, por aprovar |
| `completion_rate` | Taxa de realização | realizadas / (realizadas + faltas + canceladas) | **ativo** v1, por aprovar |
| `no_show_count` | Faltas | contagem com estado `NO_SHOW` | **ativo** v1, por aprovar |
| `no_show_rate` | Taxa de faltas | faltas / (realizadas + faltas + canceladas) | **ativo** v1, por aprovar |
| `cancellation_rate` | Taxa de cancelamento | canceladas / (realizadas + faltas + canceladas) | **ativo** v1, por aprovar |
| `new_patients` | Novos pacientes | identificadores com primeira consulta elegível no período | confirmar definição Newsoft |
| `active_patients` | Pacientes ativos | definição da fonte à data de referência | bloqueado até definição |
| `active_without_booking` | Ativos sem marcação | ativos sem consulta futura elegível | bloqueado até definição |
| `reactivated_patients` | Reativados | regra de intervalo sem atividade + nova consulta | bloqueado até definição |
| `lost_patients` | Perdidos | regra temporal aprovada | bloqueado até definição |
| `production_amount` | Produção | soma de factos `PRODUCTION` em cêntimos | confirmar data e reversões |
| `invoiced_amount` | Faturação | soma de factos `INVOICE` em cêntimos | confirmar impostos/notas crédito |
| `budget_amount` | Orçamentos | soma dos orçamentos apresentados no período | confirmar versões/duplicados |
| `outstanding_balance` | Saldo em dívida | saldo à data de referência | confirmar snapshot vs movimentos |

Cada implementação deve testar intervalos, timezone, cancelamentos/reversões, duplicados e denominador zero.

