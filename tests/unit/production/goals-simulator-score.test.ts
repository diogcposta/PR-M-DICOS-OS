import { describe, expect, it } from "vitest";

import { gapToNextGoal, projectGoals } from "@/modules/production/domain/goals";
import { efficiencyScore } from "@/modules/production/domain/score";
import { ladder, simulate } from "@/modules/production/domain/simulator";
import { compareLast, movingAverage } from "@/modules/production/domain/trends";

const GOALS = [
  { label: "Meta elevada", centsPerHour: 15_000 },
  { label: "Meta próxima", centsPerHour: 8_500 },
  { label: "Meta intermédia", centsPerHour: 10_000 },
  { label: "Meta avançada", centsPerHour: 12_500 },
];

describe("objetivos", () => {
  it("projeta produção e honorários mantendo as mesmas horas", () => {
    const rows = projectGoals(GOALS, 6_600, 146 * 60, 5000);
    expect(rows.map((r) => r.centsPerHour)).toEqual([8_500, 10_000, 12_500, 15_000]);
    expect(rows.map((r) => r.projectedProductionCents)).toEqual([1_241_000, 1_460_000, 1_825_000, 2_190_000]);
    expect(rows[1]!.projectedFeeCents).toBe(730_000);
    expect(rows[0]!.extraProductionCents).toBe(1_241_000 - 963_600);
  });

  it("66 €/h → 85 €/h: +19 €/h, +28,8%", () => {
    const gap = gapToNextGoal(GOALS, 6_600)!;
    expect(gap.nextGoal.centsPerHour).toBe(8_500);
    expect(gap.diffCentsPerHour).toBe(1_900);
    expect(gap.diffShare).toBeCloseTo(0.2879, 4);
  });

  it("sem dados ou todos atingidos → sem próximo objetivo", () => {
    expect(gapToNextGoal(GOALS, null)).toBeNull();
    expect(gapToNextGoal(GOALS, 20_000)).toBeNull();
  });
});

describe("simulador", () => {
  const base = {
    hoursPerMonth: 146,
    centsPerHour: 6_600,
    feeBps: 5000,
    baselineNoShowRate: 0.1,
    noShowRate: 0.1,
    acceptanceRate: 0.6,
    avgPlanCents: 100_000,
    plansPerMonth: 10,
    workingMonths: 11,
  };

  it("146 h × 66 €/h = €9.636; honorários e anuais", () => {
    const r = simulate(base);
    expect(r.monthlyProductionCents).toBe(963_600);
    expect(r.monthlyFeeCents).toBe(481_800);
    expect(r.annualProductionCents).toBe(963_600 * 11);
    expect(r.monthlyAcceptedPlanCents).toBe(600_000);
  });

  it("tabela: 100 €/h → €14.600; 125 → €18.250; 150 → €21.900", () => {
    expect(ladder(146, [10_000, 12_500, 15_000], 5000).map((r) => r.productionCents)).toEqual([
      1_460_000, 1_825_000, 2_190_000,
    ]);
  });

  it("reduzir faltas escala o €/h pela agenda recuperada", () => {
    const r = simulate({ ...base, baselineNoShowRate: 0.12, noShowRate: 0.05 });
    expect(r.effectiveCentsPerHour).toBeCloseTo(6_600 * (0.95 / 0.88), 6);
  });

  it("entradas absurdas não produzem NaN nem valores negativos", () => {
    const r = simulate({ ...base, hoursPerMonth: Number.NaN, noShowRate: 5, baselineNoShowRate: -1, plansPerMonth: -3 });
    expect(r.monthlyProductionCents).toBe(0);
    expect(r.monthlyAcceptedPlanCents).toBe(0);
    expect(Number.isFinite(r.effectiveCentsPerHour)).toBe(true);
  });
});

describe("score de eficiência", () => {
  it("combina componentes com pesos e limita a 0–100", () => {
    const r = efficiencyScore({
      centsPerHour: 20_000,
      goalCentsPerHour: 10_000,
      realOccupancy: 1,
      theoreticalOccupancy: 1,
      missedRate: 0,
      acceptanceRateByValue: 1,
      followUpHealth: 1,
    });
    expect(r.score).toBe(100);
  });

  it("componentes sem dados são excluídos e os pesos renormalizados", () => {
    const r = efficiencyScore({
      centsPerHour: 5_000,
      goalCentsPerHour: 10_000,
      realOccupancy: null,
      theoreticalOccupancy: null,
      missedRate: null,
      acceptanceRateByValue: null,
      followUpHealth: null,
    });
    expect(r.score).toBe(50);
  });

  it("sem nenhum dado → sem score (não 0)", () => {
    const r = efficiencyScore({
      centsPerHour: null,
      goalCentsPerHour: 10_000,
      realOccupancy: null,
      theoreticalOccupancy: null,
      missedRate: null,
      acceptanceRateByValue: null,
      followUpHealth: null,
    });
    expect(r.score).toBeNull();
  });

  it("20% de faltas ou mais vale 0 no componente de faltas", () => {
    const r = efficiencyScore({
      centsPerHour: null,
      goalCentsPerHour: 10_000,
      realOccupancy: null,
      theoreticalOccupancy: null,
      missedRate: 0.3,
      acceptanceRateByValue: null,
      followUpHealth: null,
    });
    expect(r.score).toBe(0);
  });
});

describe("tendências", () => {
  it("média móvel de 3 meses e comparação com o mês anterior", () => {
    expect(movingAverage([3, 6, 9, 12])).toEqual([null, null, 6, 9]);
    expect(movingAverage([3, null, 9, 12])).toEqual([null, null, null, null]);
    const c = compareLast([50, 60, 66]);
    expect(c.change).toBeCloseTo(0.1, 10);
    expect(c.movingAverage).toBeCloseTo(58.667, 3);
  });

  it("base zero → variação sem dados", () => {
    expect(compareLast([0, 10]).change).toBeNull();
    expect(compareLast([10]).change).toBeNull();
  });
});
