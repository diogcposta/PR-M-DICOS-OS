/**
 * Leituras e composição das páginas do módulo de produção.
 *
 * Lê da base, converte para registos de domínio e delega todos os cálculos no
 * domínio. Nenhuma fórmula vive aqui.
 */
import { productionDb, type ProductionDb } from "@/lib/db/production";

import { agreementImpact, analyseCases, insurerAnalysis, overallChairCentsPerHour, payerComparison, profitabilityMatrix, procedureMetrics, type ProcedureRecord, type SessionRecord } from "../domain/metrics";
import { gapToNextGoal, projectGoals } from "../domain/goals";
import { buildInsights, followUpHealth, topActions, type InsightInput } from "../domain/insights";
import { summariseMonth, type AbsenceRecord, type ClinicalDayRecord, type MonthlySummary, type PlanRecord } from "../domain/monthly";
import { followUpList, openPlanCents, treatmentFunnel } from "../domain/plans";
import { efficiencyScore } from "../domain/score";
import { addMonths, monthOf, monthRange, monthsEndingAt, todayInLisbon } from "../domain/time";

import { feeSettings, followUpRules, getOrCreateProfile, type Profile } from "./profile";

// ---------------------------------------------------------------------------
// Carregamento e conversão
// ---------------------------------------------------------------------------

const procedureInclude = {
  sessions: { orderBy: [{ date: "asc" as const }, { startMinute: "asc" as const }] },
  case: { select: { code: true } },
};

type ProcedureRow = Awaited<ReturnType<typeof loadProcedureRows>>[number];

