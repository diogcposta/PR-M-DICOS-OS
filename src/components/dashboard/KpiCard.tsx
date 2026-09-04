import { Badge } from "@/components/ui/Badge";
import type { KpiComparison } from "@/modules/kpis/domain/appointment-kpis";
import type { KpiDefinition } from "@/modules/kpis/domain/catalog";
import { formatRatioAsPercentage } from "@/modules/kpis/domain/ratio";

function formatValue(value: number | null, unit: string): string {
  if (value === null) {
    return "sem dados";
  }
  if (unit === "PERCENTAGE") {
    return `${formatRatioAsPercentage(value)} %`;
  }
  return new Intl.NumberFormat("pt-PT").format(value);
}

/**
 * Variação face ao período anterior.
 *
 * Percentagens variam em pontos percentuais; contagens em percentagem. Dizer que
 * uma taxa de faltas "subiu 50%" quando passou de 10% para 15% seria ambíguo.
 */
function formatChange(comparison: KpiComparison): string | null {
  if (comparison.change === null) {
    return null;
  }
  const sign = comparison.change > 0 ? "+" : "";
  if (comparison.changeKind === "PERCENTAGE_POINTS") {
    return `${sign}${formatRatioAsPercentage(comparison.change)} p.p.`;
  }
  return `${sign}${formatRatioAsPercentage(comparison.change * 100)} %`;
}

export function KpiCard({
  comparison,
  definition,
  periodLabel,
  previousPeriodLabel,
}: {
  readonly comparison: KpiComparison;
  readonly definition: KpiDefinition;
  readonly periodLabel: string;
  readonly previousPeriodLabel: string;
}) {
  const { current, previous } = comparison;
  const change = formatChange(comparison);

  return (
    <section
      data-testid={`kpi-${current.key}`}
      className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{current.name}</h3>

      <p
        data-testid={`kpi-${current.key}-value`}
        className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100"
      >
        {formatValue(current.value, current.unit)}
      </p>

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {change === null ? (
          // Sem base de comparação não inventamos uma seta nem um 0%.
          <>Sem comparação possível com {previousPeriodLabel}</>
        ) : (
          <>
            <span data-testid={`kpi-${current.key}-change`} className="tabular-nums">
              {change}
            </span>{" "}
            face a {previousPeriodLabel} ({formatValue(previous.value, previous.unit)})
          </>
        )}
      </p>

      <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:underline dark:text-slate-400">
          Como é calculado?
        </summary>

        <dl className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
          <div>
            <dt className="font-medium text-slate-700 dark:text-slate-300">Fórmula</dt>
            <dd className="mt-0.5 font-mono">{definition.formula}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700 dark:text-slate-300">Numerador</dt>
            <dd className="mt-0.5 tabular-nums">
              {current.numerator} ({periodLabel})
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700 dark:text-slate-300">Denominador</dt>
            <dd className="mt-0.5 tabular-nums">
              {current.denominator === null ? (
                "não aplicável — é uma contagem"
              ) : current.denominator === 0 ? (
                <>0 — sem consultas com desfecho conhecido, por isso não há taxa a apresentar</>
              ) : (
                current.denominator
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700 dark:text-slate-300">Fontes</dt>
            <dd className="mt-0.5">{definition.sources.join(", ")}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700 dark:text-slate-300">Versão da definição</dt>
            <dd className="mt-0.5">v{current.definitionVersion}</dd>
          </div>
          {definition.definitionApproved ? null : (
            <div className="pt-1">
              <Badge tone="pending">Definição provisória</Badge>
              <p className="mt-1.5">{definition.openQuestion}</p>
            </div>
          )}
        </dl>
      </details>
    </section>
  );
}
