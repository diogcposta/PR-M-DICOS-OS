/**
 * Resumo de um mês: produção, horas, faltas, agenda e planos.
 *
 * Definições (docs/PRODUCAO.md):
 *  - horas clínicas = Σ (fim − início − pausa) dos dias REALIZADOS;
 *  - €/h = produção / horas clínicas; produção/dia = produção / dias realizados;
 *  - agendamentos = consultas (sessões) realizadas no mês;
 *  - faltas = faltas + cancelamentos tardios (o slot já não pode ser reocupado);
 *    cancelamentos antecipados ficam de fora da taxa e são mostrados à parte;
 *  - taxa de faltas = faltas / (consultas realizadas + faltas);
 *  - horas perdidas = duração das faltas cuja vaga NÃO foi recuperada;
 *  - receita líquida perdida = valor estimado das faltas − receita recuperada.
 */
import { safeDivide, type Ratio } from "@/modules/kpis/domain/ratio";

import {
  centsPerHour,
  feeFromBase,
  sessionMinutes,
  type FeeSettings,
  type ProcedureRecord,
  type SessionRecord,
} from "./metrics";
import { unionMinutes } from "./time";

export interface ClinicalDayRecord {
  readonly date: string;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly breakMinutes: number;
  readonly status: string;
}

export interface AbsenceRecord {
  readonly id: string;
  readonly date: string;
  readonly startMinute: number;
  readonly durationMinutes: number;
  readonly plannedProcedure: string | null;
  readonly estimatedValueCents: number;
  readonly payerType: string;
  readonly kind: string;
  readonly slotRecovered: boolean;
  readonly recoveredValueCents: number;
}

export interface PlanRecord {
  readonly id: string;
  readonly caseCode: string;
  readonly presentedDate: string;
  readonly diagnosedCents: number;
  readonly totalCents: number;
  readonly phases: number;
  readonly status: string;
  readonly acceptedCents: number;
  readonly performedCents: number;
  readonly lastContactDate: string | null;
  readonly nextAppointmentBooked: boolean;
}

/** Minutos disponíveis num dia: fim − início − pausa (nunca negativo). */
export function dayAvailableMinutes(day: Pick<ClinicalDayRecord, "startMinute" | "endMinute" | "breakMinutes">): number {
  return Math.max(0, day.endMinute - day.startMinute - day.breakMinutes);
}

export function isMissedKind(kind: string): boolean {
  return kind === "NO_SHOW" || kind === "LATE_CANCEL";
}

export interface AbsenceSummary {
  readonly noShowCount: number;
  readonly lateCancelCount: number;
  readonly earlyCancelCount: number;
  /** Faltas + cancelamentos tardios. */
  readonly missedCount: number;
  readonly missedRate: Ratio;
  readonly lostMinutes: number;
  readonly grossLostCents: number;
  readonly recoveredCents: number;
  readonly netLostCents: number;
  readonly recoveredSlots: number;
  readonly earlyCancelValueCents: number;
}

export function summariseAbsences(
  absences: readonly AbsenceRecord[],
  completedAppointments: number,
): AbsenceSummary {
  const missed = absences.filter((a) => isMissedKind(a.kind));
  const gross = missed.reduce((s, a) => s + a.estimatedValueCents, 0);
  const recovered = missed.reduce(
    (s, a) => s + (a.slotRecovered ? a.recoveredValueCents : 0),
    0,
  );
  return {
    noShowCount: absences.filter((a) => a.kind === "NO_SHOW").length,
    lateCancelCount: absences.filter((a) => a.kind === "LATE_CANCEL").length,
    earlyCancelCount: absences.filter((a) => a.kind === "EARLY_CANCEL").length,
    missedCount: missed.length,
    missedRate: safeDivide(missed.length, completedAppointments + missed.length),
    lostMinutes: missed
      .filter((a) => !a.slotRecovered)
      .reduce((s, a) => s + a.durationMinutes, 0),
    grossLostCents: gross,
    recoveredCents: recovered,
    // A receita recuperada nunca "cria" produção: o líquido perdido não desce de 0.
    netLostCents: Math.max(0, gross - recovered),
    recoveredSlots: missed.filter((a) => a.slotRecovered).length,
    earlyCancelValueCents: absences
      .filter((a) => a.kind === "EARLY_CANCEL")
      .reduce((s, a) => s + a.estimatedValueCents, 0),
  };
}

