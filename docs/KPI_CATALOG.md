# Catálogo inicial de KPIs

Estas definições são propostas técnicas e precisam de validação com uma amostra real do Newsoft e com o responsável de negócio.

| Chave | Nome | Fórmula proposta | Estado |
|---|---|---|---|
| `appointments_scheduled` | Consultas agendadas | contagem de consultas no período segundo estados incluídos | confirmar estados |
| `appointments_completed` | Consultas realizadas | contagem com estado normalizado `COMPLETED` | confirmar mapeamento |
| `completion_rate` | Taxa de realização | realizadas / agendadas elegíveis | confirmar denominador |
| `no_show_count` | Faltas | contagem com estado `NO_SHOW` | confirmar mapeamento |
| `no_show_rate` | Taxa de faltas | faltas / agendadas elegíveis | confirmar denominador |
| `cancellation_rate` | Taxa de cancelamento | canceladas / agendadas elegíveis | confirmar estados |
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

