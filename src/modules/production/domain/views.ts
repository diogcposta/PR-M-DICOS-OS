/**
 * Composição dos ecrãs a partir de registos já carregados — pura e partilhada.
 *
 * É usada pela app Next (depois de ler do SQLite) e pela versão Google Apps
 * Script (depois de ler do Google Sheets), para que os dois ecrãs mostrem
 * exatamente os mesmos números. Nenhuma fórmula nova vive aqui: só junta as
 * funções de domínio.
 */
import { gapToNextGoal, projectGoals, type GoalInput } from "./goals";
import { buildInsights, followUpHealth, topActions, type InsightInput } from "./insights";
import {
  agreementImpact,
  analyseCases,
  insurerAnalysis,
  overallChairCentsPerHour,
  payerComparison,
  procedureMetrics,
  profitabilityMatrix,
  type FeeSettings,
  type ProcedureRecord,
  type SessionRecord,
} from "./metrics";
import { summariseMonth, type AbsenceRecord, type ClinicalDayRecord, type PlanRecord } from "./monthly";
import { followUpList, openPlanCents, treatmentFunnel, type FollowUpRules } from "./plans";
import { efficiencyScore } from "./score";
import { monthOf, monthRange, monthsEndingAt } from "./time";

/** Parâmetros do perfil necessários aos cálculos. */
export interface ProfileSettings {
  readonly name: string;
  readonly feeBps: number;
  readonly feeBase: string;
  readonly standardSlotMinutes: number;
  readonly saturdayMinutes: number;
  readonly primaryGoalCentsPerHour: number;
  readonly targetNoShowBps: number;
  readonly followUpMinCents: number;
  readonly followUpPriorityCents: number;
  readonly followUpFirstAlertDays: number;
  readonly followUpSecondAlertDays: number;
}

export function feeSettingsOf(profile: Pick<ProfileSettings, "feeBps" | "feeBase">): FeeSettings {
  return { feeBps: profile.feeBps, feeBase: profile.feeBase === "NET" ? "NET" : "BILLED" };
}

export function followUpRulesOf(profile: ProfileSettings): FollowUpRules {
  return {
    minCents: profile.followUpMinCents,
    priorityCents: profile.followUpPriorityCents,
    firstAlertDays: profile.followUpFirstAlertDays,
    secondAlertDays: profile.followUpSecondAlertDays,
  };
}

/** Todos os registos (ou os de um intervalo) já no formato de domínio. */
export interface ProductionRecords {
  readonly days: readonly ClinicalDayRecord[];
  /** Procedimentos com as suas consultas (todas, mesmo de outros meses). */
  readonly procedures: readonly ProcedureRecord[];
  /** Consultas por data (para horas trabalhadas e agendamentos). */
  readonly sessions: readonly SessionRecord[];
  readonly absences: readonly AbsenceRecord[];
  readonly plans: readonly PlanRecord[];
}

function sliceMonth(data: ProductionRecords, month: string) {
  const inMonth = (d: string) => monthOf(d) === month;
  return {
    month,
    days: data.days.filter((d) => inMonth(d.date)),
    procedures: data.procedures.filter((p) => inMonth(p.date)),
    sessions: data.sessions.filter((s) => inMonth(s.date)),
    absences: data.absences.filter((a) => inMonth(a.date)),
    plans: data.plans.filter((p) => inMonth(p.presentedDate)),
  };
}

/** Resumos de `count` meses terminando em `lastMonth`. */
export function monthlySeries(data: ProductionRecords, profile: Pick<ProfileSettings, "feeBps" | "feeBase">, lastMonth: string, count: number) {
  const fees = feeSettingsOf(profile);
  return monthsEndingAt(lastMonth, count).map((m) => summariseMonth(sliceMonth(data, m), fees));
}

/** Mês por omissão: o mais recente com procedimentos até hoje, ou o mês corrente. */
export function latestMonth(procedures: readonly Pick<ProcedureRecord, "date">[], today: string): string {
  let latest: string | null = null;
  for (const p of procedures) if (p.date <= today && (latest === null || p.date > latest)) latest = p.date;
  return monthOf(latest ?? today);
}

/**
 * Dashboard de um mês. `data` deve conter pelo menos os 6 meses até `month`
 * (tendência) e todos os planos até ao fim do mês (follow-up).
 */
