/**
 * Fecho do mês (D-060).
 *
 * No dia a dia o médico só conhece o valor pago pelo paciente: os honorários
 * são uma estimativa (pago × percentagem, mais os exames). O valor recebido
 * chega no fim do mês, na folha de honorários, e pode ser diferente — é o
 * fecho do mês, um total por mês que já inclui os exames.
 *
 * Os fechos servem também de histórico: meses sem registos diários (antes de a
 * app ser usada) entram só com os totais mensais que o médico tem.
 */
import type { Ratio } from "@/modules/kpis/domain/ratio";

import { centsPerHour } from "./metrics";
import type { MonthlySummary } from "./monthly";

export interface ClosingRecord {
  readonly id: string;
  /** `aaaa-mm`. */
  readonly month: string;
  /** Total da folha de honorários (atos e exames). */
  readonly receivedCents: number;
  /** Só para meses sem registos: valor pago pelos pacientes no mês. */
  readonly productionCents: number | null;
  /** Só para meses sem registos: horas clínicas do mês, em minutos. */
  readonly clinicalMinutes: number | null;
  readonly note: string | null;
}

export interface MonthFees {
  readonly month: string;
  readonly status: "estimado" | "fechado";
  /** Honorários dos atos + exames calculados a partir dos registos. */
  readonly estimatedCents: number;
  readonly receivedCents: number | null;
  /** Recebido − estimado; `null` sem fecho ou sem registos para estimar. */
  readonly differenceCents: number | null;
}

export function closingFor(closings: readonly ClosingRecord[], month: string): ClosingRecord | null {
  return closings.find((c) => c.month === month) ?? null;
}

/** Estado dos honorários de um mês. `estimatedCents` = honorários dos atos + dos exames. */
export function monthFees(month: string, estimatedCents: number, closings: readonly ClosingRecord[]): MonthFees {
  const closing = closingFor(closings, month);
  if (!closing) return { month, status: "estimado", estimatedCents, receivedCents: null, differenceCents: null };
  return {
    month,
    status: "fechado",
    estimatedCents,
    receivedCents: closing.receivedCents,
    differenceCents: estimatedCents > 0 ? closing.receivedCents - estimatedCents : null,
  };
}

export function hasRecords(s: Pick<MonthlySummary, "procedureCount" | "workedDays">): boolean {
  return s.procedureCount > 0 || s.workedDays > 0;
}

export type SummaryWithClosing = MonthlySummary & {
  /** Mês sem registos cujos totais vêm do fecho (histórico). */
  readonly fromClosing: boolean;
};

/**
 * Meses sem registos com fecho passam a usar os totais do fecho: produção,
 * horas, €/h e honorários (= recebido). Os meses com registos não mudam — a
 * produção e o €/h vêm sempre dos registos diários.
 */
export function applyClosings(summaries: readonly MonthlySummary[], closings: readonly ClosingRecord[]): SummaryWithClosing[] {
  return summaries.map((s) => {
    const closing = closingFor(closings, s.month);
    if (!closing || hasRecords(s)) return { ...s, fromClosing: false };
    const production = closing.productionCents ?? 0;
    const minutes = closing.clinicalMinutes ?? 0;
    const cph: Ratio = centsPerHour(production, minutes);
    return {
      ...s,
      fromClosing: true,
      productionCents: production,
      feeCents: closing.receivedCents,
      clinicalMinutes: minutes,
      centsPerHour: cph,
      feeCentsPerHour: centsPerHour(closing.receivedCents, minutes),
    };
  });
}
