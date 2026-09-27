/**
 * Dados de demonstração SINTÉTICOS do módulo de produção.
 *
 * Determinístico (PRNG semeado): a mesma semente gera sempre os mesmos dados,
 * o que permite testar os totais. Nenhum dado real: casos só com Case ID,
 * seguradoras com nomes genéricos ("Seguradora A").
 *
 * Setembro de 2026 reproduz os números de referência do pedido:
 *  - produção €8.619, honorários (50%) €4.309,50;
 *  - 130,5 h clínicas (17 dias úteis, um deles de 7 h, e um sábado de 3,5 h) → ≈ €66,05/h;
 *  - dois dias clínicos ainda por realizar (29 e 30, previstos);
 *  - DC-2026-001: coroa €600 em 3 consultas (90 + 45 + 45 min) → €200/h;
 *  - DC-2026-002: retratamento €200 (4 h) + coroa €600 (3 h) = €800 em 7 h → ≈ €114/h.
 */
import { addDays, datesInRange, isoWeekday, monthOf } from "../domain/time";

export interface DemoSession {
  readonly date: string;
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface DemoProcedure {
  key: string;
  date: string;
  caseCode: string | null;
  procedureType: string;
  category: string;
  listPriceCents: number;
  billedCents: number;
  payerType: "PRIVATE" | "INSURANCE" | "AGREEMENT";
  payerName: string | null;
  plannedVisits: number;
  labCostCents: number;
  otherCostCents: number;
  note: string | null;
  completed: boolean;
  sessions: DemoSession[];
  /** Procedimentos de referência nunca são removidos pelo ajuste de totais. */
  pinned: boolean;
}

export interface DemoDay {
  readonly date: string;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly breakMinutes: number;
  readonly status: "WORKED" | "PLANNED";
}

export interface DemoAbsence {
  readonly date: string;
  readonly startMinute: number;
  readonly durationMinutes: number;
  readonly plannedProcedure: string;
  readonly estimatedValueCents: number;
  readonly payerType: string;
  readonly kind: "NO_SHOW" | "LATE_CANCEL" | "EARLY_CANCEL";
  readonly slotRecovered: boolean;
  readonly recoveredValueCents: number;
}

export interface DemoPlan {
  readonly caseCode: string;
  readonly presentedDate: string;
  readonly diagnosedCents: number;
  readonly totalCents: number;
  readonly phases: number;
  readonly status: string;
  readonly acceptedCents: number;
  readonly performedCents: number;
  readonly lastContactDate: string | null;
  readonly nextAppointmentBooked: boolean;
}

export interface DemoDataset {
  readonly days: DemoDay[];
  readonly procedures: DemoProcedure[];
  readonly absences: DemoAbsence[];
  readonly plans: DemoPlan[];
}

export const DEMO_REFERENCE = {
  month: "2026-09",
  productionCents: 861_900,
  clinicalMinutes: 7_830,
  today: "2026-09-26",
} as const;

/** mulberry32: PRNG pequeno e determinístico. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface CatalogItem {
  type: string;
  category: string;
  priceCents: number;
  /** Duração de cada consulta, em minutos. */
  visits: number[];
  labCents: number;
  weight: number;
  insurable: boolean;
}