async function loadProcedureRows(db: ProductionDb, doctorId: string, from: string, to: string) {
  return db.procedure.findMany({
    where: { doctorId, date: { gte: from, lte: to } },
    include: procedureInclude,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

export function toProcedureRecord(row: ProcedureRow): ProcedureRecord {
  return {
    id: row.id,
    date: row.date,
    caseCode: row.case?.code ?? null,
    procedureType: row.procedureType,
    category: row.category,
    listPriceCents: row.listPriceCents,
    billedCents: row.billedCents,
    payerType: row.payerType,
    payerName: row.payerName,
    plannedVisits: row.plannedVisits,
    labCostCents: row.labCostCents,
    otherCostCents: row.otherCostCents,
    completed: row.completed,
    sessions: row.sessions.map((s) => ({
      id: s.id,
      procedureId: s.procedureId,
      date: s.date,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
    })),
  };
}

export async function loadProcedures(from: string, to: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return (await loadProcedureRows(db, profile.id, from, to)).map(toProcedureRecord);
}

interface RangeData {
  days: ClinicalDayRecord[];
  procedures: ProcedureRecord[];
  sessions: SessionRecord[];
  absences: AbsenceRecord[];
  plans: PlanRecord[];
}

async function loadRange(db: ProductionDb, profile: Profile, from: string, to: string): Promise<RangeData> {
  const [days, procedures, sessions, absences, plans] = await Promise.all([
    db.clinicalDay.findMany({ where: { doctorId: profile.id, date: { gte: from, lte: to } } }),
    loadProcedureRows(db, profile.id, from, to),
    db.procedureSession.findMany({ where: { doctorId: profile.id, date: { gte: from, lte: to } } }),
    db.absenceEvent.findMany({ where: { doctorId: profile.id, date: { gte: from, lte: to } } }),
    db.treatmentPlan.findMany({
      where: { doctorId: profile.id, presentedDate: { gte: from, lte: to } },
      include: { case: { select: { code: true } } },
    }),
  ]);
  return {
    days,
    procedures: procedures.map(toProcedureRecord),
    sessions,
    absences,
    plans: plans.map(toPlanRecord),
  };
}

type PlanRow = { id: string; presentedDate: string; diagnosedCents: number; totalCents: number; phases: number; status: string; acceptedCents: number; performedCents: number; lastContactDate: string | null; nextAppointmentBooked: boolean; case: { code: string } };

function toPlanRecord(p: PlanRow): PlanRecord {
  return {
    id: p.id,
    caseCode: p.case.code,
    presentedDate: p.presentedDate,
    diagnosedCents: p.diagnosedCents,
    totalCents: p.totalCents,
    phases: p.phases,
    status: p.status,
    acceptedCents: p.acceptedCents,
    performedCents: p.performedCents,
    lastContactDate: p.lastContactDate,
    nextAppointmentBooked: p.nextAppointmentBooked,
  };
}

function monthSlice(data: RangeData, month: string) {
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

/** Resumos de `count` meses terminando em `lastMonth`, com uma única ida à base. */
export async function monthlySummaries(lastMonth: string, count: number, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const months = monthsEndingAt(lastMonth, count);
  const data = await loadRange(db, profile, monthRange(months[0]!).from, monthRange(lastMonth).to);
  const fees = feeSettings(profile);
  return months.map((m) => summariseMonth(monthSlice(data, m), fees));
}

async function allPlans(db: ProductionDb, doctorId: string, upTo?: string) {
  const rows = await db.treatmentPlan.findMany({
    where: { doctorId, ...(upTo ? { presentedDate: { lte: upTo } } : {}) },
    include: { case: { select: { code: true } } },
    orderBy: { presentedDate: "desc" },
  });
  return rows.map(toPlanRecord);
}

/** Mês por omissão: o mais recente com dados, ou o mês corrente. */
export async function defaultMonth(db: ProductionDb = productionDb): Promise<string> {
  const profile = await getOrCreateProfile(db);
  const today = todayInLisbon();
  const latest = await db.procedure.findFirst({
    where: { doctorId: profile.id, date: { lte: today } },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return latest ? monthOf(latest.date) : monthOf(today);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(month: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const fees = feeSettings(profile);
  const range = monthRange(month);
  const trendMonths = monthsEndingAt(month, 6);
  const [data, goals, plansUpTo] = await Promise.all([
    loadRange(db, profile, monthRange(trendMonths[0]!).from, range.to),
    db.productionGoal.findMany({ where: { doctorId: profile.id }, orderBy: { centsPerHour: "asc" } }),
    allPlans(db, profile.id, range.to),
  ]);

  const summaries = trendMonths.map((m) => summariseMonth(monthSlice(data, m), fees));
  const current = summaries.at(-1)!;
  const previous = summaries.at(-2) ?? null;
  const monthProcedures = data.procedures.filter((p) => monthOf(p.date) === month);

  const today = todayInLisbon();
  const referenceDate = today < range.to ? today : range.to;
  const followUps = followUpList(plansUpTo, referenceDate, followUpRules(profile));
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

  const goalInputs = goals.map((g) => ({ label: g.label, centsPerHour: g.centsPerHour }));

  return {
    profile,
    month,
    current,
    previous,
    summaries,
    goals: projectGoals(goalInputs, current.centsPerHour, current.clinicalMinutes, profile.feeBps),
    gap: gapToNextGoal(goalInputs, current.centsPerHour),
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

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

// ---------------------------------------------------------------------------
// Rentabilidade, seguros e casos
// ---------------------------------------------------------------------------

export async function getProfitability(from: string, to: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const fees = feeSettings(profile);
  const [procedures, lowestGoal] = await Promise.all([
    loadProcedures(from, to, db),
    db.productionGoal.findFirst({ where: { doctorId: profile.id }, orderBy: { centsPerHour: "asc" } }),
  ]);
  const lowest = lowestGoal?.centsPerHour ?? null;
  return {
    profile,
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

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export async function getPlansOverview(from: string, to: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const plans = await allPlans(db, profile.id);
  const inRange = plans.filter((p) => p.presentedDate >= from && p.presentedDate <= to);
  const rows = await db.treatmentPlan.findMany({
    where: { doctorId: profile.id },
    include: { case: { select: { code: true } } },
    orderBy: { presentedDate: "desc" },
  });
  return {
    profile,
    plans: rows,
    inRange,
    funnel: treatmentFunnel(inRange),
    followUps: followUpList(plans, todayInLisbon(), followUpRules(profile)),
    notAdvanced: inRange.filter(
      (p) => p.status === "REJECTED" || ((p.status === "PRESENTED" || p.status === "PENDING" || p.status === "PARTIALLY_ACCEPTED") && p.totalCents > p.acceptedCents),
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

export async function getEntryContext(date: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const since = addMonths(monthOf(date), -12);
  const [history, templates, cases, lastRow, daySessions, payers] = await Promise.all([
    loadProcedures(monthRange(since).from, "9999-12-31", db),
    db.procedureTemplate.findMany({ where: { doctorId: profile.id }, orderBy: [{ favorite: "desc" }, { name: "asc" }] }),
    db.clinicalCase.findMany({ where: { doctorId: profile.id }, orderBy: { code: "desc" }, take: 200, select: { code: true } }),
    db.procedure.findFirst({ where: { doctorId: profile.id }, orderBy: [{ createdAt: "desc" }], include: procedureInclude }),
    db.procedureSession.findMany({ where: { doctorId: profile.id, date }, orderBy: { startMinute: "asc" } }),
    db.procedure.findMany({ where: { doctorId: profile.id, payerName: { not: null } }, distinct: ["payerName"], select: { payerName: true } }),
  ]);
  return {
    profile,
    suggestions: buildSuggestions(history),
    templates,
    caseCodes: cases.map((c) => c.code),
    last: lastRow ? toProcedureRecord(lastRow) : null,
    /** Fim da última consulta do dia: hora de início sugerida para a próxima. */
    nextStartMinute: daySessions.at(-1)?.endMinute ?? null,
    payerNames: payers.map((p) => p.payerName).filter((n): n is string => Boolean(n)).sort(),
  };
}

// ---------------------------------------------------------------------------
// Dia e agenda
// ---------------------------------------------------------------------------

export async function getDay(date: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const [day, sessions, absences, procedures, schedule] = await Promise.all([
    db.clinicalDay.findUnique({ where: { doctorId_date: { doctorId: profile.id, date } } }),
    db.procedureSession.findMany({
      where: { doctorId: profile.id, date },
      include: { procedure: { include: { case: { select: { code: true } } } } },
      orderBy: { startMinute: "asc" },
    }),
    db.absenceEvent.findMany({ where: { doctorId: profile.id, date }, orderBy: { startMinute: "asc" } }),
    db.procedure.findMany({ where: { doctorId: profile.id, date }, include: procedureInclude, orderBy: { createdAt: "asc" } }),
    db.scheduleBlock.findMany({ where: { doctorId: profile.id }, orderBy: { startMinute: "asc" } }),
  ]);
  return { profile, day, sessions, absences, procedures: procedures.map(toProcedureRecord), schedule };
}

export async function listClinicalDays(from: string, to: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const [days, sessions, procedures] = await Promise.all([
    db.clinicalDay.findMany({ where: { doctorId: profile.id, date: { gte: from, lte: to } }, orderBy: { date: "desc" } }),
    db.procedureSession.groupBy({ by: ["date"], where: { doctorId: profile.id, date: { gte: from, lte: to } }, _count: { _all: true } }),
    db.procedure.groupBy({ by: ["date"], where: { doctorId: profile.id, date: { gte: from, lte: to } }, _sum: { billedCents: true } }),
  ]);
  const sessionsByDate = new Map(sessions.map((s) => [s.date, s._count._all]));
  const productionByDate = new Map(procedures.map((p) => [p.date, p._sum.billedCents ?? 0]));
  return days.map((d) => ({
    ...d,
    sessionCount: sessionsByDate.get(d.date) ?? 0,
    productionCents: productionByDate.get(d.date) ?? 0,
  }));
}

export async function getProcedure(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const row = await db.procedure.findFirst({ where: { id, doctorId: profile.id }, include: procedureInclude });
  if (!row) return null;
  const lowestGoal = await db.productionGoal.findFirst({ where: { doctorId: profile.id }, orderBy: { centsPerHour: "asc" } });
  const record = toProcedureRecord(row);
  return {
    profile,
    row,
    record,
    metrics: procedureMetrics(record, feeSettings(profile), lowestGoal?.centsPerHour ?? null),
  };
}

export async function listProcedures(from: string, to: string, db: ProductionDb = productionDb) {
  const data = await getProfitability(from, to, db);
  return data;
}

export async function listAbsences(from: string, to: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return db.absenceEvent.findMany({
    where: { doctorId: profile.id, date: { gte: from, lte: to } },
    orderBy: [{ date: "desc" }, { startMinute: "desc" }],
  });
}

// ---------------------------------------------------------------------------
// Relatório mensal
// ---------------------------------------------------------------------------

export async function getMonthlyReport(month: string, db: ProductionDb = productionDb) {
  const dashboard = await getDashboard(month, db);
  const range = monthRange(month);
  const profitability = await getProfitability(range.from, range.to, db);
  return { dashboard, profitability };
}

export type { MonthlySummary };

export async function getPlan(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return db.treatmentPlan.findFirst({ where: { id, doctorId: profile.id }, include: { case: true } });
}
