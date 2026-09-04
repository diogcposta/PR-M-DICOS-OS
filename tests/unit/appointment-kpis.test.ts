import { describe, expect, it } from "vitest";

import {
  EMPTY_STATUS_COUNTS,
  type AppointmentStatusCounts,
  calculateAppointmentKpis,
  compareAllAppointmentKpis,
  compareKpi,
  resolvedAppointments,
  totalBooked,
} from "@/modules/kpis/domain/appointment-kpis";

function counts(overrides: Partial<AppointmentStatusCounts> = {}): AppointmentStatusCounts {
  return { ...EMPTY_STATUS_COUNTS, ...overrides };
}

describe("bases de contagem", () => {
  it("exclui as remarcadas do total marcado", () => {
    const value = counts({ COMPLETED: 5, NO_SHOW: 1, CANCELLED: 2, SCHEDULED: 3, RESCHEDULED: 9 });
    // As remarcadas contam na data para onde foram movidas, não aqui.
    expect(totalBooked(value)).toBe(11);
  });

  it("o denominador das taxas são só as consultas com desfecho conhecido", () => {
    const value = counts({ COMPLETED: 5, NO_SHOW: 1, CANCELLED: 2, SCHEDULED: 3, RESCHEDULED: 9 });
    expect(resolvedAppointments(value)).toBe(8);
  });
});

describe("cálculo dos KPIs de agenda", () => {
  it("calcula contagens e taxas", () => {
    const kpis = calculateAppointmentKpis(counts({ COMPLETED: 7, NO_SHOW: 2, CANCELLED: 1 }));

    expect(kpis.appointments_completed.value).toBe(7);
    expect(kpis.no_show_count.value).toBe(2);
    expect(kpis.completion_rate.value).toBe(70);
    expect(kpis.no_show_rate.value).toBe(20);
    expect(kpis.cancellation_rate.value).toBe(10);
  });

  it("as três taxas somam 100% quando há desfechos", () => {
    const kpis = calculateAppointmentKpis(counts({ COMPLETED: 13, NO_SHOW: 4, CANCELLED: 3 }));
    const total =
      (kpis.completion_rate.value ?? 0) +
      (kpis.no_show_rate.value ?? 0) +
      (kpis.cancellation_rate.value ?? 0);
    expect(total).toBeCloseTo(100);
  });

  it("as consultas por realizar não afundam a taxa de realização", () => {
    // Mês a meio: 5 realizadas, 5 ainda por acontecer.
    const kpis = calculateAppointmentKpis(counts({ COMPLETED: 5, SCHEDULED: 5 }));
    expect(kpis.completion_rate.value).toBe(100);
    expect(kpis.completion_rate.denominator).toBe(5);
    // Mas o total marcado continua a incluí-las.
    expect(kpis.appointments_scheduled.value).toBe(10);
  });

  it("devolve null e não 0% quando não há consultas com desfecho", () => {
    const kpis = calculateAppointmentKpis(counts({ SCHEDULED: 4 }));
    expect(kpis.completion_rate.value).toBeNull();
    expect(kpis.no_show_rate.value).toBeNull();
    expect(kpis.cancellation_rate.value).toBeNull();
    expect(kpis.completion_rate.denominator).toBe(0);
    expect(kpis.completion_rate.value).not.toBe(0);
  });

  it("devolve null em todas as taxas quando não há dados nenhuns", () => {
    const kpis = calculateAppointmentKpis(EMPTY_STATUS_COUNTS);
    expect(kpis.completion_rate.value).toBeNull();
    expect(kpis.appointments_scheduled.value).toBe(0);
  });

  it("expõe numerador, denominador e versão para o ecrã poder explicar", () => {
    const kpis = calculateAppointmentKpis(counts({ COMPLETED: 7, NO_SHOW: 2, CANCELLED: 1 }));
    expect(kpis.completion_rate.numerator).toBe(7);
    expect(kpis.completion_rate.denominator).toBe(10);
    expect(kpis.completion_rate.definitionVersion).toBe(1);
    // Contagens não têm denominador; não inventamos um.
    expect(kpis.appointments_completed.denominator).toBeNull();
  });
});

describe("comparação com o período anterior", () => {
  it("compara contagens em variação relativa", () => {
    const kpis = compareAllAppointmentKpis(
      counts({ COMPLETED: 12 }),
      counts({ COMPLETED: 10 }),
    );
    expect(kpis.appointments_completed.changeKind).toBe("RELATIVE");
    expect(kpis.appointments_completed.change).toBeCloseTo(0.2);
  });

  it("compara percentagens em pontos percentuais", () => {
    const kpis = compareAllAppointmentKpis(
      counts({ COMPLETED: 15, NO_SHOW: 5 }),  // 25% de faltas
      counts({ COMPLETED: 18, NO_SHOW: 2 }),  // 10% de faltas
    );
    expect(kpis.no_show_rate.changeKind).toBe("PERCENTAGE_POINTS");
    // +15 pontos percentuais, e não "+150%", que seria ambíguo.
    expect(kpis.no_show_rate.change).toBeCloseTo(15);
  });

  it("não inventa uma variação quando o período anterior está vazio", () => {
    const kpis = compareAllAppointmentKpis(counts({ COMPLETED: 10 }), EMPTY_STATUS_COUNTS);
    // De 0 para 10 não é "+100%" nem "+∞%": é uma comparação que não existe.
    expect(kpis.appointments_completed.change).toBeNull();
    // E a taxa não é comparável porque o anterior não tinha denominador.
    expect(kpis.completion_rate.change).toBeNull();
  });

  it("não compara quando o período atual não tem taxa calculável", () => {
    const comparison = compareKpi(
      calculateAppointmentKpis(counts({ SCHEDULED: 3 })).completion_rate,
      calculateAppointmentKpis(counts({ COMPLETED: 5 })).completion_rate,
    );
    expect(comparison.change).toBeNull();
  });

  it("assinala descidas com valor negativo", () => {
    const kpis = compareAllAppointmentKpis(counts({ COMPLETED: 8 }), counts({ COMPLETED: 10 }));
    expect(kpis.appointments_completed.change).toBeCloseTo(-0.2);
  });
});
