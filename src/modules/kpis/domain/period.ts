/**
 * Períodos de análise.
 *
 * Os factos são guardados como instantes UTC, mas o gestor raciocina em dias
 * civis de `Europe/Lisbon`. Este módulo é a única fronteira onde a conversão
 * acontece — e é por isso que tem testes de DST.
 *
 * Convenção: intervalo semi-aberto `[startsAt, endsAt)`. Um facto exatamente à
 * meia-noite do dia seguinte pertence ao período seguinte, nunca aos dois.
 */
import { TZDate } from "@date-fns/tz";

export const BUSINESS_TIME_ZONE = "Europe/Lisbon";

/** Data civil no formato `yyyy-MM-dd`, sem hora e sem fuso. */
export type CivilDate = string;

export interface Period {
  /** Primeiro dia civil incluído. */
  readonly fromDate: CivilDate;
  /** Último dia civil incluído. */
  readonly toDate: CivilDate;
  /** Início do intervalo, inclusivo, em UTC. */
  readonly startsAt: Date;
  /** Fim do intervalo, exclusivo, em UTC. */
  readonly endsAt: Date;
  readonly timeZone: string;
}

export class PeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodError";
  }
}

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseCivilDate(value: CivilDate): { year: number; month: number; day: number } {
  if (!CIVIL_DATE_PATTERN.test(value)) {
    throw new PeriodError(`Data inválida: "${value}". Formato esperado: yyyy-MM-dd.`);
  }
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new PeriodError(`Data inexistente no calendário: "${value}".`);
  }
  return { year, month, day };
}

function formatCivilDate(year: number, month: number, day: number): CivilDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Instante UTC correspondente ao início do dia civil no fuso de negócio. */
export function startOfBusinessDay(date: CivilDate, timeZone = BUSINESS_TIME_ZONE): Date {
  const { year, month, day } = parseCivilDate(date);
  const zoned = new TZDate(year, month - 1, day, 0, 0, 0, 0, timeZone);
  const instant = new Date(zoned.getTime());
  if (Number.isNaN(instant.getTime())) {
    throw new PeriodError(`Data inexistente no calendário: "${date}".`);
  }
  return instant;
}

function addCivilDays(date: CivilDate, days: number): CivilDate {
  const { year, month, day } = parseCivilDate(date);
  // UTC puro: aritmética de calendário sem interferência de fuso.
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatCivilDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

/** Número de dias civis abrangidos pelo período, inclusive. */
export function periodLengthInDays(period: Period): number {
  const start = Date.UTC(...civilParts(period.fromDate));
  const end = Date.UTC(...civilParts(period.toDate));
  return Math.round((end - start) / 86_400_000) + 1;
}

function civilParts(date: CivilDate): [number, number, number] {
  const { year, month, day } = parseCivilDate(date);
  return [year, month - 1, day];
}

/** Constrói um período a partir de duas datas civis inclusivas. */
export function createPeriod(
  fromDate: CivilDate,
  toDate: CivilDate,
  timeZone = BUSINESS_TIME_ZONE,
): Period {
  const startsAt = startOfBusinessDay(fromDate, timeZone);
  // Fim exclusivo: início do dia seguinte ao último dia incluído.
  const endsAt = startOfBusinessDay(addCivilDays(toDate, 1), timeZone);

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new PeriodError(
      `Período inválido: a data final (${toDate}) é anterior à inicial (${fromDate}).`,
    );
  }

  return { fromDate, toDate, startsAt, endsAt, timeZone };
}

/**
 * Período anterior de duração equivalente, imediatamente contíguo.
 *
 * Conta-se em dias civis, não em milissegundos: um período de 31 dias que
 * atravesse a mudança de hora continua a comparar com 31 dias, e não com
 * "31 dias menos uma hora".
 */
export function previousPeriod(period: Period): Period {
  const lengthInDays = periodLengthInDays(period);
  const previousTo = addCivilDays(period.fromDate, -1);
  const previousFrom = addCivilDays(previousTo, -(lengthInDays - 1));
  return createPeriod(previousFrom, previousTo, period.timeZone);
}

/** Verifica se um instante pertence ao período (início inclusivo, fim exclusivo). */
export function containsInstant(period: Period, instant: Date): boolean {
  const time = instant.getTime();
  return time >= period.startsAt.getTime() && time < period.endsAt.getTime();
}