export interface AgendaEfficiency {
  readonly availableMinutes: number;
  readonly bookedMinutes: number;
  readonly workedMinutes: number;
  readonly lostMinutes: number;
  readonly emptyMinutes: number;
  /** Marcado / disponível. */
  readonly theoreticalOccupancy: Ratio;
  /** Efetivamente trabalhado / disponível. */
  readonly realOccupancy: Ratio;
  /** Consultas em dias sem registo de dia clínico (não contam nas horas disponíveis). */
  readonly sessionsOutsideDays: number;
}

/**
 * Eficiência da agenda.
 *
 * Tempo trabalhado = união das consultas de cada dia (duas consultas sobrepostas
 * não contam a dobrar). Só entram consultas de dias com registo de dia clínico,
 * para a ocupação nunca passar artificialmente de 100%.
 */
export function agendaEfficiency(
  days: readonly ClinicalDayRecord[],
  sessions: readonly SessionRecord[],
  absences: readonly AbsenceRecord[],
): AgendaEfficiency {
  const worked = days.filter((d) => d.status === "WORKED");
  const workedDates = new Set(worked.map((d) => d.date));
  const available = worked.reduce((s, d) => s + dayAvailableMinutes(d), 0);

  const byDate = new Map<string, SessionRecord[]>();
  let outside = 0;
  for (const s of sessions) {
    if (!workedDates.has(s.date)) {
      outside += 1;
      continue;
    }
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }
  let workedMinutes = 0;
  for (const list of byDate.values()) workedMinutes += unionMinutes(list);

  const lost = absences
    .filter((a) => isMissedKind(a.kind) && !a.slotRecovered && workedDates.has(a.date))
    .reduce((s, a) => s + a.durationMinutes, 0);
  const booked = workedMinutes + lost;

  return {
    availableMinutes: available,
    bookedMinutes: booked,
    workedMinutes,
    lostMinutes: lost,
    emptyMinutes: Math.max(0, available - booked),
    theoreticalOccupancy: safeDivide(booked, available),
    realOccupancy: safeDivide(workedMinutes, available),
    sessionsOutsideDays: outside,
  };
}

export interface PlanSummary {
  readonly presentedCount: number;
  readonly presentedCents: number;
  readonly acceptedCount: number;
  readonly acceptedCents: number;
  /** Planos aceites (total ou parcialmente) / planos apresentados. */
  readonly acceptanceRateByCount: Ratio;
  /** Valor aceite / valor apresentado. */
  readonly acceptanceRateByValue: Ratio;
  /** Aceite mas ainda não realizado (planos não rejeitados). */
  readonly pendingTreatmentCents: number;
  /** Apresentado e não aceite (rejeitado ou ainda sem decisão). */
  readonly notAdvancedCents: number;
}

export const ACCEPTED_STATUSES = new Set(["PARTIALLY_ACCEPTED", "ACCEPTED", "COMPLETED"]);

export function summarisePlans(plans: readonly PlanRecord[]): PlanSummary {
  const accepted = plans.filter((p) => ACCEPTED_STATUSES.has(p.status));
  const presentedCents = plans.reduce((s, p) => s + p.totalCents, 0);
  const acceptedCents = plans.reduce((s, p) => s + p.acceptedCents, 0);
  return {
    presentedCount: plans.length,
    presentedCents,
    acceptedCount: accepted.length,
    acceptedCents,
    acceptanceRateByCount: safeDivide(accepted.length, plans.length),
    acceptanceRateByValue: safeDivide(acceptedCents, presentedCents),
    pendingTreatmentCents: plans
      .filter((p) => p.status !== "REJECTED")
      .reduce((s, p) => s + Math.max(0, p.acceptedCents - p.performedCents), 0),
    notAdvancedCents: plans.reduce((s, p) => s + Math.max(0, p.totalCents - p.acceptedCents), 0),
  };
}

