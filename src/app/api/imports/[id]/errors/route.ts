import { getImportBatch } from "@/modules/imports/application/get-import-batch";
import {
  buildErrorReportCsv,
  errorReportFilename,
} from "@/modules/imports/domain/error-report";
import { getCurrentOrganization } from "@/modules/organizations/application/get-current-organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Relatório de erros do lote, para o gestor corrigir o ficheiro no Excel. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const organization = await getCurrentOrganization();
  if (!organization) {
    return new Response("Não existe nenhuma organização configurada.", { status: 400 });
  }

  const batch = await getImportBatch(organization.id, id);
  if (!batch) {
    return new Response("Lote não encontrado.", { status: 404 });
  }

  const csv = buildErrorReportCsv(batch.issues);

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${errorReportFilename(batch.originalFilename)}"`,
      // Um relatório é sempre do momento: nunca cacheado.
      "cache-control": "no-store",
    },
  });
}
