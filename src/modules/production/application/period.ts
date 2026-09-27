/**
 * Período escolhido no URL (`?periodo=2026-09`, `3m`, `6m`, `12m`, `ano`).
 * Os filtros vivem no URL (D-023): uma vista filtrada é partilhável e sobrevive ao refresh.
 */
import { addMonths, formatMonthLong, isValidCivilMonth, monthRange, type CivilMonth } from "../domain/time";

export interface SelectedPeriod {
  readonly key: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  /** Mês de referência (o último mês do período). */
  readonly month: CivilMonth;
}

export const PERIOD_PRESETS = [
  { key: "mes", label: "Mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "12 meses" },
] as const;

export function parsePeriod(
  params: Record<string, string | undefined>,
  defaultMonth: CivilMonth,
): SelectedPeriod {
  const month = params.mes && isValidCivilMonth(params.mes) ? params.mes : defaultMonth;
  const preset = params.periodo ?? "mes";
  const months = preset === "3m" ? 3 : preset === "6m" ? 6 : preset === "12m" ? 12 : 1;
  const first = addMonths(month, -(months - 1));
  return {
    key: months === 1 ? "mes" : preset,
    from: monthRange(first).from,
    to: monthRange(month).to,
    label: months === 1 ? formatMonthLong(month) : `${formatMonthLong(first)} – ${formatMonthLong(month)}`,
    month,
  };
}

/** Normaliza `searchParams` do Next (valores podem ser arrays). */
export function flattenParams(raw: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) out[key] = Array.isArray(value) ? value[0] : value;
  return out;
}