export function dashboardView(
  data: ProductionRecords,
  profile: ProfileSettings,
  goals: readonly GoalInput[],
  month: string,
  today: string,
) {
  const fees = feeSettingsOf(profile);
  const range = monthRange(month);
  const summaries = monthlySeries(data, profile, month, 6);
  const current = summaries.at(-1)!;
  const previous = summaries.at(-2) ?? null;
  const monthProcedures = data.procedures.filter((p) => monthOf(p.date) === month);
  const plansUpTo = data.plans.filter((p) => p.presentedDate <= range.to);

  const referenceDate = today < range.to ? today : range.to;
  const followUps = followUpList(plansUpTo, referenceDate, followUpRulesOf(profile));
  const openCents = openPlanCents(plansUpTo);
  const overdueCents = followUps.filter((f) => f.alertLevel > 0).reduce((s, f) => s + f.openCents, 0);

  const insightInput: InsightInput = {
    current,
    previous,
    categories: profitabilityMatrix(monthProcedures, fees, "category"),
    procedureTypes: profitabilityMatrix(monthProcedures, fees, "procedureType"),
    insurers: insurerAnalysis(monthProcedures),
    followUps,
    overallChairCph: overallChairCentsPerHour(monthProcedures),
    targetNoShowRate: profile.targetNoShowBps / 10_000,
  };
  const sortedGoals = [...goals].sort((a, b) => a.centsPerHour - b.centsPerHour);

  return {
    month,
    current,
    previous,
    summaries,
    goals: projectGoals(sortedGoals, current.centsPerHour, current.clinicalMinutes, profile.feeBps),
    gap: gapToNextGoal(sortedGoals, current.centsPerHour),
    insights: buildInsights(insightInput),
    actions: topActions(insightInput),
    followUps,
    score: efficiencyScore({
      centsPerHour: current.centsPerHour,
      goalCentsPerHour: profile.primaryGoalCentsPerHour,
      realOccupancy: current.agenda.realOccupancy,
      theoreticalOccupancy: current.agenda.theoreticalOccupancy,
      missedRate: current.absences.missedRate,
      acceptanceRateByValue: current.plans.acceptanceRateByValue,
      followUpHealth: followUpHealth(openCents, overdueCents),
    }),
    funnel: treatmentFunnel(data.plans.filter((p) => monthOf(p.presentedDate) === month)),
    insightInput,
  };
}

export type DashboardView = ReturnType<typeof dashboardView>;

/** Rentabilidade, seguros e casos dos procedimentos dados (já filtrados pelo período). */
export function profitabilityView(
  procedures: readonly ProcedureRecord[],
  profile: Pick<ProfileSettings, "feeBps" | "feeBase">,
  goals: readonly GoalInput[],
) {
  const fees = feeSettingsOf(profile);
  const lowest = goals.length ? Math.min(...goals.map((g) => g.centsPerHour)) : null;
  return {
    procedures,
    lowestGoalCph: lowest,
    perProcedure: procedures.map((p) => ({ record: p, metrics: procedureMetrics(p, fees, lowest) })),
    byType: profitabilityMatrix(procedures, fees, "procedureType"),
    byCategory: profitabilityMatrix(procedures, fees, "category"),
    overallChairCph: overallChairCentsPerHour(procedures),
    payer: payerComparison(procedures),
    insurers: insurerAnalysis(procedures),
    agreement: agreementImpact(procedures),
    cases: analyseCases(procedures),
  };
}

export type ProfitabilityView = ReturnType<typeof profitabilityView>;

/** Planos: funil do período, follow-up (todos os planos) e o que não avançou. */
export function plansView(plans: readonly PlanRecord[], profile: ProfileSettings, from: string, to: string, today: string) {
  const inRange = plans.filter((p) => p.presentedDate >= from && p.presentedDate <= to);
  return {
    inRange,
    funnel: treatmentFunnel(inRange),
    followUps: followUpList(plans, today, followUpRulesOf(profile)),
    notAdvanced: inRange.filter(
      (p) =>
        p.status === "REJECTED" ||
        ((p.status === "PRESENTED" || p.status === "PENDING" || p.status === "PARTIALLY_ACCEPTED") && p.totalCents > p.acceptedCents),
    ),
  };
}

// ---------------------------------------------------------------------------
// Registo rápido: sugestões a partir do histórico
// ---------------------------------------------------------------------------

export interface ProcedureSuggestion {
  readonly procedureType: string;
  readonly category: string;
  readonly count: number;
  /** Mediana da duração da primeira consulta, em minutos. */
  readonly usualDurationMinutes: number | null;
  /** Preço mais frequente (moda), em cêntimos. */
  readonly usualPriceCents: number;
  readonly usualListPriceCents: number;
  readonly usualPayerType: string;
  readonly usualPayerName: string | null;
  readonly usualLabCostCents: number;
  readonly usualVisits: number;
}

function mode<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** Sugestões por tipo de procedimento (a partir de 2 registos). */
export function buildSuggestions(procedures: readonly ProcedureRecord[]): ProcedureSuggestion[] {
  const byType = new Map<string, ProcedureRecord[]>();
  for (const p of procedures) {
    const list = byType.get(p.procedureType) ?? [];
    list.push(p);
    byType.set(p.procedureType, list);
  }
  return [...byType.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([procedureType, list]) => {
      const payer = mode(list.map((p) => p.payerType)) ?? "PRIVATE";
      return {
        procedureType,
        category: mode(list.map((p) => p.category)) ?? "Outro",
        count: list.length,
        usualDurationMinutes: median(
          list.flatMap((p) => (p.sessions[0] ? [p.sessions[0].endMinute - p.sessions[0].startMinute] : [])),
        ),
        usualPriceCents: mode(list.map((p) => p.billedCents)) ?? 0,
        usualListPriceCents: mode(list.map((p) => p.listPriceCents)) ?? 0,
        usualPayerType: payer,
        usualPayerName: mode(list.filter((p) => p.payerType === payer).map((p) => p.payerName)) ?? null,
        usualLabCostCents: mode(list.map((p) => p.labCostCents)) ?? 0,
        usualVisits: mode(list.map((p) => p.plannedVisits)) ?? 1,
      };
    })
    .sort((a, b) => b.count - a.count);
}
