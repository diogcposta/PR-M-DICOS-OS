/**
 * Catálogo de KPIs.
 *
 * `docs/ARCHITECTURE.md` permite manter o catálogo em código, desde que a versão
 * da definição seja persistida com cada resultado. É essa a opção do MVP: as
 * definições são revistas em code review e viajam com o histórico do repositório.
 *
 Estão ativos apenas os KPIs de agenda: são os únicos calculáveis a partir dos
 * factos que a importação já produz. Os financeiros e os de pacientes continuam
 * bloqueados por falta de definição de negócio e de amostras validadas — e um
 * KPI sem fórmula acordada não deve produzir um número no ecrã.
 *
 * Nenhum destes KPIs tem ainda `definitionApproved: true`: as fórmulas são
 * defensáveis e testadas, mas foram decididas por nós e falta a validação do
 * responsável de negócio contra uma exportação real.
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
  /** Fórmula definida e calculável a partir dos dados importados. */
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
  /**
   * Falso enquanto a definição não for validada com uma exportação real e com o
   * responsável de negócio. Um KPI ativo mas não aprovado produz números, e o
   * ecrã tem de dizer que a definição ainda é provisória.
   */
  readonly definitionApproved: boolean;
  /** O que falta decidir. Vazio quando não há nada pendente. */
  readonly openQuestion: string;
}

/**
 * Denominador partilhado pelas taxas de agenda (v1).
 *
 * Decisão de negócio D-019: contam as consultas cujo desfecho já é conhecido —
 * realizadas, faltas e canceladas. As que ainda estão por acontecer ficam de
 * fora, para que um período em curso não mostre uma taxa de realização
 * artificialmente baixa. As remarcadas não contam em lado nenhum: a consulta
 * conta na data para onde foi movida.
 */
export const RATE_DENOMINATOR_DESCRIPTION =
  "consultas com desfecho conhecido (realizadas + faltas + canceladas)";

const DEFAULT_FILTERS: readonly KpiFilter[] = ["period", "clinic", "practitioner"];

export const KPI_CATALOG: readonly KpiDefinition[] = [
  {
    key: "appointments_scheduled",
    name: "Consultas agendadas",
    description: "Total de consultas marcadas no período, seja qual for o desfecho.",
    formula:
      "contagem(AppointmentFact onde occurredAt ∈ período e status ≠ RESCHEDULED)",
    unit: "COUNT",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "ACTIVE",
    definitionApproved: false,
    openQuestion:
      "As remarcadas ficam de fora porque contam na data para onde foram movidas. Confirmar com o negócio.",
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
    status: "ACTIVE",
    definitionApproved: false,
    openQuestion:
      "Confirmar que estados da origem mapeiam para COMPLETED quando houver exportação real.",
  },
  {
    key: "completion_rate",
    name: "Taxa de realização",
    description:
      "Proporção de consultas realizadas face às consultas com desfecho conhecido.",
    formula: "realizadas / (realizadas + faltas + canceladas)",
    unit: "PERCENTAGE",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "ACTIVE",
    definitionApproved: false,
    openQuestion:
      "Denominador escolhido em D-019: exclui as consultas por realizar, para um período em curso não parecer mau. Por validar com o negócio.",
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
    status: "ACTIVE",
    definitionApproved: false,
    openQuestion:
      "Confirmar que estados da origem mapeiam para NO_SHOW quando houver exportação real.",
  },
  {
    key: "no_show_rate",
    name: "Taxa de faltas",
    description: "Proporção de faltas face às consultas com desfecho conhecido.",
    formula: "faltas / (realizadas + faltas + canceladas)",
    unit: "PERCENTAGE",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "ACTIVE",
    definitionApproved: false,
    openQuestion: "Mesmo denominador da taxa de realização (D-019). Por validar com o negócio.",
  },
  {
    key: "cancellation_rate",
    name: "Taxa de cancelamento",
    description: "Proporção de cancelamentos face às consultas com desfecho conhecido.",
    formula: "canceladas / (realizadas + faltas + canceladas)",
    unit: "PERCENTAGE",
    sources: ["AppointmentFact"],
    supportedFilters: DEFAULT_FILTERS,
    definitionVersion: 1,
    status: "ACTIVE",
    definitionApproved: false,
    openQuestion:
      "Cancelamento pela clínica e pelo paciente contam da mesma forma. Por validar com o negócio.",
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
    definitionApproved: false,
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
    definitionApproved: false,
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
    definitionApproved: false,
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
    definitionApproved: false,
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
    definitionApproved: false,
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
    definitionApproved: false,
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
    definitionApproved: false,
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
    definitionApproved: false,
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
    definitionApproved: false,
    openQuestion: "Snapshot da origem ou saldo derivado de movimentos?",
  },
];

export function findKpiDefinition(key: KpiKey): KpiDefinition | undefined {
  return KPI_CATALOG.find((definition) => definition.key === key);
}

export function activeKpiDefinitions(): readonly KpiDefinition[] {
  return KPI_CATALOG.filter((definition) => definition.status === "ACTIVE");
}

/** KPIs de agenda, pela ordem em que são apresentados no dashboard. */
export const APPOINTMENT_KPI_KEYS = [
  "appointments_scheduled",
  "appointments_completed",
  "completion_rate",
  "no_show_count",
  "no_show_rate",
  "cancellation_rate",
] as const satisfies readonly KpiKey[];

export type AppointmentKpiKey = (typeof APPOINTMENT_KPI_KEYS)[number];