const CATALOG: CatalogItem[] = [
  { type: "Consulta de avaliação", category: "Consulta", priceCents: 3_500, visits: [30], labCents: 0, weight: 12, insurable: true },
  { type: "Diagnóstico radiográfico", category: "Diagnóstico", priceCents: 2_500, visits: [15], labCents: 0, weight: 3, insurable: true },
  { type: "Restauração a compósito", category: "Dentisteria", priceCents: 6_000, visits: [45], labCents: 0, weight: 14, insurable: true },
  { type: "Restauração classe II", category: "Dentisteria", priceCents: 7_500, visits: [60], labCents: 0, weight: 6, insurable: true },
  { type: "Higiene oral", category: "Higiene oral", priceCents: 4_500, visits: [45], labCents: 0, weight: 13, insurable: true },
  { type: "Endodontia molar", category: "Endodontia", priceCents: 22_000, visits: [90, 60], labCents: 0, weight: 3, insurable: true },
  { type: "Endodontia unirradicular", category: "Endodontia", priceCents: 13_000, visits: [60], labCents: 0, weight: 3, insurable: true },
  { type: "Retratamento endodôntico", category: "Retratamento endodôntico", priceCents: 20_000, visits: [90, 90, 60], labCents: 0, weight: 1.5, insurable: true },
  { type: "Alisamento radicular", category: "Periodontologia", priceCents: 18_000, visits: [60, 60], labCents: 0, weight: 2, insurable: true },
  { type: "Exodontia simples", category: "Cirurgia", priceCents: 5_000, visits: [30], labCents: 0, weight: 4, insurable: true },
  { type: "Exodontia de siso", category: "Cirurgia", priceCents: 15_000, visits: [60], labCents: 0, weight: 1.5, insurable: true },
  { type: "Implante", category: "Implantologia", priceCents: 90_000, visits: [90, 45, 30], labCents: 25_000, weight: 0.25, insurable: false },
  { type: "Coroa cerâmica", category: "Coroa", priceCents: 60_000, visits: [90, 45, 45], labCents: 15_000, weight: 0.7, insurable: true },
  { type: "Onlay cerâmico", category: "Onlay/Overlay", priceCents: 45_000, visits: [90, 45], labCents: 10_000, weight: 0.5, insurable: false },
  { type: "Prótese removível", category: "Prótese removível", priceCents: 70_000, visits: [45, 45, 45, 30], labCents: 25_000, weight: 0.25, insurable: true },
  { type: "Branqueamento", category: "Estética", priceCents: 25_000, visits: [60, 30], labCents: 3_000, weight: 0.25, insurable: false },
  { type: "Urgência", category: "Urgência", priceCents: 4_500, visits: [30], labCents: 0, weight: 5, insurable: true },
  { type: "Controlo", category: "Controlo", priceCents: 0, visits: [15], labCents: 0, weight: 5, insurable: false },
];

const PAYERS = [
  { payerType: "INSURANCE" as const, payerName: "Seguradora A", factor: 0.5 },
  { payerType: "INSURANCE" as const, payerName: "Seguradora B", factor: 0.65 },
  { payerType: "AGREEMENT" as const, payerName: "Convenção C", factor: 0.75 },
];

const MORNING = { start: 9 * 60 + 30, end: 12 * 60 + 30 };
const AFTERNOON = { start: 14 * 60 + 30, end: 19 * 60 };

interface MonthProfile {
  idle: number;
  absence: number;
  insurance: number;
  /** €/h clínico alvo (cêntimos) do mês; setembro usa o total de referência. */
  targetCph: number | null;
}

/** Evolução gradual: menos tempo morto e menos faltas ao longo dos meses. */
const MONTH_PROFILES: Record<string, MonthProfile> = {
  "2026-04": { idle: 0.08, absence: 0.11, insurance: 0.55, targetCph: 5_500 },
  "2026-05": { idle: 0.08, absence: 0.1, insurance: 0.54, targetCph: 5_700 },
  "2026-06": { idle: 0.07, absence: 0.1, insurance: 0.52, targetCph: 5_900 },
  "2026-07": { idle: 0.07, absence: 0.09, insurance: 0.5, targetCph: 6_100 },
  "2026-08": { idle: 0.06, absence: 0.09, insurance: 0.5, targetCph: 6_300 },
  "2026-09": { idle: 0.05, absence: 0.08, insurance: 0.5, targetCph: null },
};

