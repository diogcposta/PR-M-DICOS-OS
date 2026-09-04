import { describe, expect, it } from "vitest";

import {
  normalizeDecimalToCents,
  normalizeLabel,
  normalizePortugueseDate,
  normalizeText,
} from "@/modules/imports/domain/normalizers";
import { startOfBusinessDay } from "@/modules/kpis/domain/period";

describe("normalização de datas portuguesas", () => {
  it("lê dd/MM/yyyy como data civil de Lisboa", () => {
    const result = normalizePortugueseDate("06/01/2025");
    expect(result.ok).toBe(true);
    // Janeiro: Lisboa = UTC.
    expect(result.ok && result.value.toISOString()).toBe("2025-01-06T00:00:00.000Z");
  });

  it("lê data com hora e converte de Lisboa para UTC no verão", () => {
    const result = normalizePortugueseDate("15/07/2025 09:30");
    // Julho: Lisboa = UTC+1, logo 09:30 local são 08:30 UTC.
    expect(result.ok && result.value.toISOString()).toBe("2025-07-15T08:30:00.000Z");
  });

  it("nunca interpreta como MM/dd/yyyy", () => {
    const result = normalizePortugueseDate("03/04/2025");
    // 3 de abril, não 4 de março — e o instante é o início desse dia em Lisboa.
    // Abril já é hora de verão, por isso 00:00 local são 23:00 UTC do dia anterior.
    expect(result.ok && result.value.getTime()).toBe(startOfBusinessDay("2025-04-03").getTime());
    expect(result.ok && result.value.toISOString()).toBe("2025-04-02T23:00:00.000Z");
  });

  it("recusa datas inexistentes em vez de as deslocar", () => {
    const result = normalizePortugueseDate("31/02/2025");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe("DATE_OUT_OF_RANGE");
  });

  it("recusa formatos não reconhecidos e datas em falta", () => {
    expect(normalizePortugueseDate("segunda-feira").ok).toBe(false);
    expect(normalizePortugueseDate("").ok).toBe(false);
    expect(normalizePortugueseDate(null).ok).toBe(false);
  });

  it("aceita objetos Date vindos do Excel", () => {
    const date = new Date("2025-01-06T09:00:00.000Z");
    const result = normalizePortugueseDate(date);
    expect(result.ok && result.value.getTime()).toBe(date.getTime());
  });
});

describe("normalização de montantes", () => {
  it("lê o formato português", () => {
    expect(normalizeDecimalToCents("1.234,56")).toEqual({ ok: true, value: 123_456 });
    expect(normalizeDecimalToCents("12,50")).toEqual({ ok: true, value: 1_250 });
    expect(normalizeDecimalToCents("1 234,00 €")).toEqual({ ok: true, value: 123_400 });
  });

  it("lê negativos e inteiros", () => {
    expect(normalizeDecimalToCents("-45,60")).toEqual({ ok: true, value: -4_560 });
    expect(normalizeDecimalToCents("100")).toEqual({ ok: true, value: 10_000 });
  });

  it("recusa em vez de adivinhar quando o separador é ambíguo", () => {
    // "1.234" tanto pode ser 1234 como 1,234.
    const result = normalizeDecimalToCents("1.234");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe("AMOUNT_AMBIGUOUS");
  });

  it("recusa texto não numérico", () => {
    expect(normalizeDecimalToCents("grátis").ok).toBe(false);
    expect(normalizeDecimalToCents("").ok).toBe(false);
  });
});

describe("normalização de texto e rótulos", () => {
  it("trata células vazias como ausentes", () => {
    expect(normalizeText("  ")).toBeNull();
    expect(normalizeText(null)).toBeNull();
    expect(normalizeText(" DEMO-CL-001 ")).toBe("DEMO-CL-001");
  });

  it("compara rótulos sem acentos nem maiúsculas", () => {
    expect(normalizeLabel("Não compareceu")).toBe("nao compareceu");
    expect(normalizeLabel("REALIZADA")).toBe("realizada");
  });
});
