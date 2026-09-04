import Link from "next/link";

import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MonthlyAppointmentsChart } from "@/components/dashboard/MonthlyAppointmentsChart";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppointmentDashboard } from "@/modules/kpis/application/get-appointment-dashboard";
import {
  formatPeriodLabel,
  parseDashboardFilters,
} from "@/modules/kpis/application/parse-dashboard-filters";
import { APPOINTMENT_KPI_KEYS, findKpiDefinition } from "@/modules/kpis/domain/catalog";
import { getCurrentOrganization } from "@/modules/organizations/application/get-current-organization";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" description="Indicadores de agenda por período, clínica e médico." />
        <EmptyState
          title="Nenhuma organização configurada"
          description="A base de dados está vazia. Execute `npm run db:seed` para criar a organização sintética de desenvolvimento."
        />
      </div>
    );
  }

  const rawParams = await searchParams;
  const flatParams: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    flatParams[key] = Array.isArray(value) ? value[0] : value;
  }

  const filters = parseDashboardFilters(flatParams, new Date(), organization.timezone);
  const dashboard = await getAppointmentDashboard({
    organizationId: organization.id,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    clinicId: filters.clinicId,
    practitionerId: filters.practitionerId,
    timeZone: organization.timezone,
  });

  const periodLabel = formatPeriodLabel(filters.fromDate, filters.toDate);
  const previousLabel = formatPeriodLabel(
    dashboard.comparisonPeriod.fromDate,
    dashboard.comparisonPeriod.toDate,
  );

  const chartPoints = dashboard.monthly.map((point) => ({
    month: point.month,
    completed: point.counts.COMPLETED,
    noShow: point.counts.NO_SHOW,
    cancelled: point.counts.CANCELLED,
    scheduled: point.counts.SCHEDULED + point.counts.UNKNOWN,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`${organization.name} — indicadores de agenda. Período em ${organization.timezone}.`}
      />

      {dashboard.isSynthetic ? (
        <p
          data-testid="synthetic-data-banner"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <Badge tone="pending">Dados sintéticos</Badge>
          Estes números vêm de um conjunto gerado para demonstração — nenhuma exportação real do
          Newsoft foi ainda importada.{" "}
          <Link href="/qualidade" className="underline underline-offset-4">
            Ver origem dos dados
          </Link>
          .
        </p>
      ) : null}

      <section aria-labelledby="filtros" className="space-y-3">
        <h2 id="filtros" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Filtros
        </h2>
        <DashboardFilters
          fromDate={filters.fromDate}
          toDate={filters.toDate}
          clinicId={filters.clinicId}
          practitionerId={filters.practitionerId}
          clinics={dashboard.clinics}
          practitioners={dashboard.practitioners}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="period-summary">
          A mostrar <strong>{periodLabel}</strong>, comparado com <strong>{previousLabel}</strong>{" "}
          (período anterior de igual duração).
        </p>
      </section>

      {dashboard.isEmpty ? (
        <EmptyState
          title="Sem consultas no período selecionado"
          description="Não há factos de agenda para estes filtros, por isso não é apresentado nenhum indicador. Alargue o período, limpe os filtros ou importe uma exportação de agenda."
          action={
            <Link href="/imports/new" className="text-sm underline underline-offset-4">
              Importar ficheiro
            </Link>
          }
        />
      ) : (
        <>
          <section aria-labelledby="indicadores" className="space-y-3">
            <h2 id="indicadores" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Indicadores
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {APPOINTMENT_KPI_KEYS.map((key) => {
                const definition = findKpiDefinition(key);
                if (!definition) return null;
                return (
                  <KpiCard
                    key={key}
                    comparison={dashboard.kpis[key]}
                    definition={definition}
                    provenance={dashboard.provenance[key]}
                    periodLabel={periodLabel}
                    previousPeriodLabel={previousLabel}
                  />
                );
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              As definições são provisórias: as fórmulas estão fixadas e testadas, mas ainda não
              foram validadas com o responsável de negócio. Abra &quot;Como é calculado?&quot; em
              cada cartão.
            </p>
          </section>

          {chartPoints.length > 0 ? (
            <section aria-labelledby="evolucao" className="space-y-3">
              <h2 id="evolucao" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Evolução mensal
              </h2>
              <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <MonthlyAppointmentsChart points={chartPoints} />
              </div>
            </section>
          ) : null}

          <section aria-labelledby="resumo" className="space-y-3">
            <h2 id="resumo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Resumo por mês
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm" data-testid="monthly-table">
                <caption className="sr-only">
                  Consultas por mês e desfecho, com os valores exatos do gráfico
                </caption>
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Mês</th>
                    <th scope="col" className="px-4 py-3 font-medium">Realizadas</th>
                    <th scope="col" className="px-4 py-3 font-medium">Faltas</th>
                    <th scope="col" className="px-4 py-3 font-medium">Canceladas</th>
                    <th scope="col" className="px-4 py-3 font-medium">Por realizar</th>
                    <th scope="col" className="px-4 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {chartPoints.map((point) => (
                    <tr key={point.month}>
                      <th scope="row" className="px-4 py-3 font-normal">{point.month}</th>
                      <td className="px-4 py-3 tabular-nums">{point.completed}</td>
                      <td className="px-4 py-3 tabular-nums">{point.noShow}</td>
                      <td className="px-4 py-3 tabular-nums">{point.cancelled}</td>
                      <td className="px-4 py-3 tabular-nums">{point.scheduled}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {point.completed + point.noShow + point.cancelled + point.scheduled}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dados de {dashboard.batches.length}{" "}
              {dashboard.batches.length === 1 ? "lote importado" : "lotes importados"}. As
              consultas remarcadas não entram em nenhum total: contam na data para onde foram
              movidas.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
