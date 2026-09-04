/**
 * Serviço de aplicação: histórico de lotes de importação.
 */
import { prisma } from "@/lib/db/client";

export interface ImportBatchListItem {
  readonly id: string;
  readonly originalFilename: string;
  /** Hash abreviado, suficiente para reconhecer um ficheiro sem o expor. */
  readonly shortHash: string;
  readonly sourceType: string;
  readonly status: string;
  readonly rowsTotal: number;
  readonly rowsValid: number;
  readonly rowsInvalid: number;
  readonly uploadedAt: Date;
}

export async function listImportBatches(
  organizationId: string,
  limit = 50,
): Promise<readonly ImportBatchListItem[]> {
  const batches = await prisma.importBatch.findMany({
    where: { organizationId },
    orderBy: { uploadedAt: "desc" },
    take: limit,
  });

  return batches.map((batch) => ({
    id: batch.id,
    originalFilename: batch.originalFilename,
    shortHash: batch.fileHash.slice(0, 12),
    sourceType: batch.sourceType,
    status: batch.status,
    rowsTotal: batch.rowsTotal,
    rowsValid: batch.rowsValid,
    rowsInvalid: batch.rowsInvalid,
    uploadedAt: batch.uploadedAt,
  }));
}
