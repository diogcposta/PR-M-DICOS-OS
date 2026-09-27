import type { ProcedureRecord } from "@/modules/production/domain/metrics";
import { formatTime } from "@/modules/production/domain/time";

import type { ProcedureDraft } from "./ProcedureForm";

const money = (cents: number) => (cents === 0 ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));

export function emptyDraft(date: string, startMinute: number | null): ProcedureDraft {
  return {
    date,
    caseCode: "",
    procedureType: "",
    category: "",
    listPrice: "",
    billed: "",
    payerType: "PRIVATE",
    payerName: "",
    start: startMinute === null ? "" : formatTime(startMinute),
    end: "",
    plannedVisits: "1",
    labCost: "",
    otherCost: "",
    note: "",
    completed: true,
  };
}

/** Rascunho a partir de um procedimento gravado (primeira consulta para as horas). */
export function draftFromRecord(p: ProcedureRecord, note: string | null = null): ProcedureDraft {
  const first = p.sessions[0];
  return {
    date: p.date,
    caseCode: p.caseCode ?? "",
    procedureType: p.procedureType,
    category: p.category,
    listPrice: money(p.listPriceCents),
    billed: p.billedCents === 0 ? "0" : money(p.billedCents),
    payerType: p.payerType,
    payerName: p.payerName ?? "",
    start: first ? formatTime(first.startMinute) : "",
    end: first ? formatTime(first.endMinute) : "",
    plannedVisits: String(p.plannedVisits),
    labCost: money(p.labCostCents),
    otherCost: money(p.otherCostCents),
    note: note ?? "",
    completed: p.completed,
  };
}
