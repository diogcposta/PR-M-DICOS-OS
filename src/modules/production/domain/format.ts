/**
 * Formatação partilhada pelas páginas do módulo de produção.
 *
 * Segue a convenção pedida pelo médico — `€8.619`, `€4.309,50`, `66 €/h` — com
 * separadores fixos (`.` milhares, `,` decimais) em vez de `Intl`, para o texto
 * ser idêntico no servidor e no browser (sem avisos de hidratação) e em qualquer
 * locale do sistema. Só apresentação: os cálculos trabalham em cêntimos e minutos.
 */
import type { Ratio } from "@/modules/kpis/domain/ratio";

export const EMPTY = "sem dados";

/** 1234567.891 com 2 casas → "1.234.567,89". */
export function formatNumber(value: number, digits = 0, minDigits = digits): string {
  const factor = 10 ** digits;
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  const [intPart = "0", decPart = ""] = rounded.toFixed(digits).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  let decimals = decPart;
  while (decimals.length > minDigits && decimals.endsWith("0")) decimals = decimals.slice(0, -1);
  const sign = value < 0 && rounded !== 0 ? "-" : "";
  return decimals ? `${sign}${grouped},${decimals}` : `${sign}${grouped}`;
}

/**
 * €8.619 ou €4.309,50 — cêntimos só aparecem quando existem.
 * `round` arredonda ao euro (para cards e gráficos).
 */
export function euros(cents: number | null, options: { round?: boolean } = {}): string {
  if (cents === null || !Number.isFinite(cents)) return EMPTY;
  const value = cents / 100;
  const sign = value < 0 ? "-" : "";
  if (options.round) return `${sign}€${formatNumber(Math.abs(value), 0)}`;
  const hasCents = Math.round(Math.abs(cents)) % 100 !== 0;
  return `${sign}€${formatNumber(Math.abs(value), hasCents ? 2 : 0, hasCents ? 2 : 0)}`;
}

/** "66 €/h" a partir de cêntimos por hora (pode ser fracionário). */
export function eurosPerHour(centsPerHour: number | null, digits = 0): string {
  if (centsPerHour === null || !Number.isFinite(centsPerHour)) return EMPTY;
  return `${formatNumber(centsPerHour / 100, digits, digits)} €/h`;
}

/** Fração → percentagem: 0.125 → "12,5%". */
export function percent(fraction: Ratio | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return EMPTY;
  return `${formatNumber(fraction * 100, digits, digits)}%`;
}

/** Horas a partir de minutos: 7830 → "130,5 h". */
export function hours(minutes: number | null, digits = 1): string {
  if (minutes === null || !Number.isFinite(minutes)) return EMPTY;
  return `${formatNumber(minutes / 60, digits, 0)} h`;
}

/** Duração legível: 135 → "2 h 15 min". */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function integer(value: number | null): string {
  if (value === null) return EMPTY;
  return formatNumber(value, 0);
}

/** Prefixa "+" a valores positivos. */
export function signed(text: string, value: number): string {
  return value > 0 ? `+${text}` : text;
}
