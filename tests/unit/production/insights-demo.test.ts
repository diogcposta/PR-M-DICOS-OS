import { describe, expect, it } from "vitest";

import { buildDemoDataset, DEMO_REFERENCE } from "@/modules/production/demo/dataset";
import { buildInsights, topActions, type InsightInput } from "@/modules/production/domain/insights";
import { analyseCases, insurerAnalysis, overallChairCentsPerHour, profitabilityMatrix, type ProcedureRecord } from "@/modules/production/domain/metrics";
import { summariseMonth } from "@/modules/production/domain/monthly";
import { followUpList } from "@/modules/production/domain/plans";
import { findOverlap, monthOf } from "@/modules/production/domain/time";

const FEES = { feeBps: 5000, feeBase: "BILLED" as const };
const dataset = buildDemoDataset();
const procedures: ProcedureRecord[] = dataset.procedures.map((p) => ({
  ...p,
  id: p.key,
  sessions: p.sessions.map((s, i) => ({ ...s, id: `${p.key}-${i}`, procedureId: p.key })),
}));
const inMonth = (m: string) => (d: string) => monthOf(d) === m;

function monthSummary(month: string) {
  const is = inMonth(month);
  return summariseMonth(
    {
      month,
      days: dataset.days.filter((d) => is(d.date)),
      procedures: procedures.filter((p) => is(p.date)),
      sessions: procedures.flatMap((p) => p.sessions).filter((s) => is(s.date)),
      absences: dataset.absences.map((a, i) => ({ ...a, id: String(i) })).filter((a) => is(a.date)),
      plans: dataset.plans.map((p, i) => ({ ...p, id: String(i) })).filter((p) => is(p.presentedDate)),
    },
    FEES,
  );
}

describe("dados de demonstração (setembro de 2026)", () => {
  const september = monthSummary(DEMO_REFERENCE.month);

  it("reproduz os números de referência", () => {
    expect(september.productionCents).toBe(861_900);
    expect(september.feeCents).toBe(430_950);
    expect(september.clinicalMinutes).toBe(7_830);
    expect(september.centsPerHour! / 100).toBeCloseTo(66.05, 2);
    expect(september.plannedDays).toBe(2);
  });

  it("é determinístico", () => {
    expect(buildDemoDataset()).toEqual(dataset);
  });

  it("inclui os dois casos de referência", () => {
    const cases = analyseCases(procedures.filter((p) => p.caseCode === "DC-2026-001" || p.caseCode === "DC-2026-002"));
    const crown = cases.cases.find((c) => c.caseCode === "DC-2026-001")!;
    const complex = cases.cases.find((c) => c.caseCode === "DC-2026-002")!;
    expect([crown.billedCents, crown.chairMinutes, crown.centsPerHour]).toEqual([60_000, 180, 20_000]);
    expect([complex.billedCents, complex.chairMinutes]).toEqual([80_000, 420]);
  });

  it("não tem consultas sobrepostas nem fora dos dias clínicos", () => {
    const sessions = procedures.flatMap((p) => p.sessions);
    const days = new Set(dataset.days.filter((d) => d.status === "WORKED").map((d) => d.date));
    const byDate = new Map<string, typeof sessions>();
    for (const s of sessions) {
      expect(days.has(s.date)).toBe(true);
      const list = byDate.get(s.date) ?? [];
      expect(findOverlap(s, list)).toBeNull();
      list.push(s);
      byDate.set(s.date, list);
    }
  });

  it("Case IDs únicos por plano e sem dados pessoais", () => {
    const codes = dataset.plans.map((p) => p.caseCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^DC-2026-\d{3}$/);
  });
});

describe("insights automáticos", () => {
  const month = DEMO_REFERENCE.month;
  const monthProcedures = procedures.filter((p) => inMonth(month)(p.date));
  const input: InsightInput = {
    current: monthSummary(month),
    previous: monthSummary("2026-08"),
    categories: profitabilityMatrix(monthProcedures, FEES, "category"),
    procedureTypes: profitabilityMatrix(monthProcedures, FEES, "procedureType"),
    insurers: insurerAnalysis(monthProcedures),
    followUps: followUpList(dataset.plans.map((p, i) => ({ ...p, id: String(i) })), DEMO_REFERENCE.today),
    overallChairCph: overallChairCentsPerHour(monthProcedures),
    targetNoShowRate: 0.05,
  };
  const insights = buildInsights(input);
  const actions = topActions(input);

  it("gera insights com números concretos", () => {
    expect(insights.length).toBeGreaterThanOrEqual(4);
    expect(insights.some((i) => i.key === "cph-change")).toBe(true);
    expect(insights.some((i) => i.key === "no-show-loss" && /€/.test(i.text))).toBe(true);
  });

  it("nunca recomenda fazer mais (ou menos) de um tratamento", () => {
    const texts = [...insights.map((i) => i.text), ...actions.flatMap((a) => [a.title, a.detail])];
    for (const text of texts) {
      expect(text).not.toMatch(/\bfa(z|ça|zer) mais\b/i);
      expect(text).not.toMatch(/dão mais dinheiro/i);
      expect(text).not.toMatch(/\b(evit(a|ar)|reduz(ir)?) (as |os )?(coroas|retratamentos|endodontias|consultas|tratamentos)\b/i);
    }
  });

  it("no máximo três ações, ordenadas por impacto", () => {
    expect(actions.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1]!.impactCents).toBeGreaterThanOrEqual(actions[i]!.impactCents);
    }
  });

  it("mês vazio não gera insights enganadores", () => {
    const empty = summariseMonth({ month: "2027-01", days: [], procedures: [], sessions: [], absences: [], plans: [] }, FEES);
    const r = buildInsights({ ...input, current: empty, previous: null, categories: [], procedureTypes: [], insurers: [], followUps: [], overallChairCph: null });
    expect(r).toEqual([]);
  });
});
