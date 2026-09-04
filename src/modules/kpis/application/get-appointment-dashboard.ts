/**
 * Serviço de aplicação do dashboard de agenda.
 *
 * Monta o período, o período anterior equivalente, as contagens, os KPIs, a
 * comparação e a série mensal — e diz explicitamente de que lotes vieram os
 * dados. A página só apresenta o que este serviço devolve.
 */
import {
  type AppointmentStatusCounts,
  type KpiComparison,
  compareAllAppointmentKpis,
} from "@/modules/kpis/domain/appointment-kpis";
import type { AppointmentKpiKey } from "@/modules/kpis/domain/catalog";
import {
  type CivilDate,
  type Period,
  createPeriod,
  previousPeriod,
} from "@/modules/kpis/domain/period";
import {
  type AppointmentFilters,
  type FilterOption,
  type MonthlyPoint,
  countByStatus,
  listFilterOptions,
  monthlyCountsByStatus,
  sourceBatchIds,
} from "@/modules/kpis/infrastructure/appointment-queries";

export interface DashboardQuery {
  readonly organizationId: string;
  readonly fromDate: CivilDate;
  readonly toDate: CivilDate;
  readonly clinicId?: string | undefined;
  readonly practitionerId?: string | undefined;
  readonly timeZone?: string | undefined;
}

export interface AppointmentDashboard {
  readonly period: Period;
  readonly comparisonPeriod: Period;
  readonly counts: AppointmentStatusCounts;
  readonly previousCounts: AppointmentStatusCounts;
  readonly kpis: Record<AppointmentKpiKey, KpiComparison>;
  readonly monthly: readonly MonthlyPoint[];
  readonly clinics: readonly FilterOption[];
  readonly practitioners: readonly FilterOption[];
  /** Verdadeiro quando não há uma única consulta no período filtrado. */
  readonly isEmpty: boolean;
  /** Lotes de importação que originaram os factos do período. */
  readonly sourceBatchIds: readonly string[];
}

export async function getAppointmentDashboard(
  query: DashboardQuery,
): Promise<AppointmentDashboard> {
  const period = createPeriod(query.fromDate, query.toDate, query.timeZone);
  const comparisonPeriod = previousPeriod(period);

  const filters: AppointmentFilters = {
    organizationId: query.organizationId,
    clinicId: query.clinicId,
    practitionerId: query.practitionerId,
  };

  const [counts, previousCounts, monthly, options, batchIds] = await Promise.all([
    countByStatus(filters, period),
    countByStatus(filters, comparisonPeriod),
    monthlyCountsByStatus(filters, period),
    listFilterOptions(query.organizationId),
    sourceBatchIds(filters, period),
  ]);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return {
    period,
    comparisonPeriod,
    counts,
    previousCounts,
    kpis: compareAllAppointmentKpis(counts, previousCounts),
    monthly,
    clinics: options.clinics,
    practitioners: options.practitioners,
    isEmpty: total === 0,
    sourceBatchIds: batchIds,
  };
}
