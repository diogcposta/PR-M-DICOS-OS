/**
 * Detalhe de um lote: estado, contagens, mapeamento usado e erros por linha.
 */
import { prisma } from "@/lib/db/client";

export interface ImportBatchDetail {
  readonly id: string;
  readonly originalFilename: string;
  readonly fileHash: string;
  readonly fileSizeBytes: number;
  readonly sourceType: string;
  readonly status: string;
  readonly rowsTotal: number;
  readonly rowsValid: number;
  readonly rowsInvalid: number;
  readonly rowsCommitted: number;
  readonly failureReason: string | null;
  readonly uploadedAt: Date;
  readonly committedAt: Date | null;
  readonly profile: { readonly key: string; readonly version: number; readonly isSynthetic: boolean } | null;
  readonly issues: readonly {
    readonly sourceRowNumber: number;
    readonly columnName: string | null;
    readonly code: string;
    readonly message: string;
    readonly severity: string;
  }[];
}

export async function getImportBatch(
  organizationId: string,
  batchId: string,
): Promise<ImportBatchDetail | null> {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, organizationId },
    include: {
      importProfile: { select: { key: true, version: true, isSynthetic: true } },
      rowErrors: { orderBy: { sourceRowNumber: "asc" }, take: 500 },
    },
  });

  if (!batch) {
    return null;
  }

  return {
    id: batch.id,
    originalFilename: batch.originalFilename,
    fileHash: batch.fileHash,
    fileSizeBytes: batch.fileSizeBytes,
    sourceType: batch.sourceType,
    status: batch.status,
    rowsTotal: batch.rowsTotal,
    rowsValid: batch.rowsValid,
    rowsInvalid: batch.rowsInvalid,
    rowsCommitted: batch.rowsCommitted,
    failureReason: batch.failureReason,
    uploadedAt: batch.uploadedAt,
    committedAt: batch.committedAt,
    profile: batch.importProfile,
    issues: batch.rowErrors.map((error) => ({
      sourceRowNumber: error.sourceRowNumber,
      columnName: error.columnName,
      code: error.code,
      message: error.message,
      severity: error.severity,
    })),
  };
}
