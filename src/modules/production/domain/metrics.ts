/**
 * Cálculos de produção e rentabilidade.
 *
 * Tudo aqui é determinístico e puro: recebe registos já lidos da base e devolve
 * números. Regras fixas (docs/PRODUCAO.md):
 *  - dinheiro em cêntimos inteiros; um único arredondamento, no fim;
 *  - rácios com denominador zero devolvem `null` ("sem dados"), nunca 0;
 *  - a receita de um procedimento conta uma única vez, na data do procedimento,
 *    e o seu tempo de cadeira é a soma de todas as consultas (sessões) — uma coroa
 *    em 3 consultas nunca é tratada como 3 receitas separadas;
 *  - €/h do mês = produção / horas clínicas (dias registados), que inclui tempo
 *    morto; €/h de um procedimento = valor faturado / horas de cadeira.
 */
import { safeDivide, type Ratio } from "@/modules/kpis/domain/ratio";

import { isThirdPartyPayer } from "./constants";

export interface SessionRecord {
  readonly id: string;
  readonly procedureId: string;
  readonly date: string;
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface ProcedureRecord {
  readonly id: string;
  readonly date: string;
  readonly caseCode: string | null;
  readonly procedureType: string;
  readonly category: string;
  readonly listPriceCents: number;
  readonly billedCents: number;
  readonly payerType: string;
  readonly payerName: string | null;
  readonly plannedVisits: number;
  readonly labCostCents: number;
  readonly otherCostCents: number;
  readonly completed: boolean;
  readonly sessions: readonly SessionRecord[];
}

export interface FeeSettings {
  /** Pontos-base: 5000 = 50%. */
  readonly feeBps: number;
  /** BILLED = sobre o faturado; NET = sobre faturado − laboratório − outros custos. */
  readonly feeBase: "BILLED" | "NET";
}

/** Honorários sobre uma base em cêntimos, com um único arredondamento ao cêntimo. */
export function feeFromBase(baseCents: number, feeBps: number): number {
  if (baseCents <= 0) return 0;
  return Math.round((baseCents * feeBps) / 10_000);
}

export function feeCents(
  billedCents: number,
  directCostsCents: number,
  settings: FeeSettings,
): number {
  const base = settings.feeBase === "NET" ? billedCents - directCostsCents : billedCents;
  return feeFromBase(base, settings.feeBps);
}

/** Cêntimos por hora a partir de cêntimos e minutos. `null` sem tempo registado. */
export function centsPerHour(cents: number, minutes: number): Ratio {
  const ratio = safeDivide(cents * 60, minutes);
  return ratio;
}

export function sessionMinutes(session: Pick<SessionRecord, "startMinute" | "endMinute">): number {
  return Math.max(0, session.endMinute - session.startMinute);
}

export interface ProcedureMetrics {
  readonly id: string;
  readonly chairMinutes: number;
  readonly sessionCount: number;
  readonly directCostsCents: number;
  readonly netCents: number;
  readonly feeCents: number;
  readonly centsPerHour: Ratio;
  readonly feeCentsPerHour: Ratio;
  /** €/h abaixo do objetivo mais baixo. */
  readonly lowProductivity: boolean;
  /** Procedimento não concluído: o tempo ainda pode crescer, o €/h é provisório. */
  readonly provisional: boolean;
  /** Menos consultas registadas do que as previstas. */
  readonly missingSessions: number;
}

export function procedureMetrics(
  procedure: ProcedureRecord,
  fees: FeeSettings,
  lowestGoalCentsPerHour: number | null,
): ProcedureMetrics {
  const chairMinutes = procedure.sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const directCostsCents = procedure.labCostCents + procedure.otherCostCents;
  const fee = feeCents(procedure.billedCents, directCostsCents, fees);
  const cph = centsPerHour(procedure.billedCents, chairMinutes);
  return {
    id: procedure.id,
    chairMinutes,
    sessionCount: procedure.sessions.length,
    directCostsCents,
    netCents: procedure.billedCents - directCostsCents,
    feeCents: fee,
    centsPerHour: cph,
    feeCentsPerHour: centsPerHour(fee, chairMinutes),
    lowProductivity:
      cph !== null && lowestGoalCentsPerHour !== null && cph < lowestGoalCentsPerHour,
    provisional: !procedure.completed,
    missingSessions: Math.max(0, procedure.plannedVisits - procedure.sessions.length),
  };
}

// ---------------------------------------------------------------------------
// Matriz de rentabilidade
// ---------------------------------------------------------------------------

export interface ProfitabilityRow {
  readonly key: string;
  readonly category: string;
  readonly cases: number;
  readonly revenueCents: number;
  readonly chairMinutes: number;
  /** Procedimentos sem tempo registado: contam na receita mas não no €/h. */
  readonly untimedCases: number;
  readonly centsPerHour: Ratio;
  readonly feeCentsPerHour: Ratio;
  readonly costsCents: number;
  readonly marginCents: number;
  readonly marginShare: Ratio;
  readonly revenueShare: Ratio;
  readonly hoursShare: Ratio;
}

type GroupBy = "procedureType" | "category";

/**
 * Agrupa procedimentos por tipo (ou categoria).
 *
 * O €/h do grupo usa só a receita dos procedimentos com tempo registado, para
 * que um ato sem horas não inflacione artificialmente a produtividade.
 */
export function profitabilityMatrix(
  procedures: readonly ProcedureRecord[],
  fees: FeeSettings,
  groupBy: GroupBy = "procedureType",
): ProfitabilityRow[] {
  interface Acc {
    category: string;
    cases: number;
    revenue: number;
    timedRevenue: number;
    timedFees: number;
    minutes: number;
    untimed: number;
    costs: number;
  }
  const groups = new Map<string, Acc>();
  let totalRevenue = 0;
  let totalMinutes = 0;

  for (const p of procedures) {
    const key = p[groupBy];
    const acc =
      groups.get(key) ??
      { category: p.category, cases: 0, revenue: 0, timedRevenue: 0, timedFees: 0, minutes: 0, untimed: 0, costs: 0 };
    const minutes = p.sessions.reduce((s, x) => s + sessionMinutes(x), 0);
    const costs = p.labCostCents + p.otherCostCents;
    acc.cases += 1;
    acc.revenue += p.billedCents;
    acc.costs += costs;
    if (minutes > 0) {
      acc.minutes += minutes;
      acc.timedRevenue += p.billedCents;
      acc.timedFees += feeCents(p.billedCents, costs, fees);
    } else {
      acc.untimed += 1;
    }
    groups.set(key, acc);
    totalRevenue += p.billedCents;
    totalMinutes += minutes;
  }

  return [...groups.entries()].map(([key, acc]) => ({
    key,
    category: acc.category,
    cases: acc.cases,
    revenueCents: acc.revenue,
    chairMinutes: acc.minutes,
    untimedCases: acc.untimed,
    centsPerHour: centsPerHour(acc.timedRevenue, acc.minutes),
    feeCentsPerHour: centsPerHour(acc.timedFees, acc.minutes),
    costsCents: acc.costs,
    marginCents: acc.revenue - acc.costs,
    marginShare: safeDivide(acc.revenue - acc.costs, acc.revenue),
    revenueShare: safeDivide(acc.revenue, totalRevenue),
    hoursShare: safeDivide(acc.minutes, totalMinutes),
  }));
}

export type MatrixSort = "cph_desc" | "cph_asc" | "revenue_desc" | "cases_desc";

/** Ordenação estável; linhas sem €/h (sem tempo) vão sempre para o fim. */
export function sortMatrix(rows: readonly ProfitabilityRow[], sort: MatrixSort): ProfitabilityRow[] {
  const byCph = (dir: 1 | -1) => (a: ProfitabilityRow, b: ProfitabilityRow) => {
    if (a.centsPerHour === null && b.centsPerHour === null) return a.key.localeCompare(b.key);
    if (a.centsPerHour === null) return 1;
    if (b.centsPerHour === null) return -1;
    return dir * (a.centsPerHour - b.centsPerHour) || a.key.localeCompare(b.key);
  };
  const copy = [...rows];
  switch (sort) {
    case "cph_desc":
      return copy.sort(byCph(-1));
    case "cph_asc":
      return copy.sort(byCph(1));
    case "revenue_desc":
      return copy.sort((a, b) => b.revenueCents - a.revenueCents || a.key.localeCompare(b.key));
    case "cases_desc":
      return copy.sort((a, b) => b.cases - a.cases || a.key.localeCompare(b.key));
  }
}

/** Top N mais e menos produtivos (só linhas com tempo registado). */
export function topAndBottom(
  rows: readonly ProfitabilityRow[],
  n = 5,
): { top: ProfitabilityRow[]; bottom: ProfitabilityRow[] } {
  const timed = rows.filter((r) => r.centsPerHour !== null);
  return {
    top: sortMatrix(timed, "cph_desc").slice(0, n),
    bottom: sortMatrix(timed, "cph_asc").slice(0, n),
  };
}

/** €/h global de cadeira: receita dos atos com tempo / horas de cadeira. */
export function overallChairCentsPerHour(procedures: readonly ProcedureRecord[]): Ratio {
  let revenue = 0;
  let minutes = 0;
  for (const p of procedures) {
    const m = p.sessions.reduce((s, x) => s + sessionMinutes(x), 0);
    if (m > 0) {
      revenue += p.billedCents;
      minutes += m;
    }
  }
  return centsPerHour(revenue, minutes);
}

// ---------------------------------------------------------------------------
// Casos (Case ID) — tratamentos com vários procedimentos e consultas
// ---------------------------------------------------------------------------

/** A partir deste valor um caso é considerado "de valor elevado". */
export const HIGH_VALUE_CASE_CENTS = 50_000;
/** Um caso de valor elevado é "de produtividade relativamente baixa" abaixo de 75% da referência. */
export const LOW_PRODUCTIVITY_FACTOR = 0.75;

export interface CaseMetrics {
  readonly caseCode: string;
  readonly procedureTypes: string[];
  readonly procedureCount: number;
  readonly sessionCount: number;
  readonly billedCents: number;
  readonly chairMinutes: number;
  readonly centsPerHour: Ratio;
  readonly directCostsCents: number;
  readonly completed: boolean;
  readonly highValue: boolean;
  /** Valor elevado mas €/h mais de 25% abaixo da média dos casos de valor elevado. */
  readonly highValueLowProductivity: boolean;
  /** Procedimento do caso com menor €/h (o que "puxa" o caso para baixo). */
  readonly weakestProcedure: { type: string; centsPerHour: number } | null;
}

export interface CaseAnalysis {
  readonly cases: CaseMetrics[];
  /** Média ponderada (receita / horas) dos casos de valor elevado com tempo. */
  readonly highValueReferenceCph: Ratio;
}

export function analyseCases(procedures: readonly ProcedureRecord[]): CaseAnalysis {
  const byCase = new Map<string, ProcedureRecord[]>();
  for (const p of procedures) {
    if (!p.caseCode) continue;
    const list = byCase.get(p.caseCode) ?? [];
    list.push(p);
    byCase.set(p.caseCode, list);
  }

  const base = [...byCase.entries()].map(([caseCode, list]) => {
    const billed = list.reduce((s, p) => s + p.billedCents, 0);
    const minutes = list.reduce(
      (s, p) => s + p.sessions.reduce((t, x) => t + sessionMinutes(x), 0),
      0,
    );
    let weakest: { type: string; centsPerHour: number } | null = null;
    for (const p of list) {
      const m = p.sessions.reduce((t, x) => t + sessionMinutes(x), 0);
      const cph = centsPerHour(p.billedCents, m);
      if (cph !== null && (weakest === null || cph < weakest.centsPerHour)) {
        weakest = { type: p.procedureType, centsPerHour: cph };
      }
    }
    return {
      caseCode,
      procedureTypes: [...new Set(list.map((p) => p.procedureType))],
      procedureCount: list.length,
      sessionCount: list.reduce((s, p) => s + p.sessions.length, 0),
      billedCents: billed,
      chairMinutes: minutes,
      centsPerHour: centsPerHour(billed, minutes),
      directCostsCents: list.reduce((s, p) => s + p.labCostCents + p.otherCostCents, 0),
      completed: list.every((p) => p.completed),
      highValue: billed >= HIGH_VALUE_CASE_CENTS,
      weakestProcedure: list.length > 1 ? weakest : null,
    };
  });

  const highValueTimed = base.filter((c) => c.highValue && c.chairMinutes > 0);
  // Com menos de dois casos de valor elevado não há termo de comparação.
  const reference =
    highValueTimed.length >= 2
      ? centsPerHour(
          highValueTimed.reduce((s, c) => s + c.billedCents, 0),
          highValueTimed.reduce((s, c) => s + c.chairMinutes, 0),
        )
      : null;

  const cases = base
    .map((c) => ({
      ...c,
      highValueLowProductivity:
        c.highValue &&
        reference !== null &&
        c.centsPerHour !== null &&
        c.centsPerHour < reference * LOW_PRODUCTIVITY_FACTOR,
    }))
    .sort((a, b) => b.billedCents - a.billedCents || a.caseCode.localeCompare(b.caseCode));

  return { cases, highValueReferenceCph: reference };
}

// ---------------------------------------------------------------------------
// Particular vs seguros/convenções
// ---------------------------------------------------------------------------

export interface PayerComparisonRow {
  readonly procedureType: string;
  readonly privateCases: number;
  readonly thirdPartyCases: number;
  readonly privateAvgPriceCents: Ratio;
  readonly thirdPartyAvgPriceCents: Ratio;
  readonly privateAvgMinutes: Ratio;
  readonly thirdPartyAvgMinutes: Ratio;
  readonly privateCph: Ratio;
  readonly thirdPartyCph: Ratio;
  /** €/h seguro − €/h particular (negativo = seguro rende menos por hora). */
  readonly diffCph: Ratio;
  /** Diferença relativa ao particular: −0,4 = 40% abaixo. */
  readonly diffShare: Ratio;
}

interface PayerAcc {
  cases: number;
  price: number;
  timedCases: number;
  timedRevenue: number;
  minutes: number;
}

function emptyAcc(): PayerAcc {
  return { cases: 0, price: 0, timedCases: 0, timedRevenue: 0, minutes: 0 };
}

function addToAcc(acc: PayerAcc, p: ProcedureRecord): void {
  const minutes = p.sessions.reduce((s, x) => s + sessionMinutes(x), 0);
  acc.cases += 1;
  acc.price += p.billedCents;
  if (minutes > 0) {
    acc.timedCases += 1;
    acc.timedRevenue += p.billedCents;
    acc.minutes += minutes;
  }
}

export function payerComparison(procedures: readonly ProcedureRecord[]): PayerComparisonRow[] {
  const groups = new Map<string, { priv: PayerAcc; third: PayerAcc }>();
  for (const p of procedures) {
    const g = groups.get(p.procedureType) ?? { priv: emptyAcc(), third: emptyAcc() };
    addToAcc(isThirdPartyPayer(p.payerType) ? g.third : g.priv, p);
    groups.set(p.procedureType, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.priv.cases > 0 && g.third.cases > 0)
    .map(([procedureType, { priv, third }]) => {
      const privateCph = centsPerHour(priv.timedRevenue, priv.minutes);
      const thirdPartyCph = centsPerHour(third.timedRevenue, third.minutes);
      const diffCph =
        privateCph !== null && thirdPartyCph !== null ? thirdPartyCph - privateCph : null;
      return {
        procedureType,
        privateCases: priv.cases,
        thirdPartyCases: third.cases,
        privateAvgPriceCents: safeDivide(priv.price, priv.cases),
        thirdPartyAvgPriceCents: safeDivide(third.price, third.cases),
        privateAvgMinutes: safeDivide(priv.minutes, priv.timedCases),
        thirdPartyAvgMinutes: safeDivide(third.minutes, third.timedCases),
        privateCph,
        thirdPartyCph,
        diffCph,
        diffShare: diffCph === null || privateCph === null ? null : safeDivide(diffCph, privateCph),
      };
    })
    .sort((a, b) => (a.diffShare ?? 0) - (b.diffShare ?? 0));
}

export interface InsurerRow {
  readonly payerName: string;
  readonly payerType: string;
  readonly cases: number;
  readonly revenueCents: number;
  readonly chairMinutes: number;
  readonly centsPerHour: Ratio;
  /**
   * €/h que os mesmos procedimentos (mesma mistura, mesmo tempo) renderiam a
   * preço particular. Compara maçãs com maçãs: um seguro que só faz consultas não
   * é penalizado por as coroas particulares renderem mais.
   */
  readonly privateEquivalentCph: Ratio;
  readonly diffShare: Ratio;
  /** Desconto face à tabela: Σ(valor tabelado − valor faturado). */
  readonly discountCents: number;
}

export function insurerAnalysis(procedures: readonly ProcedureRecord[]): InsurerRow[] {
  const privateCphByType = new Map<string, number>();
  const privAcc = new Map<string, PayerAcc>();
  for (const p of procedures) {
    if (isThirdPartyPayer(p.payerType)) continue;
    const acc = privAcc.get(p.procedureType) ?? emptyAcc();
    addToAcc(acc, p);
    privAcc.set(p.procedureType, acc);
  }
  for (const [type, acc] of privAcc) {
    const cph = centsPerHour(acc.timedRevenue, acc.minutes);
    if (cph !== null) privateCphByType.set(type, cph);
  }

  const groups = new Map<
    string,
    { payerType: string; cases: number; revenue: number; minutes: number; timedRevenue: number; eqRevenue: number; eqMinutes: number; eqActual: number; discount: number }
  >();
  for (const p of procedures) {
    if (!isThirdPartyPayer(p.payerType)) continue;
    const name = p.payerName?.trim() || "Sem nome";
    const g =
      groups.get(name) ??
      { payerType: p.payerType, cases: 0, revenue: 0, minutes: 0, timedRevenue: 0, eqRevenue: 0, eqMinutes: 0, eqActual: 0, discount: 0 };
    const minutes = p.sessions.reduce((s, x) => s + sessionMinutes(x), 0);
    g.cases += 1;
    g.revenue += p.billedCents;
    g.discount += Math.max(0, p.listPriceCents - p.billedCents);
    if (minutes > 0) {
      g.minutes += minutes;
      g.timedRevenue += p.billedCents;
      const ref = privateCphByType.get(p.procedureType);
      if (ref !== undefined) {
        g.eqRevenue += (ref * minutes) / 60;
        g.eqMinutes += minutes;
        g.eqActual += p.billedCents;
      }
    }
    groups.set(name, g);
  }

  return [...groups.entries()]
    .map(([payerName, g]) => {
      const privateEquivalentCph = centsPerHour(g.eqRevenue, g.eqMinutes);
      const comparableCph = centsPerHour(g.eqActual, g.eqMinutes);
      return {
        payerName,
        payerType: g.payerType,
        cases: g.cases,
        revenueCents: g.revenue,
        chairMinutes: g.minutes,
        centsPerHour: centsPerHour(g.timedRevenue, g.minutes),
        privateEquivalentCph,
        diffShare:
          privateEquivalentCph === null || comparableCph === null
            ? null
            : safeDivide(comparableCph - privateEquivalentCph, privateEquivalentCph),
        discountCents: g.discount,
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents);
}

export interface AgreementImpact {
  readonly thirdPartyRevenueCents: number;
  readonly thirdPartyShare: Ratio;
  readonly thirdPartyMinutes: number;
  /** Σ(valor tabelado − valor faturado) nos atos com seguro/convenção. */
  readonly discountCents: number;
  /**
   * Diferença entre o que as mesmas horas renderiam ao €/h particular do mesmo
   * procedimento e o que renderam. Só procedimentos com referência particular.
   */
  readonly timeValueGapCents: number;
}

export function agreementImpact(procedures: readonly ProcedureRecord[]): AgreementImpact {
  const total = procedures.reduce((s, p) => s + p.billedCents, 0);
  const third = procedures.filter((p) => isThirdPartyPayer(p.payerType));
  const thirdRevenue = third.reduce((s, p) => s + p.billedCents, 0);
  let gap = 0;
  const privateRef = new Map<string, { revenue: number; minutes: number }>();
  for (const p of procedures) {
    if (isThirdPartyPayer(p.payerType)) continue;
    const m = p.sessions.reduce((s, x) => s + sessionMinutes(x), 0);
    if (m <= 0) continue;
    const r = privateRef.get(p.procedureType) ?? { revenue: 0, minutes: 0 };
    r.revenue += p.billedCents;
    r.minutes += m;
    privateRef.set(p.procedureType, r);
  }
  for (const p of third) {
    const m = p.sessions.reduce((s, x) => s + sessionMinutes(x), 0);
    const ref = privateRef.get(p.procedureType);
    if (m <= 0 || !ref) continue;
    gap += (ref.revenue * m) / ref.minutes - p.billedCents;
  }
  return {
    thirdPartyRevenueCents: thirdRevenue,
    thirdPartyShare: safeDivide(thirdRevenue, total),
    thirdPartyMinutes: third.reduce(
      (s, p) => s + p.sessions.reduce((t, x) => t + sessionMinutes(x), 0),
      0,
    ),
    discountCents: third.reduce((s, p) => s + Math.max(0, p.listPriceCents - p.billedCents), 0),
    timeValueGapCents: Math.round(gap),
  };
}
