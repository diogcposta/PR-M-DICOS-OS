/**
 * Valores iniciais do perfil (editáveis nas Definições).
 * Horário: segunda a sexta 09:30–12:30 e 14:30–19:00; consulta standard 45 min.
 */
export const DEFAULT_PROFILE = {
  name: "Diogo Costa",
  feeBps: 5000,
  feeBase: "BILLED",
  standardSlotMinutes: 45,
  saturdayMinutes: 210,
  primaryGoalCentsPerHour: 10_000,
  targetNoShowBps: 500,
  followUpMinCents: 50_000,
  followUpPriorityCents: 150_000,
  followUpFirstAlertDays: 7,
  followUpSecondAlertDays: 30,
} as const;

export const DEFAULT_SCHEDULE: ReadonlyArray<{ weekday: number; startMinute: number; endMinute: number }> =
  [1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startMinute: 9 * 60 + 30, endMinute: 12 * 60 + 30 },
    { weekday, startMinute: 14 * 60 + 30, endMinute: 19 * 60 },
  ]);

export const DEFAULT_GOALS = [
  { label: "Meta próxima", centsPerHour: 8_500 },
  { label: "Meta intermédia", centsPerHour: 10_000 },
  { label: "Meta avançada", centsPerHour: 12_500 },
  { label: "Meta elevada", centsPerHour: 15_000 },
] as const;

/** `centsPerHour: null` = usar o €/h medido. */
export const DEFAULT_SCENARIOS = [
  { name: "Atual", centsPerHour: null, hoursPerMonth: 146 },
  { name: "Meta 12 meses", centsPerHour: 10_000, hoursPerMonth: 146 },
  { name: "Meta longo prazo", centsPerHour: 12_500, hoursPerMonth: 146 },
] as const;

export const DEFAULT_TEMPLATES = [
  { name: "Consulta de avaliação", category: "Consulta", priceCents: 4_000, durationMinutes: 30, plannedVisits: 1, labCostCents: 0, favorite: true },
  { name: "Restauração a compósito", category: "Dentisteria", priceCents: 7_000, durationMinutes: 45, plannedVisits: 1, labCostCents: 0, favorite: true },
  { name: "Higiene oral", category: "Higiene oral", priceCents: 5_000, durationMinutes: 45, plannedVisits: 1, labCostCents: 0, favorite: true },
  { name: "Endodontia molar", category: "Endodontia", priceCents: 25_000, durationMinutes: 90, plannedVisits: 2, labCostCents: 0, favorite: false },
  { name: "Retratamento endodôntico", category: "Retratamento endodôntico", priceCents: 20_000, durationMinutes: 240, plannedVisits: 3, labCostCents: 0, favorite: false },
  { name: "Coroa cerâmica", category: "Coroa", priceCents: 60_000, durationMinutes: 180, plannedVisits: 3, labCostCents: 15_000, favorite: true },
  { name: "Onlay cerâmico", category: "Onlay/Overlay", priceCents: 45_000, durationMinutes: 120, plannedVisits: 2, labCostCents: 10_000, favorite: false },
  { name: "Exodontia simples", category: "Cirurgia", priceCents: 6_000, durationMinutes: 30, plannedVisits: 1, labCostCents: 0, favorite: false },
  { name: "Urgência", category: "Urgência", priceCents: 5_000, durationMinutes: 30, plannedVisits: 1, labCostCents: 0, favorite: false },
  { name: "Controlo", category: "Controlo", priceCents: 0, durationMinutes: 15, plannedVisits: 1, labCostCents: 0, favorite: false },
] as const;

/**
 * Tipos de exame iniciais (editáveis nas Definições). Sem valor predefinido: o
 * preço de cada exame depende da clínica e é indicado pelo médico.
 */
export const DEFAULT_EXAM_TYPES = [
  { name: "Ortopantomografia", priceCents: 0 },
  { name: "CBCT", priceCents: 0 },
] as const;
