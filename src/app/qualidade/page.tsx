import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getDataQualityReport } from "@/modules/imports/application/get-data-quality";
import { getCurrentOrganization } from "@/modules/organizations/application/get-current-organization";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  COMMITTED: "Confirmado",
  DUPLICATE: "Duplicado",
  REJECTED: "Recusado",
  FAILED: "Falhou",
};

function formatDate(value: Date | null): string {
  return value === null ? "—" : value.toISOString().slice(0, 10);
}

export default async function DataQualityPage() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Qualidade dos dados"
          description="O que entrou, o que ficou de fora e que período os dados cobrem."
        />
        <EmptyState
          title="Nenhuma organização configurada"
          description="Execute `npm run db:seed` para criar a organização sintética de desenvolvimento."
        />
      </div>
    );
  }

  const report = await getDataQualityReport(organization.id, organization.timezone);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Qualidade dos dados"
        description="Antes de ler um KPI, vale a pena saber o que entrou, o que ficou de fora e que período os dados cobrem de facto."
      />

      {report.batches.length === 0 ? (
        <EmptyState
          title="Ainda não há lotes importados"
          description="Sem importações não há nada para avaliar."
          action={
            <Link href="/imports/new" className="text-sm underline underline-offset-4">
              Importar ficheiro
            </Link>
          }
        />
      ) : (
        <>
          <section aria-labelledby="cobertura" className="space-y-3">
            <h2 id="cobertura" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Cobertura temporal
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card title="Consultas">
                <p className="text-2xl font-semibold tabular-nums" data-testid="quality-facts">
                  {report.totalFacts}
                </p>
              </Card>
              <Card title="Primeira consulta">
                <p className="text-lg font-semibold tabular-nums">
                  {formatDate(report.coverageFrom)}
                </p>
              </Card>
              <Card title="Última consulta">
                <p className="text-lg font-semibold tabular-nums">
                  {formatDate(report.coverageTo)}
                </p>
              </Card>
              <Card title="Meses sem dados">
                <p className="text-2xl font-semibold tabular-nums" data-testid="quality-gaps">
                  {report.monthsWithoutData.length}
                </p>
              </Card>
            </div>

            {report.monthsWithoutData.length > 0 ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Sem qualquer consulta em: {report.monthsWithoutData.join(", ")}. Um KPI que
                atravesse estes meses fica incompleto — pode ser um ficheiro em falta, e não uma
                clínica parada.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="lotes" className="space-y-3">
            <h2 id="lotes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Lotes importados
            </h2>
            <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-emerald-700 dark:text-emerald-400">
                <strong className="tabular-nums">{report.committedBatches}</strong> confirmados
              </span>
              <span className="text-amber-700 dark:text-amber-400">
                <strong className="tabular-nums">{report.duplicateBatches}</strong> duplicados
              </span>
              <span className="text-red-700 dark:text-red-400">
                <strong className="tabular-nums">{report.rejectedBatches}</strong> recusados
              </span>
              <span>
                <strong className="tabular-nums">{report.rowsRejectedTotal}</strong> linhas
                rejeitadas
              </span>
              <span>
                <strong className="tabular-nums">{report.rowsIgnoredTotal}</strong> linhas ignoradas
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm" data-testid="quality-batches">
                <caption className="sr-only">Lotes de importação e o destino das linhas</caption>
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Ficheiro</th>
                    <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                    <th scope="col" className="px-4 py-3 font-medium">Perfil</th>
                    <th scope="col" className="px-4 py-3 font-medium">Total</th>
                    <th scope="col" className="px-4 py-3 font-medium">Aceites</th>
                    <th scope="col" className="px-4 py-3 font-medium">Rejeitadas</th>
                    <th scope="col" className="px-4 py-3 font-medium">Ignoradas</th>
                    <th scope="col" className="px-4 py-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/imports/${batch.id}`}
                          className="underline underline-offset-4"
                        >
                          {batch.originalFilename}
                        </Link>
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          {batch.shortHash}
                        </span>
                      </td>
                      <td className="px-4 py-3">{STATUS_LABELS[batch.status] ?? batch.status}</td>
                      <td className="px-4 py-3 text-xs">
                        {batch.profileKey ?? "—"}
                        {batch.profileIsSynthetic ? (
                          <span className="ml-1">
                            <Badge tone="pending">sintético</Badge>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{batch.rowsTotal}</td>
                      <td className="px-4 py-3 tabular-nums">{batch.rowsCommitted}</td>
                      <td className="px-4 py-3 tabular-nums">{batch.rowsInvalid}</td>
                      <td className="px-4 py-3 tabular-nums">{batch.rowsIgnored}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {batch.uploadedAt.toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="motivos" className="space-y-3">
            <h2 id="motivos" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Porque foram rejeitadas
            </h2>
            {report.issueBreakdown.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Nenhuma linha foi rejeitada.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-left text-sm" data-testid="quality-issues">
                  <caption className="sr-only">Motivos de rejeição por frequência</caption>
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Motivo</th>
                      <th scope="col" className="px-4 py-3 font-medium">Código</th>
                      <th scope="col" className="px-4 py-3 font-medium">Gravidade</th>
                      <th scope="col" className="px-4 py-3 font-medium">Linhas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.issueBreakdown.map((issue) => (
                      <tr key={`${issue.code}-${issue.severity}`}>
                        <td className="px-4 py-3">{issue.label}</td>
                        <td className="px-4 py-3 font-mono text-xs">{issue.code}</td>
                        <td className="px-4 py-3">
                          <Badge tone={issue.severity === "ERROR" ? "pending" : "neutral"}>
                            {issue.severity === "ERROR" ? "Erro" : "Aviso"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{issue.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="campos" className="space-y-3">
            <h2 id="campos" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Campos em falta nos dados gravados
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card title="Consultas sem médico atribuído">
                <p className="text-2xl font-semibold tabular-nums">{report.missingPractitioner}</p>
              </Card>
              <Card title="Consultas sem referência de paciente">
                <p className="text-2xl font-semibold tabular-nums">{report.missingPatientRef}</p>
              </Card>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ambos os campos são opcionais no contrato de importação. Uma contagem alta na
              primeira significa que o filtro por médico cobre menos consultas do que parece.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
