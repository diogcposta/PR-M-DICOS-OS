/**
 * Rácios e variações.
 *
 * Regra do produto: divisão por zero devolve `null` ("sem dados"), nunca 0%.
 * Uma taxa de faltas de 0% num mês sem consultas seria uma mentira tranquila —
 * exatamente o tipo de número que leva a gestão a decidir mal.
 */

/** Resultado de um rácio: `null` significa "não calculável", não "zero". */
export type Ratio = number | null;

/** Divisão segura. Devolve `null` se o denominador for zero. */
export function safeDivide(numerator: number, denominator: number): Ratio {
  if (denominator === 0) {
    return null;
  }
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  return numerator / denominator;
}

/** Percentagem segura (0–100). Devolve `null` se o denominador for zero. */
export function safePercentage(numerator: number, denominator: number): Ratio {
  const ratio = safeDivide(numerator, denominator);
  return ratio === null ? null : ratio * 100;
}

/**
 * Variação relativa face ao período anterior.
 *
 * Devolve `null` quando a base é zero: passar de 0 para 5 não é "+∞%" nem
 * "+100%"; é uma comparação que não existe e tem de ser apresentada como tal.
 */
export function relativeChange(current: number, previous: number): Ratio {
  return safeDivide(current - previous, Math.abs(previous));
}

/** Formata um rácio como percentagem pt-PT, ou o texto de ausência de dados. */
export function formatRatioAsPercentage(
  ratio: Ratio,
  options: { readonly fractionDigits?: number; readonly emptyLabel?: string } = {},
): string {
  const { fractionDigits = 1, emptyLabel = "sem dados" } = options;
  if (ratio === null) {
    return emptyLabel;
  }
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}
