import { describe, expect, it } from "vitest";

import {
  agendaEfficiency,
  dayAvailableMinutes,
  summariseAbsences,
  summariseMonth,
  summarisePlans,
  type AbsenceRecord,
  type ClinicalDayRecord,
  type PlanRecord,
} from "@/modules/production/domain/monthly";

import { FEES_50, proc } from "./helpers";

const day = (date: string, overrides: Partial<ClinicalDayRecord> = {}): ClinicalDayRecord => ({
  date,
  startMinute: 570,
  endMinute: 1140,
  breakMinutes: 120,
  status: "WORKED",
  ...overrides,
});

const absence = (overrides: Partial<AbsenceRecord> = {}): AbsenceRecord => ({
  id: "a",
  date: "2026-09-01",
  startMinute: 600,
  durationMinutes: 45,
  plannedProcedure: "Restauração",
  estimatedValueCents: 7_000,
  payerType: "PRIVATE",
  kind: "NO_SHOW",
  slotRecovered: false,
  recoveredValueCents: 0,
  ...overrides,
});

describe("dia clínico", () => {
  it("09:30–19:00 com 2 h de pausa = 7,5 h disponíveis", () => {
    expect(dayAvailableMinutes(day("2026-09-01"))).toBe(450);
  });
  it("nunca devolve minutos negativos", () => {
    expect(dayAvailableMinutes({ startMinute: 600, endMinute: 620, breakMinutes: 60 })).toBe(0);
  });
});

describe("resumo do mês", () => {
  it("€8.619 em 130,5 h → ≈66,05 €/h e honorários €4.309,50", () => {
    const days = Array.from({ length: 17 }, (_, i) => day(`2026-09-${String(i + 1).padStart(2, "0")}`));
    // 17 × 7,5 h = 127,5 h + um sábado de 3 h = 130,5 h
    days.push(day("2026-09-19", { startMinute: 570, endMinute: 750, breakMinutes: 0 }));
    const summary = summariseMonth(
      { month: "2026-09", days, procedures: [proc({ billedCents: 861_900 })], sessions: [], absences: [], plans: [] },
      FEES_50,
    );
    expect(summary.clinicalMinutes).toBe(7_830);
    expect(summary.productionCents).toBe(861_900);
    expect(summary.feeCents).toBe(430_950);
    expect(summary.centsPerHour! / 100).toBeCloseTo(66.05, 2);
    expect(summary.productionPerDayCents).toBeCloseTo(861_900 / 18, 5);
  });

  it("sem horas nem dias: rácios sem dados em vez de 0 ou Infinity", () => {
    const summary = summariseMonth(
      { month: "2026-09", days: [], procedures: [], sessions: [], absences: [], plans: [] },
      FEES_50,
    );
    expect(summary.centsPerHour).toBeNull();
    expect(summary.productionPerDayCents).toBeNull();
    expect(summary.absences.missedRate).toBeNull();
    expect(summary.agenda.realOccupancy).toBeNull();
    expect(summary.plans.acceptanceRateByValue).toBeNull();
    expect(summary.projectedProductionCents).toBeNull();
    expect(summary.avgCaseValueCents).toBeNull();
  });

  it("dias previstos não contam nas horas, só na projeção de fim de mês", () => {
    const summary = summariseMonth(
      {
        month: "2026-09",
        days: [day("2026-09-01"), day("2026-09-29", { status: "PLANNED" })],
        procedures: [proc({ billedCents: 45_000 })],
        sessions: [],
        absences: [],
        plans: [],
      },
      FEES_50,
    );
    expect(summary.clinicalMinutes).toBe(450);
    expect(summary.plannedMinutes).toBe(450);
    expect(summary.projectedProductionCents).toBe(90_000);
  });

  it("a receita conta uma vez por procedimento, mesmo com várias consultas", () => {
    const crown = proc({ billedCents: 60_000, visits: [90, 45, 45] });
    const summary = summariseMonth(
      { month: "2026-09", days: [day("2026-09-01")], procedures: [crown], sessions: crown.sessions, absences: [], plans: [] },
      FEES_50,
    );
    expect(summary.productionCents).toBe(60_000);
    expect(summary.procedureCount).toBe(1);
    expect(summary.appointmentCount).toBe(3);
  });
});

