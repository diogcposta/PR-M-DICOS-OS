/**
 * Interpretação dos filtros vindos do URL.
 *
 * Fica na camada de aplicação e não na página: decidir qual é o período por
 * omissão é uma regra de negócio, não uma questão de apresentação.
 */
import { type CivilDate, BUSINESS_TIME_ZONE } from "@/modules/kpis/domain/period";

export interface DashboardFilterInput {
  readonly fromDate: CivilDate;
  readonly toDate: CivilDate;
  readonly clinicId: string | undefined;
  readonly practitionerId: string | undefined;
}

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Data civil de hoje no fuso de negócio (não no fuso do servidor). */
export function todayInBusinessTimeZone(
  now: Date = new Date(),
  timeZone: string = BUSINESS_TIME_ZONE,
): CivilDate {
  // `en-CA` formata como yyyy-MM-dd, que é exatamente a forma que usamos.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Primeiro dia do mês de uma data civil. */
function startOfMonth(date: CivilDate): CivilDate {
  return `${date.slice(0, 7)}-01`;
}

function readParam(params: URLSearchParams | Record<string, string | undefined>, key: string) {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  return value === null || value === undefined || value === "" ? undefined : value;
}

/**
 * Período por omissão: o mês corrente até hoje.
 *
 * Não usamos "os últimos 30 dias" porque a gestão da clínica raciocina em meses
 * e a comparação com o período anterior fica imediatamente legível.
 */
export function parseDashboardFilters(
  params: URLSearchParams | Record<string, string | undefined>,
  now: Date = new Date(),
  timeZone: string = BUSINESS_TIME_ZONE,
): DashboardFilterInput {
  const today = todayInBusinessTimeZone(now, timeZone);

  const rawFrom = readParam(params, "de");
  const rawTo = readParam(params, "ate");

  let fromDate = rawFrom !== undefined && CIVIL_DATE.test(rawFrom) ? rawFrom : startOfMonth(today);
  let toDate = rawTo !== undefined && CIVIL_DATE.test(rawTo) ? rawTo : today;

  // Datas trocadas são um engano do utilizador, não um erro: corrigimos a ordem
  // em vez de mostrar um ecrã de erro por causa disso.
  if (toDate < fromDate) {
    [fromDate, toDate] = [toDate, fromDate];
  }

  return {
    fromDate,
    toDate,
    clinicId: readParam(params, "clinica"),
    practitionerId: readParam(params, "medico"),
  };
}

/** Rótulo legível de um período, para o ecrã explicar o que está a comparar. */
export function formatPeriodLabel(fromDate: CivilDate, toDate: CivilDate): string {
  const format = (date: CivilDate): string => date.split("-").reverse().join("/");
  return fromDate === toDate ? format(fromDate) : `${format(fromDate)} a ${format(toDate)}`;
}
