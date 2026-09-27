/**
 * Conversão de texto introduzido pelo utilizador (formato português) para os
 * tipos canónicos: cêntimos, pontos-base e minutos.
 */
import { eurosToCents } from "@/modules/kpis/domain/money";

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

/**
 * "1.234,56" | "1234,56" | "1234.56" | "600" | "€ 600" → cêntimos.
 * Com vírgula, o ponto é separador de milhares. Sem vírgula, um ponto seguido de
 * exatamente 3 dígitos é milhares ("1.500" = 1500 €); caso contrário é decimal.
 */
export function parseEuros(raw: string): number {
  const text = raw.replace(/[€\s ]/g, "");
  if (text === "") throw new InputError("Valor em falta.");
  let normalised: string;
  if (text.includes(",")) {
    normalised = text.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    normalised = text.replace(/\./g, "");
  } else {
    normalised = text;
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalised)) {
    throw new InputError(`Valor inválido: "${raw}". Use, por exemplo, 600 ou 1.234,50.`);
  }
  return eurosToCents(Number(normalised));
}

/** "50" | "50%" | "12,5" → pontos-base (5000, 1250). */
export function parsePercentToBps(raw: string): number {
  const text = raw.replace(/[%\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new InputError(`Percentagem inválida: "${raw}".`);
  }
  const value = Math.round(Number(text) * 100);
  if (value > 10_000) throw new InputError("A percentagem não pode ser superior a 100%.");
  return value;
}

/** Cêntimos → texto editável ("1234,5" → "1234,50"). */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? `${sign}${whole}` : `${sign}${whole},${String(rest).padStart(2, "0")}`;
}

export function bpsToInput(bps: number): string {
  return centsToInput(bps);
}

/** Texto livre sem dados identificáveis: recusa emails e números de telefone. */
export function assertNoPersonalData(text: string, field: string): void {
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) {
    throw new InputError(`${field}: não escreva emails. Use apenas o Case ID.`);
  }
  if (/(\+?351)?\s?[29]\d{2}\s?\d{3}\s?\d{3}/.test(text)) {
    throw new InputError(`${field}: parece conter um número de telefone ou de utente. Use apenas o Case ID.`);
  }
}