describe("faltas", () => {
  it("calcula taxa, horas e receita perdida/recuperada", () => {
    const summary = summariseAbsences(
      [
        absence({ kind: "NO_SHOW", estimatedValueCents: 7_000 }),
        absence({ kind: "LATE_CANCEL", estimatedValueCents: 5_000, slotRecovered: true, recoveredValueCents: 4_000, durationMinutes: 30 }),
        absence({ kind: "EARLY_CANCEL", estimatedValueCents: 9_000 }),
      ],
      18,
    );
    expect(summary.missedCount).toBe(2);
    expect(summary.missedRate).toBeCloseTo(2 / 20, 10);
    expect(summary.lostMinutes).toBe(45); // a vaga recuperada não é tempo perdido
    expect(summary.grossLostCents).toBe(12_000);
    expect(summary.recoveredCents).toBe(4_000);
    expect(summary.netLostCents).toBe(8_000);
    expect(summary.earlyCancelCount).toBe(1);
    expect(summary.earlyCancelValueCents).toBe(9_000);
  });

  it("receita recuperada superior à estimada não gera perda negativa", () => {
    const summary = summariseAbsences(
      [absence({ estimatedValueCents: 3_000, slotRecovered: true, recoveredValueCents: 9_000 })],
      1,
    );
    expect(summary.netLostCents).toBe(0);
  });
});

describe("eficiência da agenda", () => {
  it("distingue ocupação teórica (marcada) da real (trabalhada)", () => {
    const days = [day("2026-09-01", { startMinute: 600, endMinute: 1200, breakMinutes: 0 })]; // 10 h
    const sessions = [
      { id: "s1", procedureId: "p", date: "2026-09-01", startMinute: 600, endMinute: 1116 }, // 8,6 h
    ];
    const absences = [absence({ date: "2026-09-01", durationMinutes: 84 })]; // 1,4 h
    const agenda = agendaEfficiency(days, sessions, absences);
    expect(agenda.theoreticalOccupancy).toBe(1);
    expect(agenda.realOccupancy).toBeCloseTo(0.86, 10);
    expect(agenda.emptyMinutes).toBe(0);
  });

  it("consultas sobrepostas não contam a dobrar", () => {
    const agenda = agendaEfficiency(
      [day("2026-09-01")],
      [
        { id: "a", procedureId: "p", date: "2026-09-01", startMinute: 600, endMinute: 660 },
        { id: "b", procedureId: "q", date: "2026-09-01", startMinute: 630, endMinute: 690 },
      ],
      [],
    );
    expect(agenda.workedMinutes).toBe(90);
  });

  it("consultas em dias sem registo não entram nas horas disponíveis nem trabalhadas", () => {
    const agenda = agendaEfficiency(
      [day("2026-09-01")],
      [{ id: "a", procedureId: "p", date: "2026-09-02", startMinute: 600, endMinute: 660 }],
      [],
    );
    expect(agenda.workedMinutes).toBe(0);
    expect(agenda.sessionsOutsideDays).toBe(1);
  });
});

describe("planos", () => {
  const plan = (overrides: Partial<PlanRecord>): PlanRecord => ({
    id: "x",
    caseCode: "DC-2026-001",
    presentedDate: "2026-09-01",
    diagnosedCents: 100_000,
    totalCents: 100_000,
    phases: 1,
    status: "PRESENTED",
    acceptedCents: 0,
    performedCents: 0,
    lastContactDate: null,
    nextAppointmentBooked: false,
    ...overrides,
  });

  it("taxa de aceitação por número e por valor; pendentes e não avançados", () => {
    const summary = summarisePlans([
      plan({ status: "ACCEPTED", acceptedCents: 100_000, performedCents: 40_000 }),
      plan({ status: "PARTIALLY_ACCEPTED", totalCents: 200_000, acceptedCents: 50_000 }),
      plan({ status: "REJECTED" }),
      plan({ status: "PRESENTED" }),
    ]);
    expect(summary.acceptanceRateByCount).toBe(0.5);
    expect(summary.acceptanceRateByValue).toBe(150_000 / 500_000);
    expect(summary.pendingTreatmentCents).toBe(60_000 + 50_000);
    expect(summary.notAdvancedCents).toBe(150_000 + 100_000 + 100_000);
  });
});
