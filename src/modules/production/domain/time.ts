/**
 * Tempo de negócio do módulo de produção.
 *
 * Tudo é registado manualmente pelo médico em Lisboa: datas civis `yyyy-MM-dd`
 * e horas como minutos desde a meia-noite. Não há instantes a converter, por isso
 * este módulo não depende de fusos — só de aritmética de calendário em UTC puro.
 */

export type CivilDate = string;
/** Mês civil `yyyy-MM`. */
export type CivilMonth = string;

export class TimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeError";
  }
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidCivilDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidCivilMonth(value: string): boolean {
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/** "09:30" → 570. */
export function parseTime(value: string): number {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw new TimeError(`Hora inválida: "${value}". Use o formato HH:mm (ex.: 09:30).`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value.trim());
}

/** 570 → "09:30". */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Duração de um intervalo no mesmo dia. Fim anterior ou igual ao início é erro. */
export function durationMinutes(startMinute: number, endMinute: number): number {
  if (endMinute <= startMinute) {
    throw new TimeError("A hora de fim tem de ser posterior à hora de início.");
  }
  return endMinute - startMinute;
}

export interface TimeInterval {
  readonly startMinute: number;
  readonly endMinute: number;
}

/** Intervalos semi-abertos: 10:00–10:45 e 10:45–11:30 não se sobrepõem. */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/** Devolve o primeiro intervalo existente que colide com o candidato, ou `null`. */
export function findOverlap<T extends TimeInterval>(
  candidate: TimeInterval,
  existing: readonly T[],
): T | null {
  return existing.find((interval) => intervalsOverlap(candidate, interval)) ?? null;
}

/** Soma de minutos de uma união de intervalos (sobreposições contadas uma vez). */
export function unionMinutes(intervals: readonly TimeInterval[]): number {
  const sorted = [...intervals].sort((a, b) => a.startMinute - b.startMinute);
  let total = 0;
  let currentStart = -1;
  let currentEnd = -1;
  for (const interval of sorted) {
    if (interval.startMinute >= currentEnd) {
      total += currentEnd - currentStart;
      currentStart = interval.startMinute;
      currentEnd = interval.endMinute;
    } else if (interval.endMinute > currentEnd) {
      currentEnd = interval.endMinute;
    }
  }
  total += currentEnd - currentStart;
  return total;
}

function toUtcDate(date: CivilDate): Date {
  if (!isValidCivilDate(date)) {
    throw new TimeError(`Data inválida: "${date}". Formato esperado: aaaa-mm-dd.`);
  }
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(date: Date): CivilDate {
  return date.toISOString().slice(0, 10);
}

/** Dia da semana ISO: 1 = segunda … 7 = domingo. */
export function isoWeekday(date: CivilDate): number {
  const day = toUtcDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const utc = toUtcDate(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return fromUtcDate(utc);
}

export function daysBetween(from: CivilDate, to: CivilDate): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

export function monthOf(date: CivilDate): CivilMonth {
  return date.slice(0, 7);
}

export function monthRange(month: CivilMonth): { from: CivilDate; to: CivilDate } {
  if (!isValidCivilMonth(month)) {
    throw new TimeError(`Mês inválido: "${month}". Formato esperado: aaaa-mm.`);
  }
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function addMonths(month: CivilMonth, delta: number): CivilMonth {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  const mon = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(mon).padStart(2, "0")}`;
}

/** Lista de meses terminando em `last`, do mais antigo para o mais recente. */
export function monthsEndingAt(last: CivilMonth, count: number): CivilMonth[] {
  return Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
}

export function datesInRange(from: CivilDate, to: CivilDate): CivilDate[] {
  const out: CivilDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatMonthLong(month: CivilMonth): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1] ?? ""} de ${y}`;
}

export function formatMonthShort(month: CivilMonth): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTH_SHORT[m - 1] ?? ""} ${String(y).slice(2)}`;
}

/** "2026-09-03" → "03/09/2026". */
export function formatCivilDate(date: CivilDate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

const WEEKDAY_NAMES = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "";
}

/** Data civil de hoje em Europe/Lisbon. */
export function todayInLisbon(now: Date = new Date()): CivilDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
