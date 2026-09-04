import { describe, expect, it } from "vitest";

import {
  MoneyError,
  assertCents,
  centsToEuros,
  eurosToCents,
  formatCents,
  sumCents,
} from "@/modules/kpis/domain/money";

describe("dinheiro em cêntimos", () => {
  it("converte euros para cêntimos inteiros", () => {
    expect(eurosToCents(12.34)).toBe(1234);
    expect(eurosToCents(0)).toBe(0);
    expect(eurosToCents(-45.6)).toBe(-4560);
    // Meio cêntimo afasta-se do zero em ambos os sentidos.
    expect(eurosToCents(-0.005)).toBe(-1);
  });

  it("arredonda casos de representação binária sem perder cêntimos", () => {
    // 1.005 * 100 === 100.49999999999999 em vírgula flutuante.
    expect(eurosToCents(1.005)).toBe(101);
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
  });

  it("recusa montantes que não sejam inteiros em cêntimos", () => {
    expect(() => assertCents(10.5)).toThrow(MoneyError);
    expect(() => eurosToCents(Number.NaN)).toThrow(MoneyError);
    expect(() => eurosToCents(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });

  it("soma sem erro de vírgula flutuante", () => {
    const values = Array.from({ length: 10 }, () => eurosToCents(0.1));
    expect(sumCents(values)).toBe(100);
    expect(centsToEuros(sumCents(values))).toBe(1);
  });

  it("soma reversões negativas em vez de as ignorar", () => {
    expect(sumCents([15_000, -5_000])).toBe(10_000);
  });

  it("formata em pt-PT", () => {
    // O separador é um espaço não quebrável; comparar por conteúdo, não por bytes.
    expect(formatCents(123_456).replace(/ /g, " ")).toContain("1234,56");
  });
});
