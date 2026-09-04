/**
 * Catálogo de KPIs.
 *
 * `docs/ARCHITECTURE.md` permite manter o catálogo em código, desde que a versão
 * da definição seja persistida com cada resultado. É essa a opção do MVP: as
 * definições são revistas em code review e viajam com o histórico do repositório.
 *
 * Nenhum KPI está `ACTIVE` nesta fase. Todas as definições em
 * `docs/KPI_CATALOG.md` continuam por confirmar com uma exportação real do
 * Newsoft e com o responsável de negócio — e um KPI com fórmula por confirmar
 * não deve produzir um número no ecrã.
 */

export type KpiKey =
  | "appointments_scheduled"
  | "appointments_completed"
  | "completion_rate"
  | "no_show_count"
  | "no_show_rate"
  | "cancellation_rate"
  | "new_patients"
  | "active_patients"
  | "active_without_booking"
  | "reactivated_patients"
  | "lost_patients"
  | "production_amount"
  | "invoiced_amount"
  | "budget_amount"
  | "outstanding_balance";

export type KpiUnit = "COUNT" | "PERCENTAGE" | "CURRENCY_CENTS";

export type KpiSource =
  | "AppointmentFact"
  | "FinancialFact"
  | "BudgetFact"
  | "PatientStatusSnapshot";

export type KpiFilter = "period" | "clinic" | "practitioner";

export type KpiStatus =
  /** Fórmula aprovada, dados disponíveis, resultado apresentável. */
  | "ACTIVE"
  /** Fórmula proposta mas ainda por confirmar com amostra real ou com o negócio. */
  | "PENDING_DEFINITION";

export interface KpiDefinition {
  readonly key: KpiKey;
  readonly name: string;
  readonly description: string;
  readonly formula: string;
  readonly unit: KpiUnit;
  readonly sources: readonly KpiSource[];
  readonly supportedFilters: readonly KpiFilter[];
  readonly definitionVersion: number;
  readonly status: KpiStatus;
  /** O que falta decidir antes de o KPI poder ficar ativo. */
  readonly openQuestion: string;
}

const DEFAULT_FILTERS: readonly KpiFilter[] = ["period", "clinic", "practitioner"];

export const KPI_CATALOG: readonly KpiDefinition[] = [
  {
    key: "appointments_scheduled",
    name: "Consultas agendadas",
    description: "Consultas com marcação no período, segundo os estados considerados elegíveis.",
    formula: "contagem(AppointmentFact onde occurredAt ∈ período e status ∈ estados elegíveis)",
    unit: "COUNT",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Que estados da origem contam como agendamento elegível?",
  },
  {
    key: "appointments_completed",
    name: "Consultas realizadas",
    description: "Consultas efetivamente realizadas no período.",
    formula: "contagem(AppointmentFact onde status = COMPLETED)",
    unit: "COUNT",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Confirmar que estados da origem mapeiam para COMPLETED.",
  },
  {
    key: "completion_rate",
    name: "Taxa de realização",
    description: "Proporção de consultas realizadas face às agendadas elegíveis.",
    formula: "appointments_completed / appointments_scheduled",
    unit: "PERCENTAGE",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "O denominador inclui consultas canceladas com antecedência?",
  },
  {
    key: "no_show_count",
    name: "Faltas",
    description: "Consultas em que o paciente não compareceu.",
    formula: "contagem(AppointmentFact onde status = NO_SHOW)",
    unit: "COUNT",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Confirmar que estados da origem mapeiam para NO_SHOW.",
  },
  {
    key: "no_show_rate",
    name: "Taxa de faltas",
    description: "Proporção de faltas face às consultas agendadas elegíveis.",
    formula: "no_show_count / appointments_scheduled",
    unit: "PERCENTAGE",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Mesmo denominador da taxa de realização?",
  },
  {
    key: "cancellation_rate",
    name: "Taxa de cancelamento",
    description: "Proporção de consultas canceladas face às agendadas elegíveis.",
    formula: "contagem(status = CANCELLED) / appointments_scheduled",
    unit: "PERCENTAGE",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Cancelamento pela clínica e pelo paciente contam da mesma forma?",
  },
  {
    key: "new_patients",
    name: "Pacientes novos",
    description: "Pacientes com a primeira consulta elegível dentro do período.",
    formula: "contagem distinta(patientExternalRef cuja primeira consulta ∈ período)",
    unit: "COUNT",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Primeira consulta no histórico importado ou primeira no Newsoft?",
  },
  {
    key: "active_patients",
    name: "Pacientes ativos",
    description: "Pacientes considerados ativos à data de referência.",
    formula: "por definir",
    unit: "COUNT",
    sources: ["PatientStatusSnapshot"],
    supportedFilters: ["period", "clinic"],
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Bloqueado: falta a definição de negócio de 'ativo'.",
  },
  {
    key: "active_without_booking",
    name: "Ativos sem marcação",
    description: "Pacientes ativos sem consulta futura agendada.",
    formula: "por definir",
    unit: "COUNT",
    sources: ["PatientStatusSnapshot", "AppointmentFact"],
    supportedFilters: ["period", "clinic"],
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Bloqueado: depende da definição de 'ativo'.",
  },
  {
    key: "reactivated_patients",
    name: "Pacientes reativados",
    description: "Pacientes que voltaram após um intervalo de inatividade.",
    formula: "por definir",
    unit: "COUNT",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Bloqueado: qual o intervalo de inatividade que define reativação?",
  },
  {
    key: "lost_patients",
    name: "Pacientes perdidos",
    description: "Pacientes considerados perdidos segundo uma regra temporal aprovada.",
    formula: "por definir",
    unit: "COUNT",
    sources: ["PatientStatusSnapshot", "AppointmentFact"],
    supportedFilters: ["period", "clinic"],
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Bloqueado: regra temporal por aprovar.",
  },
  {
    key: "production_amount",
    name: "Produção",
    description: "Valor de produção clínica registado no período.",
    formula: "soma(FinancialFact.amountCents onde type = PRODUCTION)",
    unit: "CURRENCY_CENTS",
    sources: ["FinancialFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Que data usar (execução ou registo) e como tratar reversões?",
  },
  {
    key: "invoiced_amount",
    name: "Faturação",
    description: "Valor faturado no período.",
    formula: "soma(FinancialFact.amountCents onde type = INVOICE)",
    unit: "CURRENCY_CENTS",
    sources: ["FinancialFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Com ou sem IVA? Como entram as notas de crédito?",
  },
  {
    key: "budget_amount",
    name: "Orçamentos",
    description: "Valor dos orçamentos apresentados no período.",
    formula: "soma(BudgetFact.amountCents onde presentedAt ∈ período)",
    unit: "CURRENCY_CENTS",
    sources: ["BudgetFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Como tratar versões sucessivas do mesmo orçamento?",
  },
  {
    key: "outstanding_balance",
    name: "Saldo em dívida",
    description: "Saldo por cobrar à data de referência.",
    formula: "soma(PatientStatusSnapshot.outstandingCents à data de referência)",
    unit: "CURRENCY_CENTS",
    sources: ["PatientStatusSnapshot"],
    supportedFilters: ["period", "clinic"],
    definitionVersion: 1,
    status: "PENDING_DEFINITION",
    openQuestion: "Snapshot da origem ou saldo derivado de movimentos?",
  },
];

export function findKpiDefinition(key: KpiKey): KpiDefinition | undefined {
  return KPI_CATALOG.find((definition) => definition.key === key);
}

export function activeKpiDefinitions(): readonly KpiDefinition[] {
  return KPI_CATALOG.filter((definition) => definition.status === "ACTIVE");
}
