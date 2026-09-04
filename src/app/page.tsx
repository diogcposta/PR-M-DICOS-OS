import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentOrganization } from "@/modules/organizations/application/get-current-organization";
import { getDashboardSummary } from "@/modules/kpis/application/get-dashboard-summary";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          description="Indicadores por período, clínica e médico, com comparação com o período anterior."
        />
        <EmptyState
          title="Nenhuma organização configurada"
          description="A base de dados está vazia. Execute `npm run db:seed` para criar a organização sintética de desenvolvimento."
        />
      </div>
    );
  }

  const summary = await getDashboardSummary(organization.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`${organization.name} — indicadores por período, clínica e médico. Fuso de negócio: ${organization.timezone}.`}
      />

      <section aria-labelledby="filtros" className="space-y-3">
        <h2 id="filtros" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Filtros
        </h2>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Badge tone="pending">Por implementar</Badge>
          <span>
            Período, clínica e médico entram na Fase 3, quando houver KPIs calculáveis para filtrar.
          </span>
        </div>
      </section>

      <section aria-labelledby="indicadores" className="space-y-3">
        <h2 id="indicadores" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Indicadores
        </h2>
        <EmptyState
          title="Ainda não existem dados importados"
          description={`Nenhum lote foi confirmado nesta organização, por isso não há nada para calcular. Os ${summary.catalogueSize} KPIs do catálogo continuam com a definição por confirmar e não devem produzir números até essa validação. Nada é simulado neste ecrã.`}
        />
      </section>

      <section aria-labelledby="estado" className="space-y-3">
        <h2 id="estado" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Estado da instalação
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Lotes confirmados">
            <p className="text-2xl font-semibold tabular-nums">{summary.committedBatches}</p>
          </Card>
          <Card title="Factos de agenda">
            <p className="text-2xl font-semibold tabular-nums">{summary.appointmentFacts}</p>
          </Card>
          <Card title="Clínicas">
            <p className="text-2xl font-semibold tabular-nums">{summary.clinics}</p>
          </Card>
          <Card title="Médicos">
            <p className="text-2xl font-semibold tabular-nums">{summary.practitioners}</p>
          </Card>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Estas contagens descrevem o estado da base de dados, não são KPIs de negócio.
        </p>
      </section>
    </div>
  );
}
