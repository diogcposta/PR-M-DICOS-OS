import { formatValue, type ValueKind } from "@/components/production/chart-format";
import { TrendChart } from "@/components/production/charts";
import { PeriodPicker } from "@/components/production/PeriodPicker";
import { card, PageTitle } from "@/components/production/ui";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { defaultMonth, monthlySummaries, type MonthlySummary } from "@/modules/production/application/queries";
import { percent } from "@/modules/production/domain/format";
import { compareLast, movingAverage } from "@/modules/production/domain/trends";
import { formatMonthLong, formatMonthShort } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tendências" };

interface Metric {
  readonly key: string;
  readonly name: string;
  readonly kind: ValueKind;
  readonly higherIsBetter: boolean;
  readonly get: (s: MonthlySummary) => number | null;
}

const METRICS: Metric[] = [
  { key: "production", name: "Produção", kind: "euros", higherIsBetter: true, get: (s) => s.productionCents / 100 },
  { key: "fees", name: "Honorários", kind: "euros", higherIsBetter: true, get: (s) => s.feeCents / 100 },
  { key: "cph", name: "€/hora", kind: "eurosPerHour", higherIsBetter: true, get: (s) => (s.centsPerHour === null ? null : s.centsPerHour / 100) },
  { key: "hours", name: "Horas trabalhadas", kind: "hours", higherIsBetter: true, get: (s) => s.clinicalMinutes / 60 },
  { key: "perDay", name: "Produção por dia", kind: "euros", higherIsBetter: true, get: (s) => (s.productionPerDayCents === null ? null : s.productionPerDayCents / 100) },
  { key: "noShows", name: "Faltas", kind: "count", higherIsBetter: false, get: (s) => s.absences.missedCount },
  { key: "lost", name: "Receita perdida (faltas)", kind: "euros", higherIsBetter: false, get: (s) => s.absences.netLostCents / 100 },
  { key: "plans", name: "Planos apresentados", kind: "count", higherIsBetter: true, get: (s) => s.plans.presentedCount },
  { key: "acceptance", name: "Taxa de aceitação", kind: "percent", higherIsBetter: true, get: (s) => s.plans.acceptanceRateByValue },
  { key: "avgCase", name: "Valor médio por caso", kind: "euros", higherIsBetter: true, get: (s) => (s.avgCaseValueCents === null ? null : s.avgCaseValueCents / 100) },
];

export default async function TrendsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod(flattenParams(await searchParams), await defaultMonth());
  const summaries = await monthlySummaries(period.month, 12);
  const labels = summaries.map((s) => formatMonthShort(s.month));

  return (
    <div className="space-y-8">
      <PageTitle
        title="Tendências"
        description={`12 meses até ${formatMonthLong(period.month)}. Mês atual vs anterior e média móvel de 3 meses (tracejado). Meses sem registos aparecem como sem dados.`}
        actions={<PeriodPicker period={period} presets={false} />}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {METRICS.map((m) => {
          // Meses sem registos ficam "sem dados", nunca zero.
          const values = summaries.map((s) => (s.workedDays > 0 || s.procedureCount > 0 ? m.get(s) : null));
          const avg = movingAverage(values);
          const c = compareLast(values);
          const good = c.change === null ? null : c.change > 0 === m.higherIsBetter;
          return (
            <section key={m.key} className={`${card} p-4`} aria-label={m.name} data-testid={`trend-${m.key}`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">{m.name}</h2>
                {c.change !== null ? (
                  <span className={`text-xs font-medium tabular-nums ${good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {c.change > 0 ? "▲ +" : "▼ "}{percent(c.change, 0)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatValue(c.current, m.kind)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                anterior {formatValue(c.previous, m.kind)} · média 3m {formatValue(c.movingAverage, m.kind)}
              </p>
              <div className="mt-3">
                <TrendChart name={m.name} kind={m.kind} data={labels.map((label, i) => ({ label, value: values[i] ?? null, average: avg[i] ?? null }))} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
