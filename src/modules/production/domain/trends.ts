/** Séries mensais: variação face ao mês anterior e média móvel de 3 meses. */
import { relativeChange, type Ratio } from "@/modules/kpis/domain/ratio";

/** Média móvel simples; posições sem 3 valores válidos ficam `null`. */
export function movingAverage(values: readonly (number | null)[], window = 3): (number | null)[] {
  return values.map((_, i) => {
    if (i + 1 < window) return null;
    const slice = values.slice(i + 1 - window, i + 1);
    if (slice.some((v) => v === null)) return null;
    return (slice as number[]).reduce((s, v) => s + v, 0) / window;
  });
}

export interface SeriesComparison {
  readonly current: number | null;
  readonly previous: number | null;
  readonly change: Ratio;
  readonly movingAverage: number | null;
}

export function compareLast(values: readonly (number | null)[]): SeriesComparison {
  const current = values.at(-1) ?? null;
  const previous = values.at(-2) ?? null;
  return {
    current,
    previous,
    change: current === null || previous === null ? null : relativeChange(current, previous),
    movingAverage: movingAverage(values).at(-1) ?? null,
  };
}
