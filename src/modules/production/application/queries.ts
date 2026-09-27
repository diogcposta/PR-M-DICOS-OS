/**
 * Leituras e composição das páginas do módulo de produção.
 *
 * Lê da base, converte para registos de domínio e delega todos os cálculos no
 * domínio. Nenhuma fórmula vive aqui.
 */
import { productionDb, type ProductionDb } from "@/lib/db/production";

import { procedureMetrics, type ProcedureRecord, type SessionRecord } from "../domain/metrics";
import type { AbsenceRecord, ClinicalDayRecord, MonthlySummary, PlanRecord } from "../domain/monthly";
import { addMonths, monthOf, monthRange, monthsEndingAt, todayInLisbon } from "../domain/time";
import { buildSuggestions, dashboardView, monthlySeries, plansView, profitabilityView } from "../domain/views";

import { feeSettings, getOrCreateProfile, type Profile } from "./profile";

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

/** Resumos de `count` meses terminando em `lastMonth`, com uma única ida à base. */
export async function monthlySummaries(lastMonth: string, count: number, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const months = monthsEndingAt(lastMonth, count);
  const data = await loadRange(db, profile, monthRange(months[0]!).from, monthRange(lastMonth).to);
  return monthlySeries(data, profile, lastMonth, count);
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
  const range = monthRange(month);
  const trendMonths = monthsEndingAt(month, 6);
  const [data, goals, plansUpTo] = await Promise.all([
    loadRange(db, profile, monthRange(trendMonths[0]!).from, range.to),
    db.productionGoal.findMany({ where: { doctorId: profile.id }, orderBy: { centsPerHour: "asc" } }),
    allPlans(db, profile.id, range.to),
  ]);
  const view = dashboardView({ ...data, plans: plansUpTo }, profile, goals, month, todayInLisbon());
  return { profile, ...view };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

// ---------------------------------------------------------------------------
// Rentabilidade, seguros e casos
// ---------------------------------------------------------------------------

export async function getProfitability(from: string, to: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const [procedures, goals] = await Promise.all([
    loadProcedures(from, to, db),
    db.productionGoal.findMany({ where: { doctorId: profile.id } }),
  ]);
  return { profile, ...profitabilityView(procedures, profile, goals) };
}

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export async function getPlansOverview(from: string, to: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const plans = await allPlans(db, profile.id);
  const rows = await db.treatmentPlan.findMany({
    where: { doctorId: profile.id },
    include: { case: { select: { code: true } } },
    orderBy: { presentedDate: "desc" },
  });
  return { profile, plans: rows, ...plansView(plans, profile, from, to, todayInLisbon()) };
}

// ---------------------------------------------------------------------------
// Registo rápido: sugestões a partir do histórico
// ---------------------------------------------------------------------------

export { buildSuggestions, type ProcedureSuggestion } from "../domain/views";

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
