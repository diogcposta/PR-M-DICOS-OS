/**
 * Dinheiro em cêntimos inteiros.
 *
 * Regra do produto: nunca representar montantes em vírgula flutuante. Todas as
 * somas acontecem em inteiros e só a formatação final converte para euros.
 */

/** Montante monetário em cêntimos. Pode ser negativo (reversões, notas de crédito). */
export type Cents = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Garante que um valor é um montante válido em cêntimos. */
export function assertCents(value: number): asserts value is Cents {
  if (!Number.isInteger(value)) {
    throw new MoneyError(
      `Montante em cêntimos tem de ser inteiro; recebido ${String(value)}.`,
    );
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError("Montante em cêntimos fora do intervalo seguro.");
  }
}

/**
 * Converte euros para cêntimos.
 *
 * Aceita o número tal como veio da fonte e arredonda para o cêntimo mais
 * próximo — a alternativa (truncar) perderia sistematicamente valor. O
 * arredondamento é feito uma única vez, aqui, e nunca durante os cálculos.
 */
export function eurosToCents(euros: number): Cents {
  if (!Number.isFinite(euros)) {
    throw new MoneyError("Valor em euros tem de ser um número finito.");
  }
  // `euros * 100` arrasta o erro de representação binária: 1.005 * 100 dá
  // 100.49999999999999, que arredondaria para baixo. Normalizar a 12 dígitos
  // significativos descarta esse ruído sem afetar montantes reais — nenhum valor
  // monetário legítimo depende do 13.º dígito.
  const scaled = Number((euros * 100).toPrecision(12));
  // Meio cêntimo arredonda para longe do zero, para que +0,005 e -0,005 sejam
  // tratados de forma simétrica (Math.round(-0.5) daria -0).
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  const result = rounded === 0 ? 0 : rounded;
  assertCents(result);
  return result;
}

/** Converte cêntimos para euros. Usar apenas para apresentação. */
export function centsToEuros(cents: Cents): number {
  assertCents(cents);
  return cents / 100;
}

/** Soma montantes em cêntimos sem perda de precisão. */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const value of values) {
    assertCents(value);
    total += value;
  }
  assertCents(total);
  return total;
}

/** Formata um montante em cêntimos como moeda pt-PT. */
export function formatCents(cents: Cents, currency = "EUR"): string {
  assertCents(cents);
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
  }).format(centsToEuros(cents));
}
