/**
 * Estado do cliente: os dados vindos do Sheets convertidos para registos de
 * domínio. Todos os cálculos são feitos aqui, no iPhone, com as mesmas funções
 * da app Next (`domain/views.ts`) — o servidor só lê, valida e grava.
 */
import type { AppData } from "../server/api";
import type { ClosingRecord } from "@/modules/production/domain/closing";
import type { ExamRecord } from "@/modules/production/domain/exams";
import type { GoalInput } from "@/modules/production/domain/goals";
import type { ProcedureRecord, SessionRecord } from "@/modules/production/domain/metrics";
import type { AbsenceRecord, ClinicalDayRecord, PlanRecord } from "@/modules/production/domain/monthly";
import type { ProductionRecords, ProfileSettings } from "@/modules/production/domain/views";

export interface Template {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly priceCents: number;
  readonly durationMinutes: number;
  readonly plannedVisits: number;
  readonly labCostCents: number;
  readonly payerType: string;
  readonly favorite: boolean;
}

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly centsPerHour: number | null;
  readonly hoursPerMonth: number;
}

export interface ScheduleBlock {
  readonly weekday: number;
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface DayRow extends ClinicalDayRecord {
  readonly id: string;
  readonly note: string | null;
}

export interface ProcedureFull extends ProcedureRecord {
  readonly note: string | null;
  readonly createdAt: string;
}

export interface PlanFull extends PlanRecord {
  readonly note: string | null;
}

export interface Exam extends ExamRecord {
  readonly note: string | null;
  readonly createdAt: string;
}

export interface ExamType {
  readonly id: string;
  readonly name: string;
  /** 0 = sem valor predefinido. */
  readonly priceCents: number;
}

export interface State {
  readonly raw: AppData;
  readonly today: string;
  readonly profile: ProfileSettings & { readonly id: string };
  readonly goals: GoalInput[];
  readonly scenarios: Scenario[];
  readonly schedule: ScheduleBlock[];
  readonly templates: Template[];
  readonly days: DayRow[];
  readonly procedures: ProcedureFull[];
  readonly sessions: SessionRecord[];
  readonly absences: AbsenceRecord[];
  readonly plans: PlanFull[];
  /** Exames: à parte da produção clínica e do €/hora (D-059). */
  readonly exams: Exam[];
  readonly examTypes: ExamType[];
  /** Fechos do mês (folha de honorários), por ordem de mês (D-060). */
  readonly closings: ClosingRecord[];
  readonly records: ProductionRecords;
}

const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const ns = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

export function buildState(data: AppData): State {
  const sessions: SessionRecord[] = data.sessions.map((x) => ({
    id: s(x.id),
    procedureId: s(x.procedureId),
    date: s(x.date),
    startMinute: n(x.startMinute),
    endMinute: n(x.endMinute),
  }));
  const byProcedure = new Map<string, SessionRecord[]>();
  for (const x of sessions) byProcedure.set(x.procedureId, [...(byProcedure.get(x.procedureId) ?? []), x]);
  for (const list of byProcedure.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute);

  const procedures: ProcedureFull[] = data.procedures
    .map((p) => ({
      id: s(p.id),
      date: s(p.date),
      caseCode: ns(p.caseCode),
      procedureType: s(p.procedureType),
      category: s(p.category),
      listPriceCents: n(p.listPriceCents),
      billedCents: n(p.billedCents),
      payerType: s(p.payerType) || "PRIVATE",
      payerName: ns(p.payerName),
      plannedVisits: n(p.plannedVisits) || 1,
      labCostCents: n(p.labCostCents),
      otherCostCents: n(p.otherCostCents),
      completed: Boolean(p.completed),
      note: ns(p.note),
      createdAt: s(p.createdAt),
      sessions: byProcedure.get(s(p.id)) ?? [],
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const days: DayRow[] = data.days.map((d) => ({
    id: s(d.id),
    date: s(d.date),
    startMinute: n(d.startMinute),
    endMinute: n(d.endMinute),
    breakMinutes: n(d.breakMinutes),
    status: s(d.status) || "WORKED",
    note: ns(d.note),
  }));
  const absences: AbsenceRecord[] = data.absences.map((a) => ({
    id: s(a.id),
    date: s(a.date),
    startMinute: n(a.startMinute),
    durationMinutes: n(a.durationMinutes),
    plannedProcedure: ns(a.plannedProcedure),
    estimatedValueCents: n(a.estimatedValueCents),
    payerType: s(a.payerType) || "PRIVATE",
    kind: s(a.kind),
    slotRecovered: Boolean(a.slotRecovered),
    recoveredValueCents: n(a.recoveredValueCents),
  }));
  const plans: PlanFull[] = data.plans.map((p) => ({
    id: s(p.id),
    caseCode: s(p.caseCode),
    presentedDate: s(p.presentedDate),
    diagnosedCents: n(p.diagnosedCents),
    totalCents: n(p.totalCents),
    phases: n(p.phases) || 1,
    status: s(p.status),
    acceptedCents: n(p.acceptedCents),
    performedCents: n(p.performedCents),
    lastContactDate: ns(p.lastContactDate),
    nextAppointmentBooked: Boolean(p.nextAppointmentBooked),
    note: ns(p.note),
  }));
  const pr = data.profile;
  return {
    raw: data,
    today: data.today,
    profile: {
      id: s(pr.id),
      name: s(pr.name),
      feeBps: n(pr.feeBps),
      feeBase: s(pr.feeBase) || "BILLED",
      standardSlotMinutes: n(pr.standardSlotMinutes) || 45,
      saturdayMinutes: n(pr.saturdayMinutes),
      primaryGoalCentsPerHour: n(pr.primaryGoalCentsPerHour),
      targetNoShowBps: n(pr.targetNoShowBps),
      followUpMinCents: n(pr.followUpMinCents),
      followUpPriorityCents: n(pr.followUpPriorityCents),
      followUpFirstAlertDays: n(pr.followUpFirstAlertDays),
      followUpSecondAlertDays: n(pr.followUpSecondAlertDays),
    },
    goals: data.goals.map((g) => ({ label: s(g.label), centsPerHour: n(g.centsPerHour) })),
    scenarios: data.scenarios.map((c) => ({ id: s(c.id), name: s(c.name), centsPerHour: c.centsPerHour === null || c.centsPerHour === "" ? null : n(c.centsPerHour), hoursPerMonth: n(c.hoursPerMonth) })),
    schedule: data.schedule.map((b) => ({ weekday: n(b.weekday), startMinute: n(b.startMinute), endMinute: n(b.endMinute) })),
    templates: data.templates
      .map((t) => ({ id: s(t.id), name: s(t.name), category: s(t.category), priceCents: n(t.priceCents), durationMinutes: n(t.durationMinutes), plannedVisits: n(t.plannedVisits) || 1, labCostCents: n(t.labCostCents), payerType: s(t.payerType) || "PRIVATE", favorite: Boolean(t.favorite) }))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "pt")),
    days,
    procedures,
    sessions,
    absences,
    plans,
    // `?? []`: dados de uma versão anterior do servidor, ainda sem exames.
    exams: (data.exams ?? [])
      .map((x) => ({ id: s(x.id), date: s(x.date), examType: s(x.examType), caseCode: ns(x.caseCode), billedCents: n(x.billedCents), note: ns(x.note), createdAt: s(x.createdAt) }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    examTypes: (data.examTypes ?? []).map((t) => ({ id: s(t.id), name: s(t.name), priceCents: n(t.priceCents) })),
    closings: (data.closings ?? []).map((c) => ({
      id: s(c.id),
      month: s(c.month),
      receivedCents: n(c.receivedCents),
      productionCents: c.productionCents === null || c.productionCents === "" ? null : n(c.productionCents),
      clinicalMinutes: c.clinicalMinutes === null || c.clinicalMinutes === "" ? null : n(c.clinicalMinutes),
      note: ns(c.note),
    })),
    records: { days, procedures, sessions, absences, plans },
  };
}