/** Dias clínicos: úteis de abril a setembro, com ausências e férias em agosto. */
function buildDays(): DemoDay[] {
  const off = new Set([
    "2026-04-03", "2026-04-24", "2026-05-01", "2026-06-04", "2026-06-10", "2026-06-13",
    "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15",
    "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21",
    "2026-09-11", "2026-09-18", "2026-09-28",
  ]);
  const saturdays = new Set(["2026-05-16", "2026-06-20", "2026-07-11", "2026-09-19"]);
  const days: DemoDay[] = [];
  for (const date of datesInRange("2026-04-01", "2026-09-30")) {
    const wd = isoWeekday(date);
    if (off.has(date)) continue;
    const status = date > DEMO_REFERENCE.today ? "PLANNED" : "WORKED";
    if (saturdays.has(date)) {
      days.push({ date, startMinute: 9 * 60 + 30, endMinute: 13 * 60, breakMinutes: 0, status });
    } else if (wd <= 5) {
      // 23 de setembro: dia mais curto (saída às 18:30) → 7 h.
      const end = date === "2026-09-23" ? 18 * 60 + 30 : AFTERNOON.end;
      days.push({ date, startMinute: MORNING.start, endMinute: end, breakMinutes: 120, status });
    }
  }
  return days;
}

interface Reserved {
  procedureKey: string;
  startMinute: number;
  endMinute: number;
}

