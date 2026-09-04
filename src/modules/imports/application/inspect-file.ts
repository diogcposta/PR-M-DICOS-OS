/**
 * Pré-visualização de um ficheiro submetido.
 *
 * Devolve tudo o que o gestor precisa de ver **antes** de gravar: folhas,
 * cabeçalhos, amostra, mapeamento sugerido e o aviso de ficheiro já importado.
 * Não escreve nada na base de dados.
 */
import { prisma } from "@/lib/db/client";
import {
  type AppointmentMapping,
  suggestAppointmentMapping,
} from "@/modules/imports/domain/appointment-profile";
import { findUnmappedRequiredFields } from "@/modules/imports/domain/validate-appointments";
import {
  type FileKind,
  type ParsedFile,
  assertAcceptableFile,
  hashFileContent,
  parseImportFile,
} from "@/modules/imports/infrastructure/file-parser";

export const SAMPLE_ROW_LIMIT = 10;

export interface SheetPreview {
  readonly name: string;
  readonly headers: readonly string[];
  readonly rowCount: number;
  readonly sampleRows: readonly (readonly (string | null)[])[];
}

export interface DuplicateWarning {
  readonly batchId: string;
  readonly originalFilename: string;
  readonly committedAt: Date | null;
}

export interface FilePreview {
  readonly fileHash: string;
  readonly fileSizeBytes: number;
  readonly kind: FileKind;
  readonly detectedDelimiter: string | null;
  readonly sheets: readonly SheetPreview[];
  readonly suggestedMapping: AppointmentMapping;
  readonly unmappedRequiredFields: readonly string[];
  /** Preenchido quando já existe um lote CONFIRMADO com o mesmo hash. */
  readonly alreadyCommitted: DuplicateWarning | null;
}

function toSampleRows(parsed: ParsedFile, sheetIndex: number): readonly (readonly (string | null)[])[] {
  const sheet = parsed.sheets[sheetIndex];
  if (!sheet) {
    return [];
  }
  return sheet.rows.slice(0, SAMPLE_ROW_LIMIT).map((row) =>
    sheet.headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) {
        return null;
      }
      return value instanceof Date ? value.toISOString() : String(value);
    }),
  );
}

/** Procura um lote já confirmado com o mesmo conteúdo. */
export async function findCommittedBatchByHash(
  organizationId: string,
  fileHash: string,
): Promise<DuplicateWarning | null> {
  const batch = await prisma.importBatch.findFirst({
    where: { organizationId, fileHash, status: "COMMITTED" },
    orderBy: { committedAt: "desc" },
    select: { id: true, originalFilename: true, committedAt: true },
  });
  if (!batch) {
    return null;
  }
  return {
    batchId: batch.id,
    originalFilename: batch.originalFilename,
    committedAt: batch.committedAt,
  };
}

export async function inspectFile(input: {
  readonly organizationId: string;
  readonly filename: string;
  readonly content: Buffer;
}): Promise<FilePreview> {
  const kind = assertAcceptableFile(input.filename, input.content.byteLength);
  const fileHash = hashFileContent(input.content);
  const parsed = await parseImportFile(kind, input.content);

  const firstSheet = parsed.sheets[0];
  const suggestedMapping = suggestAppointmentMapping(firstSheet?.headers ?? []);

  const sheets: SheetPreview[] = parsed.sheets.map((sheet, index) => ({
    name: sheet.name,
    headers: sheet.headers,
    rowCount: sheet.rows.length,
    sampleRows: toSampleRows(parsed, index),
  }));

  return {
    fileHash,
    fileSizeBytes: input.content.byteLength,
    kind,
    detectedDelimiter: parsed.detectedDelimiter ?? null,
    sheets,
    suggestedMapping,
    unmappedRequiredFields: findUnmappedRequiredFields(suggestedMapping),
    alreadyCommitted: await findCommittedBatchByHash(input.organizationId, fileHash),
  };
}
