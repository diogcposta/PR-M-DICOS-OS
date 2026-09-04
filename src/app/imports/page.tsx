import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { listImportBatches } from "@/modules/imports/application/list-import-batches";
import { getCurrentOrganization } from "@/modules/organizations/application/get-current-organization";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Importações"
          description="Histórico dos ficheiros submetidos, com hash, estado e contagens."
        />
        <EmptyState
          title="Nenhuma organização configurada"
          description="Execute `npm run db:seed` para criar a organização sintética de desenvolvimento."
        />
      </div>
    );
  }

  const batches = await listImportBatches(organization.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Importações"
          description="Histórico dos ficheiros submetidos, com hash abreviado, tipo, estado e contagens de linhas."
        />
        <Link
          href="/imports/new"
          className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Importar ficheiro
        </Link>
      </div>

      {batches.length === 0 ? (
        <EmptyState
          title="Ainda não há lotes importados"
          description="Carregue uma exportação de agenda para ver aqui o histórico. Cada lote guarda o hash do ficheiro, o mapeamento usado e os erros por linha."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Lotes de importação</caption>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Ficheiro</th>
                <th scope="col" className="px-4 py-3 font-medium">Hash</th>
                <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
                <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                <th scope="col" className="px-4 py-3 font-medium">Linhas</th>
                <th scope="col" className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="px-4 py-3">
                    <Link href={`/imports/${batch.id}`} className="underline underline-offset-4">
                      {batch.originalFilename}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{batch.shortHash}</td>
                  <td className="px-4 py-3">{batch.sourceType}</td>
                  <td className="px-4 py-3">{batch.status}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {batch.rowsValid}/{batch.rowsTotal}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {batch.uploadedAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
