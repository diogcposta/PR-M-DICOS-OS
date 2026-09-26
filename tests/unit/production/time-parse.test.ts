import { describe, expect, it } from "vitest";

import { InputError, assertNoPersonalData, centsToInput, parseEuros, parsePercentToBps } from "@/modules/production/application/parse";
import { planSchema, procedureSchema } from "@/modules/production/application/schemas";
import { euros, eurosPerHour, hours, percent } from "@/modules/production/domain/format";
import { buildSlots, fillSlots } from "@/modules/production/domain/agenda";
import {
  addMonths,
  daysBetween,
  durationMinutes,
  findOverlap,
  formatTime,
  intervalsOverlap,
  isValidCivilDate,
  isoWeekday,
  monthRange,
  parseTime,
  unionMinutes,
} from "@/modules/production/domain/time";

describe("tempo", () => {
  it("converte horas e calcula duração", () => {
    expect(parseTime("09:30")).toBe(570);
    expect(formatTime(1140)).toBe("19:00");
    expect(durationMinutes(570, 660)).toBe(90);
    expect(() => durationMinutes(660, 660)).toThrow();
    expect(() => parseTime("25:00")).toThrow();
  });

  it("deteta sobreposições com intervalos semi-abertos", () => {
    expect(intervalsOverlap({ startMinute: 600, endMinute: 645 }, { startMinute: 645, endMinute: 690 })).toBe(false);
    expect(intervalsOverlap({ startMinute: 600, endMinute: 646 }, { startMinute: 645, endMinute: 690 })).toBe(true);
    expect(findOverlap({ startMinute: 620, endMinute: 630 }, [{ startMinute: 600, endMinute: 700, id: "x" }])?.id).toBe("x");
    expect(unionMinutes([{ startMinute: 0, endMinute: 60 }, { startMinute: 30, endMinute: 90 }, { startMinute: 100, endMinute: 110 }])).toBe(100);
    expect(unionMinutes([])).toBe(0);
  });

  it("calendário: meses, dias, fevereiro bissexto", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-09").to).toBe("2026-09-30");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(isoWeekday("2026-09-26")).toBe(6);
    expect(isValidCivilDate("2026-02-30")).toBe(false);
    expect(daysBetween("2026-08-27", "2026-09-26")).toBe(30);
    // mudança de hora (25 de outubro) não afeta contagens de dias civis
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("formatação", () => {
  it("segue a convenção €8.619 / €4.309,50", () => {
    expect(euros(861_900)).toBe("€8.619");
    expect(euros(430_950)).toBe("€4.309,50");
    expect(euros(-12_345)).toBe("-€123,45");
    expect(euros(null)).toBe("sem dados");
    expect(eurosPerHour(6_604.6)).toBe("66 €/h");
    expect(eurosPerHour(6_604.6, 2)).toBe("66,05 €/h");
    expect(percent(0.288)).toBe("28,8%");
    expect(percent(null)).toBe("sem dados");
    expect(hours(7_830)).toBe("130,5 h");
  });
});

describe("introdução de valores", () => {
  it("aceita formatos portugueses de euros", () => {
    expect(parseEuros("600")).toBe(60_000);
    expect(parseEuros("1.234,56")).toBe(123_456);
    expect(parseEuros("1234,5")).toBe(123_450);
    expect(parseEuros("1234.56")).toBe(123_456);
    expect(parseEuros("1.500")).toBe(150_000);
    expect(parseEuros("€ 45")).toBe(4_500);
    expect(() => parseEuros("abc")).toThrow(InputError);
    expect(() => parseEuros("1,234,5")).toThrow(InputError);
    expect(centsToInput(123_450)).toBe("1234,50");
  });

  it("percentagens em pontos-base", () => {
    expect(parsePercentToBps("50")).toBe(5000);
    expect(parsePercentToBps("12,5%")).toBe(1250);
    expect(() => parsePercentToBps("150")).toThrow();
  });

  it("recusa dados pessoais em texto livre", () => {
    expect(() => assertNoPersonalData("ligar para 912 345 678", "Nota")).toThrow(/telefone/);
    expect(() => assertNoPersonalData("maria@example.com", "Nota")).toThrow(/email/);
    expect(() => assertNoPersonalData("Repetir RX na próxima consulta", "Nota")).not.toThrow();
  });
});

describe("validação de formulários", () => {
  const valid = {
    date: "2026-09-02",
    caseCode: "dc-2026-001",
    procedureType: "Coroa cerâmica",
    category: "Coroa",
    billed: "600",
    listPrice: "",
    payerType: "PRIVATE",
    start: "09:30",
    end: "11:00",
    plannedVisits: "3",
    labCost: "150",
    completed: "on",
  };

  it("procedimento válido: cêntimos, minutos e Case ID normalizado", () => {
    const r = procedureSchema.parse(valid);
    expect(r.billed).toBe(60_000);
    expect(r.listPrice).toBe(60_000); // sem tabela, assume o faturado
    expect(r.start).toBe(570);
    expect(r.end).toBe(660);
    expect(r.caseCode).toBe("DC-2026-001");
    expect(r.completed).toBe(true);
  });

  it("recusa fim antes do início, Case ID com nome e seguro sem seguradora", () => {
    expect(procedureSchema.safeParse({ ...valid, end: "09:00" }).success).toBe(false);
    expect(procedureSchema.safeParse({ ...valid, caseCode: "Maria Silva" }).success).toBe(false);
    expect(procedureSchema.safeParse({ ...valid, payerType: "INSURANCE" }).success).toBe(false);
    expect(procedureSchema.safeParse({ ...valid, start: "09:30", end: "" }).success).toBe(false);
    expect(procedureSchema.safeParse({ ...valid, billed: "-5" }).success).toBe(false);
  });

  it("plano: valores coerentes com o estado", () => {
    const base = { caseCode: "DC-2026-050", presentedDate: "2026-09-01", total: "1000", phases: "1", status: "PRESENTED" };
    expect(planSchema.safeParse(base).success).toBe(true);
    expect(planSchema.safeParse({ ...base, status: "ACCEPTED" }).success).toBe(false);
    expect(planSchema.safeParse({ ...base, status: "ACCEPTED", accepted: "1000" }).success).toBe(true);
    expect(planSchema.safeParse({ ...base, accepted: "2000" }).success).toBe(false);
    expect(planSchema.safeParse({ ...base, lastContactDate: "2026-08-01" }).success).toBe(false);
    const completed = planSchema.parse({ ...base, status: "COMPLETED" });
    expect(completed.accepted).toBe(100_000);
    expect(completed.performed).toBe(100_000);
  });
});

describe("agenda do dia", () => {
  const blocks = [
    { startMinute: 570, endMinute: 750 },
    { startMinute: 870, endMinute: 1140 },
  ];

  it("slots de 45 min: 09:30, 10:15, 11:00, 11:45, 14:30 … 18:15", () => {
    const slots = buildSlots(blocks, 45).map((s) => formatTime(s.startMinute));
    expect(slots).toEqual(["09:30", "10:15", "11:00", "11:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15"]);
  });

  it("outras durações e restos curtos no fim do bloco", () => {
    expect(buildSlots(blocks, 60)).toHaveLength(8); // 3 + 5 (último da tarde com 30 min)
    expect(buildSlots(blocks, 120).map((s) => s.endMinute - s.startMinute)).toEqual([120, 60, 120, 120, 30]);
    expect(buildSlots(blocks, 0)).toEqual([]);
  });

  it("marca slots trabalhados, faltas e livres", () => {
    const filled = fillSlots(buildSlots(blocks, 45), [
      { kind: "session", label: "Coroa", startMinute: 570, endMinute: 660 },
      { kind: "absence", label: "Falta", startMinute: 870, endMinute: 915 },
    ]);
    expect(filled.slice(0, 3).map((s) => s.state)).toEqual(["worked", "worked", "free"]);
    expect(filled[4]!.state).toBe("absence");
  });
});