export function buildDemoDataset(seed = 20_260_926): DemoDataset {
  const rand = prng(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
  const weighted = (items: readonly CatalogItem[]): CatalogItem => {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = rand() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return items[items.length - 1]!;
  };

  const days = buildDays();
  const procedures: DemoProcedure[] = [];
  const absences: DemoAbsence[] = [];
  const byKey = new Map<string, DemoProcedure>();
  let caseCounter = 2;
  const nextCase = () => `DC-2026-${String(++caseCounter).padStart(3, "0")}`;
  let procCounter = 0;

  // Consultas fixas dos dois casos de referência, reservadas antes de preencher a agenda.
  const reserved = new Map<string, Reserved[]>();
  const reserve = (key: string, date: string, start: number, minutes: number) => {
    const list = reserved.get(date) ?? [];
    list.push({ procedureKey: key, startMinute: start, endMinute: start + minutes });
    reserved.set(date, list);
  };
  const pinnedProcedure = (key: string, date: string, caseCode: string, item: CatalogItem, visits: number, note: string): DemoProcedure => {
    const p: DemoProcedure = {
      key, date, caseCode, procedureType: item.type, category: item.category,
      listPriceCents: item.priceCents, billedCents: item.priceCents, payerType: "PRIVATE", payerName: null,
      plannedVisits: visits, labCostCents: item.labCents, otherCostCents: 0, note, completed: true, sessions: [], pinned: true,
    };
    procedures.push(p);
    byKey.set(key, p);
    return p;
  };
  const coroa = CATALOG.find((c) => c.type === "Coroa cerâmica")!;
  const retrat = CATALOG.find((c) => c.type === "Retratamento endodôntico")!;
  pinnedProcedure("ref-coroa-1", "2026-09-02", "DC-2026-001", coroa, 3, "Exemplo de referência: coroa em 3 consultas");
  reserve("ref-coroa-1", "2026-09-02", MORNING.start, 90);
  reserve("ref-coroa-1", "2026-09-09", MORNING.start, 45);
  reserve("ref-coroa-1", "2026-09-16", MORNING.start, 45);
  pinnedProcedure("ref-retrat-2", "2026-09-03", "DC-2026-002", retrat, 3, "Exemplo de referência: caso complexo");
  reserve("ref-retrat-2", "2026-09-03", AFTERNOON.start, 90);
  reserve("ref-retrat-2", "2026-09-08", AFTERNOON.start, 90);
  reserve("ref-retrat-2", "2026-09-15", AFTERNOON.start, 60);
  pinnedProcedure("ref-coroa-2", "2026-09-17", "DC-2026-002", coroa, 3, "Exemplo de referência: caso complexo");
  reserve("ref-coroa-2", "2026-09-17", AFTERNOON.start, 90);
  reserve("ref-coroa-2", "2026-09-22", AFTERNOON.start, 45);
  reserve("ref-coroa-2", "2026-09-24", AFTERNOON.start, 45);

  /** Consultas seguintes de tratamentos multi-consulta ainda por agendar. */
  const pending: Array<{ key: string; durations: number[]; notBefore: string }> = [];

  const newProcedure = (date: string, item: CatalogItem, profile: MonthProfile): DemoProcedure => {
    const insured = item.insurable && item.priceCents > 0 && rand() < profile.insurance;
    const payer = insured ? pick(PAYERS) : null;
    const billed = payer ? Math.round((item.priceCents * payer.factor) / 100) * 100 : item.priceCents;
    const multi = item.visits.length > 1 || item.priceCents >= 15_000;
    const p: DemoProcedure = {
      key: `p${++procCounter}`,
      date,
      caseCode: multi ? nextCase() : null,
      procedureType: item.type,
      category: item.category,
      listPriceCents: item.priceCents,
      billedCents: billed,
      payerType: payer?.payerType ?? "PRIVATE",
      payerName: payer?.payerName ?? null,
      plannedVisits: item.visits.length,
      labCostCents: item.labCents,
      otherCostCents: item.labCents > 0 ? 1_000 : 0,
      note: null,
      completed: item.visits.length === 1,
      sessions: [],
      pinned: false,
    };
    procedures.push(p);
    byKey.set(p.key, p);
    if (item.visits.length > 1) {
      pending.push({ key: p.key, durations: item.visits.slice(1), notBefore: addDays(date, 5) });
    }
    return p;
  };

  for (const day of days) {
    if (day.status !== "WORKED") continue;
    const profile = MONTH_PROFILES[monthOf(day.date)]!;
    const blocks =
      day.breakMinutes === 0
        ? [{ start: day.startMinute, end: day.endMinute }]
        : [{ start: MORNING.start, end: MORNING.end }, { start: AFTERNOON.start, end: day.endMinute }];
    const dayReserved = (reserved.get(day.date) ?? []).sort((a, b) => a.startMinute - b.startMinute);
    for (const r of dayReserved) {
      byKey.get(r.procedureKey)!.sessions.push({ date: day.date, startMinute: r.startMinute, endMinute: r.endMinute });
    }

    for (const block of blocks) {
      let cursor = block.start;
      while (cursor < block.end) {
        const hit = dayReserved.find((r) => r.startMinute <= cursor && cursor < r.endMinute);
        if (hit) {
          cursor = hit.endMinute;
          continue;
        }
        const nextReserved = dayReserved.find((r) => r.startMinute > cursor)?.startMinute ?? Infinity;
        const limit = Math.min(block.end, nextReserved);
        const room = limit - cursor;
        if (room < 15) {
          cursor = limit;
          continue;
        }
        const r = rand();
        if (r < profile.idle) {
          cursor += Math.min(room, 45);
          continue;
        }
        if (r < profile.idle + profile.absence) {
          const item = weighted(CATALOG.filter((c) => c.visits[0]! <= room && c.priceCents > 0));
          const minutes = item.visits[0]!;
          const k = rand();
          const kind = k < 0.6 ? "NO_SHOW" : k < 0.85 ? "LATE_CANCEL" : "EARLY_CANCEL";
          const recovered = rand() < (kind === "EARLY_CANCEL" ? 0.6 : 0.25);
          let recoveredValue = 0;
          if (recovered) {
            // A vaga foi ocupada por outro paciente da lista de espera.
            const replacement = weighted(CATALOG.filter((c) => c.visits[0]! <= minutes && c.visits.length === 1 && c.priceCents > 0));
            const p = newProcedure(day.date, replacement, profile);
            p.sessions.push({ date: day.date, startMinute: cursor, endMinute: cursor + replacement.visits[0]! });
            recoveredValue = p.billedCents;
          }
          absences.push({
            date: day.date,
            startMinute: cursor,
            durationMinutes: minutes,
            plannedProcedure: item.type,
            estimatedValueCents: Math.round(item.priceCents / item.visits.length),
            payerType: "PRIVATE",
            kind,
            slotRecovered: recovered,
            recoveredValueCents: recoveredValue,
          });
          cursor += minutes;
          continue;
        }
        const pendingIndex = pending.findIndex((q) => q.notBefore <= day.date && q.durations[0]! <= room);
        if (pendingIndex >= 0 && rand() < 0.5) {
          const q = pending[pendingIndex]!;
          const minutes = q.durations.shift()!;
          const p = byKey.get(q.key)!;
          p.sessions.push({ date: day.date, startMinute: cursor, endMinute: cursor + minutes });
          if (q.durations.length === 0) {
            p.completed = true;
            pending.splice(pendingIndex, 1);
          } else {
            q.notBefore = addDays(day.date, 5);
          }
          cursor += minutes;
          continue;
        }
        const options = CATALOG.filter((c) => c.visits[0]! <= room);
        if (options.length === 0) {
          cursor = limit;
          continue;
        }
        const item = weighted(options);
        const p = newProcedure(day.date, item, profile);
        p.sessions.push({ date: day.date, startMinute: cursor, endMinute: cursor + item.visits[0]! });
        cursor += item.visits[0]!;
      }
    }
  }

  for (const [month, profile] of Object.entries(MONTH_PROFILES)) {
    const clinical = days
      .filter((d) => d.status === "WORKED" && monthOf(d.date) === month)
      .reduce((s, d) => s + d.endMinute - d.startMinute - d.breakMinutes, 0);
    const target =
      month === DEMO_REFERENCE.month
        ? DEMO_REFERENCE.productionCents
        : Math.round(((profile.targetCph ?? 0) * clinical) / 60 / 100) * 100;
    adjustMonthProduction(month, target, month === DEMO_REFERENCE.month, procedures, absences, rand);
  }
  const plans = buildPlans(rand, procedures);
  return { days, procedures, absences, plans };
}

/**
 * Aproxima a produção de um mês do alvo: remove atos simples (em ordem
 * pseudoaleatória, espalhados pelo mês) até ficar abaixo do alvo. Com `exact`,
 * acerta a diferença restante num único ato particular (setembro = €8.619).
 */
function adjustMonthProduction(
  month: string,
  target: number,
  exact: boolean,
  procedures: DemoProcedure[],
  absences: DemoAbsence[],
  rand: () => number,
): void {
  const inMonth = () => procedures.filter((p) => monthOf(p.date) === month);
  const total = () => inMonth().reduce((s, p) => s + p.billedCents, 0);
  const recoveredKeys = new Set<string>();
  for (const a of absences) if (a.slotRecovered) recoveredKeys.add(`${a.date}-${a.startMinute}`);

  const removable = inMonth()
    .filter((p) => !p.pinned && p.plannedVisits === 1 && p.caseCode === null && p.billedCents > 0)
    .filter((p) => !recoveredKeys.has(`${p.date}-${p.sessions[0]?.startMinute}`))
    .map((p) => ({ p, order: rand() }))
    .sort((a, b) => a.order - b.order)
    .map(({ p }) => p);
  let current = total();
  for (const p of removable) {
    if (current <= target) break;
    procedures.splice(procedures.indexOf(p), 1);
    current -= p.billedCents;
  }
  if (!exact) return;
  const diff = target - current;
  const adjustable = inMonth()
    .filter((p) => !p.pinned && p.payerType === "PRIVATE" && p.billedCents > 0)
    .sort((a, b) => b.billedCents - a.billedCents)[0];
  if (!adjustable || adjustable.billedCents + diff <= 0) {
    throw new Error(`Dados de demonstração: não foi possível ajustar a produção de ${month}.`);
  }
  adjustable.billedCents += diff;
  adjustable.listPriceCents = Math.max(adjustable.listPriceCents, adjustable.billedCents);
}

function buildPlans(rand: () => number, procedures: readonly DemoProcedure[]): DemoPlan[] {
  const plans: DemoPlan[] = [];
  const casesWithProcedures = [...new Set(procedures.filter((p) => p.caseCode).map((p) => p.caseCode!))];
  const firstDate = new Map<string, string>();
  const valueByCase = new Map<string, number>();
  for (const p of procedures) {
    if (!p.caseCode) continue;
    if (!firstDate.has(p.caseCode) || p.date < firstDate.get(p.caseCode)!) firstDate.set(p.caseCode, p.date);
    valueByCase.set(p.caseCode, (valueByCase.get(p.caseCode) ?? 0) + p.billedCents);
  }

  // Planos de casos em curso: aceites; parte deles já concluídos.
  for (const code of casesWithProcedures) {
    const performed = valueByCase.get(code)!;
    const presented = addDays(firstDate.get(code)!, -7);
    const extra = rand() < 0.3 ? Math.round((rand() * 1_500 + 200)) * 100 : 0;
    const total = performed + extra;
    const allDone = procedures.filter((p) => p.caseCode === code).every((p) => p.completed);
    const status = extra === 0 && allDone ? "COMPLETED" : "ACCEPTED";
    plans.push({
      caseCode: code,
      presentedDate: presented < "2026-04-01" ? "2026-04-01" : presented,
      diagnosedCents: total + (rand() < 0.4 ? Math.round(rand() * 800) * 100 : 0),
      totalCents: total,
      phases: extra > 0 ? 2 : 1,
      status,
      acceptedCents: total,
      performedCents: performed,
      lastContactDate: null,
      nextAppointmentBooked: status !== "COMPLETED" && rand() < 0.6,
    });
  }

  // Planos apresentados que (ainda) não avançaram.
  let counter = 500;
  const presentedDates = [
    "2026-04-14", "2026-04-28", "2026-05-12", "2026-05-26", "2026-06-09", "2026-06-23",
    "2026-07-07", "2026-07-21", "2026-08-04", "2026-08-25", "2026-09-01", "2026-09-04",
    "2026-09-08", "2026-09-10", "2026-09-15", "2026-09-17", "2026-09-21", "2026-09-24",
  ];
  for (const date of presentedDates) {
    const total = Math.round(rand() * 35 + 3) * 10_000;
    const r = rand();
    const old = date < "2026-08-15";
    const status = old
      ? r < 0.45 ? "REJECTED" : r < 0.75 ? "PENDING" : "PARTIALLY_ACCEPTED"
      : r < 0.55 ? "PRESENTED" : r < 0.75 ? "PENDING" : r < 0.9 ? "PARTIALLY_ACCEPTED" : "REJECTED";
    const accepted = status === "PARTIALLY_ACCEPTED" ? Math.round(total * 0.4 / 100) * 100 : 0;
    const contact = rand() < 0.5 ? addDays(date, Math.floor(rand() * 10) + 2) : null;
    plans.push({
      caseCode: `DC-2026-${++counter}`,
      presentedDate: date,
      diagnosedCents: total + Math.round(rand() * 5) * 10_000,
      totalCents: total,
      phases: total > 150_000 ? 3 : total > 60_000 ? 2 : 1,
      status,
      acceptedCents: accepted,
      performedCents: status === "PARTIALLY_ACCEPTED" && rand() < 0.5 ? Math.round(accepted / 2 / 100) * 100 : 0,
      lastContactDate: contact && contact <= DEMO_REFERENCE.today ? contact : null,
      nextAppointmentBooked: status === "PARTIALLY_ACCEPTED" && rand() < 0.3,
    });
  }
  return plans;
}
