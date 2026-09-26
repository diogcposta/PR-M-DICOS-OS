import { describe, expect, it } from "vitest";

import {
  agreementImpact,
  analyseCases,
  centsPerHour,
  feeCents,
  feeFromBase,
  insurerAnalysis,
  payerComparison,
  procedureMetrics,
  profitabilityMatrix,
  sortMatrix,
  topAndBottom,
} from "@/modules/production/domain/metrics";

import { FEES_50, proc } from "./helpers";

describe("honorários do médico", () => {
  it("aplica a percentagem ao valor faturado", () => {
    expect(feeFromBase(861_900, 5000)).toBe(430_950); // €8.619 × 50% = €4.309,50
    expect(feeFromBase(20_000, 5000)).toBe(10_000);
    expect(feeFromBase(10_001, 4000)).toBe(4_000); // 4000,4 → arredonda ao cêntimo
  });

  it("pode descontar custos diretos antes da percentagem (base líquida)", () => {
    expect(feeCents(60_000, 15_000, { feeBps: 5000, feeBase: "NET" })).toBe(22_500);
    expect(feeCents(60_000, 15_000, FEES_50)).toBe(30_000);
  });

  it("nunca gera honorários negativos quando os custos excedem o faturado", () => {
    expect(feeCents(10_000, 30_000, { feeBps: 5000, feeBase: "NET" })).toBe(0);
  });
});

describe("€/hora", () => {
  it("divide por horas e devolve null sem tempo registado", () => {
    expect(centsPerHour(60_000, 180)).toBe(20_000);
    expect(centsPerHour(60_000, 0)).toBeNull();
  });
});

describe("procedimento isolado", () => {
  it("retratamento €200 em 4 h: 50 €/h, honorários €100, 25 €/h de honorários", () => {
    const m = procedureMetrics(proc({ billedCents: 20_000, visits: [90, 90, 60] }), FEES_50, 8_500);
    expect(m.chairMinutes).toBe(240);
    expect(m.centsPerHour).toBe(5_000);
    expect(m.feeCents).toBe(10_000);
    expect(m.feeCentsPerHour).toBe(2_500);
    expect(m.lowProductivity).toBe(true);
  });

  it("coroa €600 em 3 consultas (90+45+45) conta uma só receita: 200 €/h", () => {
    const m = procedureMetrics(
      proc({ billedCents: 60_000, visits: [90, 45, 45], labCostCents: 15_000, otherCostCents: 1_000 }),
      FEES_50,
      8_500,
    );
    expect(m.sessionCount).toBe(3);
    expect(m.chairMinutes).toBe(180);
    expect(m.centsPerHour).toBe(20_000);
    expect(m.netCents).toBe(44_000);
    expect(m.directCostsCents).toBe(16_000);
    expect(m.lowProductivity).toBe(false);
  });

  it("sem consultas registadas: €/h sem dados, nunca zero", () => {
    const m = procedureMetrics(proc({ visits: [] }), FEES_50, 8_500);
    expect(m.centsPerHour).toBeNull();
    expect(m.feeCentsPerHour).toBeNull();
    expect(m.lowProductivity).toBe(false);
  });

  it("assinala consultas em falta e €/h provisório em procedimentos não concluídos", () => {
    const m = procedureMetrics(proc({ visits: [90], plannedVisits: 3, completed: false }), FEES_50, null);
    expect(m.missingSessions).toBe(2);
    expect(m.provisional).toBe(true);
  });
});

describe("matriz de rentabilidade", () => {
  const procedures = [
    proc({ procedureType: "Coroa", category: "Coroa", billedCents: 60_000, visits: [90, 45, 45], labCostCents: 15_000 }),
    proc({ procedureType: "Coroa", category: "Coroa", billedCents: 48_000, visits: [90, 45, 45], labCostCents: 15_000 }),
    proc({ procedureType: "Retratamento", category: "Retratamento endodôntico", billedCents: 20_000, visits: [240] }),
    proc({ procedureType: "Consulta", category: "Consulta", billedCents: 4_000, visits: [30] }),
    proc({ procedureType: "Consulta", category: "Consulta", billedCents: 4_000, visits: [] }),
  ];
  const rows = profitabilityMatrix(procedures, FEES_50);

  it("agrega casos, receita, tempo, custos e margem", () => {
    const coroa = rows.find((r) => r.key === "Coroa")!;
    expect(coroa.cases).toBe(2);
    expect(coroa.revenueCents).toBe(108_000);
    expect(coroa.chairMinutes).toBe(360);
    expect(coroa.centsPerHour).toBe(18_000);
    expect(coroa.feeCentsPerHour).toBe(9_000);
    expect(coroa.costsCents).toBe(30_000);
    expect(coroa.marginCents).toBe(78_000);
  });

  it("não inflaciona o €/h com procedimentos sem tempo", () => {
    const consulta = rows.find((r) => r.key === "Consulta")!;
    expect(consulta.revenueCents).toBe(8_000);
    expect(consulta.untimedCases).toBe(1);
    expect(consulta.centsPerHour).toBe(8_000); // só a consulta com 30 min
  });

  it("ordena por €/h, faturação e casos; top/bottom só com tempo", () => {
    expect(sortMatrix(rows, "cph_desc").map((r) => r.key)).toEqual(["Coroa", "Consulta", "Retratamento"]);
    expect(sortMatrix(rows, "cph_asc")[0]!.key).toBe("Retratamento");
    expect(sortMatrix(rows, "revenue_desc")[0]!.key).toBe("Coroa");
    expect(sortMatrix(rows, "cases_desc")[0]!.cases).toBe(2);
    const { top, bottom } = topAndBottom(rows, 1);
    expect(top[0]!.key).toBe("Coroa");
    expect(bottom[0]!.key).toBe("Retratamento");
  });

  it("partilhas de horas e faturação somam 100%", () => {
    const hours = rows.reduce((s, r) => s + (r.hoursShare ?? 0), 0);
    const revenue = rows.reduce((s, r) => s + (r.revenueShare ?? 0), 0);
    expect(hours).toBeCloseTo(1, 10);
    expect(revenue).toBeCloseTo(1, 10);
  });

  it("lista vazia não rebenta", () => {
    expect(profitabilityMatrix([], FEES_50)).toEqual([]);
  });
});

