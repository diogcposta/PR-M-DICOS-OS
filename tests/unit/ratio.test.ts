import { describe, expect, it } from "vitest";

import {
  formatRatioAsPercentage,
  relativeChange,
  safeDivide,
  safePercentage,
} from "@/modules/kpis/domain/ratio";

describe("rácios", () => {
  it("calcula divisões normais", () => {
    expect(safeDivide(1, 4)).toBe(0.25);
    expect(safePercentage(1, 4)).toBe(25);
  });

  it("devolve null com denominador zero, nunca 0%", () => {
    expect(safeDivide(0, 0)).toBeNull();
    expect(safeDivide(5, 0)).toBeNull();
    expect(safePercentage(0, 0)).toBeNull();
    expect(safePercentage(0, 0)).not.toBe(0);
  });

  it("não inventa variação quando a base é zero", () => {
    expect(relativeChange(5, 0)).toBeNull();
    expect(relativeChange(0, 0)).toBeNull();
  });

  it("calcula variação relativa em ambos os sentidos", () => {
    expect(relativeChange(120, 100)).toBeCloseTo(0.2);
    expect(relativeChange(80, 100)).toBeCloseTo(-0.2);
  });

  it("apresenta ausência de dados em vez de um número", () => {
    expect(formatRatioAsPercentage(null)).toBe("sem dados");
    expect(formatRatioAsPercentage(25)).toBe("25,0");
  });
});
