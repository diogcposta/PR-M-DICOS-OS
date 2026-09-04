/**
 * Normalização de valores vindos de exportações portuguesas.
 *
 * Princípio que atravessa este ficheiro: **nunca corrigir silenciosamente**.
 * Um valor ambíguo devolve um erro identificado, para o gestor decidir — não um
 * palpite que entra na base e aparece depois num KPI sem rasto.
 */
import { TZDate } from "@date-fns/tz";

import { BUSINESS_TIME_ZONE } from "@/modules/kpis/domain/period";

/** Resultado de uma normalização: ou o valor, ou o motivo da recusa. */
export type NormalizeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

function fail<T>(code: string, message: string): NormalizeResult<T> {
  return { ok: false, code, message };
}

function succeed<T>(value: T): NormalizeResult<T> {
  return { ok: true, value };
}

/** Remove espaços e trata células vazias como ausentes. */
export function normalizeText(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const text = String(raw).trim();
  return text.length === 0 ? null : text;
}

const DATE_ONLY = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const DATE_TIME = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const ISO_LIKE = /^(\d{4})-(\d{2})-(\d{2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;

/**
 * Converte uma data portuguesa (`dd/MM/yyyy`, com hora opcional) no instante UTC
 * correspondente em `Europe/Lisbon`.
 *
 * Aceita também o formato ISO, porque o Excel devolve datas já como objetos
 * `Date` e as folhas exportadas variam. Não aceita `MM/dd/yyyy`: `03/04/2025` é
 * sempre 3 de abril, nunca 4 de março — a ambiguidade seria invisível e
 * silenciosamente errada.
 */
export function normalizePortugueseDate(
  raw: unknown,
  timeZone = BUSINESS_TIME_ZONE,
): NormalizeResult<Date> {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      return fail("DATE_INVALID", "Data inválida.");
    }
    return succeed(raw);
  }

  const text = normalizeText(raw);
  if (text === null) {
    return fail("DATE_MISSING", "Data em falta.");
  }

  let year: number;
  let month: number;
  let day: number;
  let hour = 0;
  let minute = 0;
  let second = 0;

  const dateTime = DATE_TIME.exec(text);
  const dateOnly = DATE_ONLY.exec(text);
  const isoLike = ISO_LIKE.exec(text);

  if (dateTime) {
    [day, month, year, hour, minute] = [
      Number(dateTime[1]),
      Number(dateTime[2]),
      Number(dateTime[3]),
      Number(dateTime[4]),
      Number(dateTime[5]),
    ];
    second = dateTime[6] === undefined ? 0 : Number(dateTime[6]);
  } else if (dateOnly) {
    [day, month, year] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
  } else if (isoLike) {
    [year, month, day] = [Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3])];
    hour = isoLike[4] === undefined ? 0 : Number(isoLike[4]);
    minute = isoLike[5] === undefined ? 0 : Number(isoLike[5]);
    second = isoLike[6] === undefined ? 0 : Number(isoLike[6]);
  } else {
    return fail(
      "DATE_FORMAT_INVALID",
      `Formato de data não reconhecido: "${text}". Esperado dd/MM/yyyy, com hora opcional.`,
    );
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return fail("DATE_OUT_OF_RANGE", `Data fora do calendário: "${text}".`);
  }

  const zoned = new TZDate(year, month - 1, day, hour, minute, second, 0, timeZone);
  const instant = new Date(zoned.getTime());

  if (Number.isNaN(instant.getTime())) {
    return fail("DATE_INVALID", `Data inválida: "${text}".`);
  }

  // O construtor normaliza excessos (31/02 vira 03/03). Isso é uma correção
  // silenciosa: recusamos, em vez de gravar um dia que o ficheiro não continha.
  if (zoned.getFullYear() !== year || zoned.getMonth() !== month - 1 || zoned.getDate() !== day) {
    return fail("DATE_OUT_OF_RANGE", `Data inexistente no calendário: "${text}".`);
  }

  return succeed(instant);
}

/**
 * Converte um número escrito à portuguesa (`1.234,56`) para cêntimos.
 *
 * A ambiguidade real está em valores como `1.234`: pode ser mil duzentos e
 * trinta e quatro, ou 1,234. Recusamos esse caso em vez de adivinhar.
 */
export function normalizeDecimalToCents(raw: unknown): NormalizeResult<number> {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      return fail("AMOUNT_INVALID", "Montante inválido.");
    }
    return succeed(Math.sign(raw) * Math.round(Math.abs(Number((raw * 100).toPrecision(12)))));
  }

  const text = normalizeText(raw);
  if (text === null) {
    return fail("AMOUNT_MISSING", "Montante em falta.");
  }

  const cleaned = text.replace(/[\s€]/g, "");
  if (!/^-?[\d.,]+$/.test(cleaned)) {
    return fail("AMOUNT_FORMAT_INVALID", `Montante não numérico: "${text}".`);
  }

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let canonical: string;

  if (hasComma && hasDot) {
    // Formato português completo: ponto como milhares, vírgula como decimal.
    if (cleaned.lastIndexOf(",") < cleaned.lastIndexOf(".")) {
      return fail("AMOUNT_AMBIGUOUS", `Separadores ambíguos em "${text}".`);
    }
    canonical = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    canonical = cleaned.replace(",", ".");
  } else if (hasDot) {
    const decimals = cleaned.length - cleaned.lastIndexOf(".") - 1;
    // Exatamente 3 casas depois do ponto é indistinguível de separador de
    // milhares. Não adivinhamos qual é.
    if (decimals === 3) {
      return fail(
        "AMOUNT_AMBIGUOUS",
        `"${text}" tanto pode ser separador de milhares como decimal. Corrija a exportação.`,
      );
    }
    canonical = cleaned;
  } else {
    canonical = cleaned;
  }

  const value = Number(canonical);
  if (!Number.isFinite(value)) {
    return fail("AMOUNT_FORMAT_INVALID", `Montante não numérico: "${text}".`);
  }

  return succeed(Math.sign(value) * Math.round(Math.abs(Number((value * 100).toPrecision(12)))));
}

/** Normaliza um rótulo para comparação: minúsculas, sem acentos e sem espaços extra. */
export function normalizeLabel(raw: unknown): string | null {
  const text = normalizeText(raw);
  if (text === null) {
    return null;
  }
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}