export interface MonthlySummary {
  readonly month: string;
  readonly productionCents: number;
  readonly feeCents: number;
  readonly directCostsCents: number;
  readonly clinicalMinutes: number;
  readonly plannedMinutes: number;
  readonly workedDays: number;
  readonly plannedDays: number;
  readonly centsPerHour: Ratio;
  readonly feeCentsPerHour: Ratio;
  readonly productionPerDayCents: Ratio;
  readonly procedureCount: number;
  readonly appointmentCount: number;
  /** Receita média por caso (Case ID) com produção no mês. */
  readonly avgCaseValueCents: Ratio;
  /** Produção projetada para o fim do mês: atual + €/h × horas dos dias previstos. */
  readonly projectedProductionCents: number | null;
  readonly absences: AbsenceSummary;
  readonly agenda: AgendaEfficiency;
  readonly plans: PlanSummary;
}

export interface MonthInput {
  readonly month: string;
  readonly days: readonly ClinicalDayRecord[];
  /** Procedimentos com data no mês (a receita conta aqui). */
  readonly procedures: readonly ProcedureRecord[];
  /** Consultas com data no mês (o tempo de cadeira conta aqui). */
  readonly sessions: readonly SessionRecord[];
  readonly absences: readonly AbsenceRecord[];
  /** Planos apresentados no mês. */
  readonly plans: readonly PlanRecord[];
}

export function summariseMonth(input: MonthInput, fees: FeeSettings): MonthlySummary {
  const production = input.procedures.reduce((s, p) => s + p.billedCents, 0);
  const directCosts = input.procedures.reduce((s, p) => s + p.labCostCents + p.otherCostCents, 0);
  // Um único arredondamento sobre o total do mês: somar honorários já
  // arredondados procedimento a procedimento podia desviar alguns cêntimos.
  const fee = feeFromBase(fees.feeBase === "NET" ? production - directCosts : production, fees.feeBps);

  const workedDays = input.days.filter((d) => d.status === "WORKED");
  const plannedDays = input.days.filter((d) => d.status === "PLANNED");
  const clinicalMinutes = workedDays.reduce((s, d) => s + dayAvailableMinutes(d), 0);
  const plannedMinutes = plannedDays.reduce((s, d) => s + dayAvailableMinutes(d), 0);
  const cph = centsPerHour(production, clinicalMinutes);

  const caseValues = new Map<string, number>();
  for (const p of input.procedures) {
    if (p.caseCode) caseValues.set(p.caseCode, (caseValues.get(p.caseCode) ?? 0) + p.billedCents);
  }
  const caseTotal = [...caseValues.values()].reduce((s, v) => s + v, 0);

  return {
    month: input.month,
    productionCents: production,
    feeCents: fee,
    directCostsCents: directCosts,
    clinicalMinutes,
    plannedMinutes,
    workedDays: workedDays.length,
    plannedDays: plannedDays.length,
    centsPerHour: cph,
    feeCentsPerHour: centsPerHour(fee, clinicalMinutes),
    productionPerDayCents: safeDivide(production, workedDays.length),
    procedureCount: input.procedures.length,
    appointmentCount: input.sessions.length,
    avgCaseValueCents: safeDivide(caseTotal, caseValues.size),
    projectedProductionCents:
      cph === null ? null : Math.round(production + (cph * plannedMinutes) / 60),
    absences: summariseAbsences(input.absences, input.sessions.length),
    agenda: agendaEfficiency(input.days, input.sessions, input.absences),
    plans: summarisePlans(input.plans),
  };
}

/** Total de minutos de cadeira de uma lista de consultas (soma simples). */
export function totalSessionMinutes(sessions: readonly SessionRecord[]): number {
  return sessions.reduce((s, x) => s + sessionMinutes(x), 0);
}
