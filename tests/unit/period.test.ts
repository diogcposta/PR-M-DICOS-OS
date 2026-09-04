import { describe, expect, it } from "vitest";

import {
  PeriodError,
  containsInstant,
  createPeriod,
  periodLengthInDays,
  previousPeriod,
  startOfBusinessDay,
} from "@/modules/kpis/domain/period";

describe("períodos em Europe/Lisbon", () => {
  it("usa a meia-noite local, não a meia-noite UTC", () => {
    // Inverno: Lisboa = UTC.
    expect(startOfBusinessDay("2025-01-15").toISOString()).toBe("2025-01-15T00:00:00.000Z");
    // Verão: Lisboa = UTC+1, logo o dia começa às 23:00 do dia anterior em UTC.
    expect(startOfBusinessDay("2025-07-15").toISOString()).toBe("2025-07-14T23:00:00.000Z");
  });

  it("constrói um intervalo semi-aberto [início, fim)", () => {
    const period = createPeriod("2025-01-01", "2025-01-31");
    expect(period.startsAt.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(period.endsAt.toISOString()).toBe("2025-02-01T00:00:00.000Z");
  });

  it("inclui o último dia por inteiro e exclui o instante seguinte", () => {
    const period = createPeriod("2025-01-01", "2025-01-31");
    expect(containsInstant(period, new Date("2025-01-31T23:59:59.999Z"))).toBe(true);
    expect(containsInstant(period, new Date("2025-02-01T00:00:00.000Z"))).toBe(false);
    expect(containsInstant(period, new Date("2024-12-31T23:59:59.999Z"))).toBe(false);
  });

  it("conta dias civis mesmo quando o período atravessa a mudança para a hora de verão", () => {
    // Em Portugal a hora de verão começa a 30 de março de 2025: esse dia tem 23h.
    const period = createPeriod("2025-03-01", "2025-03-31");
    expect(periodLengthInDays(period)).toBe(31);
    const elapsedHours = (period.endsAt.getTime() - period.startsAt.getTime()) / 3_600_000;
    expect(elapsedHours).toBe(31 * 24 - 1);
  });

  it("conta dias civis na mudança para a hora de inverno", () => {
    // 26 de outubro de 2025 tem 25h.
    const period = createPeriod("2025-10-01", "2025-10-31");
    expect(periodLengthInDays(period)).toBe(31);
    const elapsedHours = (period.endsAt.getTime() - period.startsAt.getTime()) / 3_600_000;
    expect(elapsedHours).toBe(31 * 24 + 1);
  });

  it("devolve um período anterior contíguo e de igual número de dias", () => {
    const period = createPeriod("2025-04-01", "2025-04-30");
    const previous = previousPeriod(period);

    expect(previous.fromDate).toBe("2025-03-02");
    expect(previous.toDate).toBe("2025-03-31");
    expect(periodLengthInDays(previous)).toBe(periodLengthInDays(period));
    // Contíguo: o anterior termina exatamente onde o atual começa.
    expect(previous.endsAt.getTime()).toBe(period.startsAt.getTime());
  });

  it("mantém a duração equivalente mesmo quando o período anterior tem DST", () => {
    const period = createPeriod("2025-04-01", "2025-04-30");
    const previous = previousPeriod(period);
    expect(periodLengthInDays(previous)).toBe(30);
  });

  it("atravessa a fronteira do ano", () => {
    const period = createPeriod("2025-01-01", "2025-01-31");
    expect(previousPeriod(period).fromDate).toBe("2024-12-01");
    expect(previousPeriod(period).toDate).toBe("2024-12-31");
  });

  it("recusa datas mal formadas ou intervalos invertidos", () => {
    expect(() => createPeriod("01/01/2025", "2025-01-31")).toThrow(PeriodError);
    expect(() => createPeriod("2025-13-01", "2025-13-31")).toThrow(PeriodError);
    expect(() => createPeriod("2025-05-31", "2025-05-01")).toThrow(PeriodError);
  });
});
