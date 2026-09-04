import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getImportBatch } from "@/modules/imports/application/get-import-batch";
import { getCurrentOrganization } from "@/modules/organizations/application/get-current-organization";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  COMMITTED: "Confirmado",
  DUPLICATE: "Duplicado",
  REJECTED: "Recusado",
  FAILED: "Falhou",
  VALIDATED: "Validado",
  UPLOADED: "Carregado",
  PARSED: "Lido",
  MAPPED: "Mapeado",
};

export default async function ImportBatchPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const organization = await getCurrentOrganization();
  if (!organization) {
    notFound();
  }

  const batch = await getImportBatch(organization.id, id);
  if (!batch) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={batch.originalFilename}
        description={`Lote de importação · ${STATUS_LABELS[batch.status] ?? batch.status}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Linhas no ficheiro">
          <p className="text-2xl font-semibold tabular-nums">{batch.rowsTotal}</p>
        </Card>
        <Card title="Válidas">
          <p className="text-2xl font-semibold tabular-nums">{batch.rowsValid}</p>
        </Card>
        <Card title="Inválidas">
          <p className="text-2xl font-semibold tabular-nums">{batch.rowsInvalid}</p>
        </Card>
        <Card title="Gravadas">
          <p className="text-2xl font-semibold tabular-nums" data-testid="rows-committed">
            {batch.rowsCommitted}
          </p>
        </Card>
      </div>

      {batch.failureReason ? (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {batch.failureReason}
        </p>
      ) : null}

      <section aria-labelledby="proveniencia" className="space-y-3">
        <h2 id="proveniencia" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Proveniência
        </h2>
        <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              SHA-256
            </dt>
            <dd className="mt-1 break-all font-mono text-xs">{batch.fileHash}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tipo de exportação
            </dt>
            <dd className="mt-1">{batch.sourceType}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Perfil de mapeamento
            </dt>
            <dd className="mt-1">
              {batch.profile ? (
                <>
                  {batch.profile.key} v{batch.profile.version}{" "}
                  {batch.profile.isSynthetic ? <Badge tone="pending">sintético</Badge> : null}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Confirmado em
            </dt>
            <dd className="mt-1">
              {batch.committedAt ? batch.committedAt.toISOString().replace("T", " ").slice(0, 19) : "—"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          O conteúdo do ficheiro não é guardado. Ficam apenas o hash, as contagens, o mapeamento e os
          erros por linha.
        </p>
      </section>

      <section aria-labelledby="erros" className="space-y-3">
        <h2 id="erros" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Erros e avisos por linha
        </h2>
        {batch.issues.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Sem erros registados.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Erros por linha do lote</caption>
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Linha</th>
                  <th scope="col" className="px-3 py-2 font-medium">Coluna</th>
                  <th scope="col" className="px-3 py-2 font-medium">Código</th>
                  <th scope="col" className="px-3 py-2 font-medium">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {batch.issues.map((issue, index) => (
                  <tr key={`${issue.sourceRowNumber}-${issue.code}-${index}`}>
                    <td className="px-3 py-2 tabular-nums">{issue.sourceRowNumber}</td>
                    <td className="px-3 py-2">{issue.columnName ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{issue.code}</td>
                    <td className="px-3 py-2">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
