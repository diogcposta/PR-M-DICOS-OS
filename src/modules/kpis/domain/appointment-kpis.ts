/**
 * Cálculo dos KPIs de agenda.
 *
 * Função pura: recebe contagens por estado e devolve resultados com numerador,
 * denominador e versão da definição. Não sabe o que é uma base de dados — o que
 * a torna trivial de testar e impossível de tornar não determinística.
 *
 * Nenhum número aqui é estimado, ordenado ou explicado por IA.
 */
import {
  type AppointmentKpiKey,
  type KpiUnit,
  findKpiDefinition,
} from "@/modules/kpis/domain/catalog";
import { safeDivide, type Ratio } from "@/modules/kpis/domain/ratio";

/** Contagens por estado normalizado, para um período e conjunto de filtros. */
export interface AppointmentStatusCounts {
  readonly SCHEDULED: number;
  readonly COMPLETED: number;
  readonly NO_SHOW: number;
  readonly CANCELLED: number;
  readonly RESCHEDULED: number;
  readonly UNKNOWN: number;
}

export const EMPTY_STATUS_COUNTS: AppointmentStatusCounts = {
  SCHEDULED: 0,
  COMPLETED: 0,
  NO_SHOW: 0,
  CANCELLED: 0,
  RESCHEDULED: 0,
  UNKNOWN: 0,
};

export interface KpiValue {
  readonly key: AppointmentKpiKey;
  readonly name: string;
  readonly unit: KpiUnit;
  /**
   * Valor do KPI. `null` significa "sem dados" — nunca zero por conveniência.
   * Para percentagens, está na escala 0–100.
   */
  readonly value: number | null;
  /** Numerador usado, para o ecrã poder explicar o número. */
  readonly numerator: number;
  /** Denominador usado. `null` nas contagens, que não têm denominador. */
  readonly denominator: number | null;
  readonly definitionVersion: number;
}

export interface KpiComparison {
  readonly current: KpiValue;
  readonly previous: KpiValue;
  /**
   * Variação face ao período anterior.
   * - contagens: variação relativa (0,2 = +20%);
   * - percentagens: diferença em pontos percentuais.
   * `null` quando a comparação não é calculável.
   */
  readonly change: Ratio;
  readonly changeKind: "RELATIVE" | "PERCENTAGE_POINTS";
}

/**
 * Total de consultas marcadas no período.
 * As remarcadas ficam de fora: a consulta conta na data para onde foi movida,
 * e contá-la nas duas inflacionaria o total.
 */
export function totalBooked(counts: AppointmentStatusCounts): number {
  return counts.SCHEDULED + counts.COMPLETED + counts.NO_SHOW + counts.CANCELLED + counts.UNKNOWN;
}

/**
 * Denominador das taxas (D-019): consultas cujo desfecho já é conhecido.
 *
 * As que ainda estão por acontecer não entram — de outro modo, olhar para o mês
 * corrente a meio do mês mostraria uma taxa de realização baixíssima só porque
 * metade das consultas ainda não aconteceu.
 */
export function resolvedAppointments(counts: AppointmentStatusCounts): number {
  return counts.COMPLETED + counts.NO_SHOW + counts.CANCELLED;
}

function buildValue(
  key: AppointmentKpiKey,
  numerator: number,
  denominator: number | null,
): KpiValue {
  const definition = findKpiDefinition(key);
  if (!definition) {
    throw new Error(`KPI desconhecido: ${key}`);
  }

  const value =
    denominator === null
      ? numerator
      : (() => {
          const ratio = safeDivide(numerator, denominator);
          return ratio === null ? null : ratio * 100;
        })();

  return {
    key,
    name: definition.name,
    unit: definition.unit,
    value,
    numerator,
    denominator,
    definitionVersion: definition.definitionVersion,
  };
}

/** Calcula todos os KPIs de agenda a partir das contagens por estado. */
export function calculateAppointmentKpis(
  counts: AppointmentStatusCounts,
): Record<AppointmentKpiKey, KpiValue> {
  const resolved = resolvedAppointments(counts);

  return {
    appointments_scheduled: buildValue("appointments_scheduled", totalBooked(counts), null),
    appointments_completed: buildValue("appointments_completed", counts.COMPLETED, null),
    no_show_count: buildValue("no_show_count", counts.NO_SHOW, null),
    completion_rate: buildValue("completion_rate", counts.COMPLETED, resolved),
    no_show_rate: buildValue("no_show_rate", counts.NO_SHOW, resolved),
    cancellation_rate: buildValue("cancellation_rate", counts.CANCELLED, resolved),
  };
}

/**
 * Compara um KPI com o período anterior.
 *
 * Percentagens comparam-se em pontos percentuais: dizer que uma taxa de faltas
 * "subiu 50%" quando passou de 10% para 15% é ambíguo e engana. Contagens
 * comparam-se em variação relativa.
 */
export function compareKpi(current: KpiValue, previous: KpiValue): KpiComparison {
  const changeKind = current.unit === "PERCENTAGE" ? "PERCENTAGE_POINTS" : "RELATIVE";

  let change: Ratio = null;
  if (current.value !== null && previous.value !== null) {
    change =
      changeKind === "PERCENTAGE_POINTS"
        ? current.value - previous.value
        : safeDivide(current.value - previous.value, Math.abs(previous.value));
  }

  return { current, previous, change, changeKind };
}

export function compareAllAppointmentKpis(
  current: AppointmentStatusCounts,
  previous: AppointmentStatusCounts,
): Record<AppointmentKpiKey, KpiComparison> {
  const currentValues = calculateAppointmentKpis(current);
  const previousValues = calculateAppointmentKpis(previous);

  return {
    appointments_scheduled: compareKpi(
      currentValues.appointments_scheduled,
      previousValues.appointments_scheduled,
    ),
    appointments_completed: compareKpi(
      currentValues.appointments_completed,
      previousValues.appointments_completed,
    ),
    completion_rate: compareKpi(currentValues.completion_rate, previousValues.completion_rate),
    no_show_count: compareKpi(currentValues.no_show_count, previousValues.no_show_count),
    no_show_rate: compareKpi(currentValues.no_show_rate, previousValues.no_show_rate),
    cancellation_rate: compareKpi(
      currentValues.cancellation_rate,
      previousValues.cancellation_rate,
    ),
  };
}