describe("casos complexos (Case ID)", () => {
  it("retratamento €200 + coroa €600 = €800 em 7 h → ≈114 €/h, sinalizado como valor elevado com produtividade baixa", () => {
    const analysis = analyseCases([
      proc({ caseCode: "DC-2026-002", procedureType: "Retratamento", billedCents: 20_000, visits: [90, 90, 60] }),
      proc({ caseCode: "DC-2026-002", procedureType: "Coroa", billedCents: 60_000, visits: [90, 45, 45] }),
      proc({ caseCode: "DC-2026-001", procedureType: "Coroa", billedCents: 60_000, visits: [90, 45, 45] }),
      proc({ caseCode: "DC-2026-003", procedureType: "Implante", billedCents: 90_000, visits: [90, 45, 30] }),
    ]);
    const complex = analysis.cases.find((c) => c.caseCode === "DC-2026-002")!;
    expect(complex.billedCents).toBe(80_000);
    expect(complex.chairMinutes).toBe(420);
    expect(complex.centsPerHour).toBeCloseTo(11_428.57, 1);
    expect(complex.sessionCount).toBe(6);
    expect(complex.weakestProcedure).toEqual({ type: "Retratamento", centsPerHour: 5_000 });
    expect(complex.highValueLowProductivity).toBe(true);

    const crown = analysis.cases.find((c) => c.caseCode === "DC-2026-001")!;
    expect(crown.centsPerHour).toBe(20_000);
    expect(crown.highValueLowProductivity).toBe(false);
  });

  it("sem pelo menos dois casos de valor elevado não há referência (não sinaliza)", () => {
    const analysis = analyseCases([proc({ caseCode: "DC-2026-009", billedCents: 80_000, visits: [420] })]);
    expect(analysis.highValueReferenceCph).toBeNull();
    expect(analysis.cases[0]!.highValueLowProductivity).toBe(false);
  });

  it("ignora procedimentos sem Case ID", () => {
    expect(analyseCases([proc({ caseCode: null })]).cases).toEqual([]);
  });
});

describe("particular vs seguros", () => {
  const procedures = [
    proc({ procedureType: "Coroa", billedCents: 80_000, visits: [180] }),
    proc({ procedureType: "Coroa", billedCents: 48_000, listPriceCents: 80_000, visits: [180], payerType: "INSURANCE", payerName: "Seguradora X" }),
    proc({ procedureType: "Consulta", billedCents: 4_000, visits: [30] }),
    proc({ procedureType: "Consulta", billedCents: 2_000, listPriceCents: 4_000, visits: [30], payerType: "INSURANCE", payerName: "Seguradora X" }),
  ];

  it("coroa particular €800/3 h = 267 €/h vs seguro €480/3 h = 160 €/h", () => {
    const row = payerComparison(procedures).find((r) => r.procedureType === "Coroa")!;
    expect(row.privateCph).toBeCloseTo(26_666.67, 1);
    expect(row.thirdPartyCph).toBe(16_000);
    expect(row.diffCph).toBeCloseTo(-10_666.67, 1);
    expect(row.diffShare).toBeCloseTo(-0.4, 10);
  });

  it("compara cada seguradora com a mesma mistura de procedimentos a preço particular", () => {
    const [insurer] = insurerAnalysis(procedures);
    expect(insurer!.payerName).toBe("Seguradora X");
    // (48000 + 2000) em 210 min vs (26666,67×3 + 8000×0,5) em 210 min
    expect(insurer!.centsPerHour).toBeCloseTo(14_285.71, 1);
    expect(insurer!.privateEquivalentCph).toBeCloseTo(24_000, 1);
    expect(insurer!.discountCents).toBe(34_000);
  });

  it("impacto das convenções: desconto face à tabela e valor do tempo", () => {
    const impact = agreementImpact(procedures);
    expect(impact.thirdPartyRevenueCents).toBe(50_000);
    expect(impact.discountCents).toBe(34_000);
    expect(impact.timeValueGapCents).toBe(34_000);
    expect(impact.thirdPartyShare).toBeCloseTo(50_000 / 134_000, 10);
  });

  it("sem particulares não há referência (sem dados, não 0%)", () => {
    const only = procedures.filter((p) => p.payerType !== "PRIVATE");
    expect(payerComparison(only)).toEqual([]);
    expect(insurerAnalysis(only)[0]!.diffShare).toBeNull();
  });
});
