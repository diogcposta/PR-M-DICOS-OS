import type { ProcedureRecord } from "@/modules/production/domain/metrics";

let counter = 0;

/** Procedimento de teste; `visits` são durações em minutos (uma consulta por entrada). */
export function proc(overrides: Partial<ProcedureRecord> & { visits?: number[] } = {}): ProcedureRecord {
  const id = overrides.id ?? `p${++counter}`;
  const { visits = [60], ...rest } = overrides;
  let start = 9 * 60;
  return {
    id,
    date: "2026-09-01",
    caseCode: null,
    procedureType: "Restauração",
    category: "Dentisteria",
    listPriceCents: rest.billedCents ?? 10_000,
    billedCents: 10_000,
    payerType: "PRIVATE",
    payerName: null,
    plannedVisits: visits.length,
    labCostCents: 0,
    otherCostCents: 0,
    completed: true,
    sessions: visits.map((minutes, i) => {
      const s = { id: `${id}-s${i}`, procedureId: id, date: rest.date ?? "2026-09-01", startMinute: start, endMinute: start + minutes };
      start += minutes;
      return s;
    }),
    ...rest,
  };
}

export const FEES_50 = { feeBps: 5000, feeBase: "BILLED" as const };
