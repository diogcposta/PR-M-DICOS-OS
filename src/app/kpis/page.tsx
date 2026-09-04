import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { getKpiCatalog } from "@/modules/kpis/application/get-kpi-catalog";

const UNIT_LABELS: Record<string, string> = {
  COUNT: "contagem",
  PERCENTAGE: "percentagem",
  CURRENCY_CENTS: "montante (cêntimos)",
};

export default function KpiCatalogPage() {
  const { definitions, activeCount, pendingCount } = getKpiCatalog();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Catálogo de KPIs"
        description="Cada indicador tem chave, fórmula, unidade, fontes e versão da definição. Um KPI só passa a produzir números depois de a definição ser confirmada com uma exportação real e com o responsável de negócio."
      />

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {activeCount} {activeCount === 1 ? "indicador ativo" : "indicadores ativos"} ·{" "}
        {pendingCount} com definição por confirmar.
      </p>

      <ul className="space-y-4">
        {definitions.map((definition) => (
          <li
            key={definition.key}
            className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {definition.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {definition.key} · v{definition.definitionVersion}
                </p>
              </div>
              <Badge tone={definition.status === "ACTIVE" ? "ready" : "pending"}>
                {definition.status === "ACTIVE" ? "Ativo" : "Definição por confirmar"}
              </Badge>
            </div>

            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
              {definition.description}
            </p>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Fórmula
                </dt>
                <dd className="mt-1 font-mono text-xs text-slate-800 dark:text-slate-200">
                  {definition.formula}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Unidade
                </dt>
                <dd className="mt-1">{UNIT_LABELS[definition.unit] ?? definition.unit}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Fontes
                </dt>
                <dd className="mt-1">{definition.sources.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Filtros suportados
                </dt>
                <dd className="mt-1">{definition.supportedFilters.join(", ")}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Por decidir
                </dt>
                <dd className="mt-1 text-slate-700 dark:text-slate-300">
                  {definition.openQuestion}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
