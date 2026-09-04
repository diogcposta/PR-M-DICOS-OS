/**
 * Contrato canónico da importação (docs/IMPORT_CONTRACT.md).
 *
 * Fase 1 define apenas os tipos e as transições de estado. Não há aqui parsing
 * de ficheiros, nem cabeçalhos do Newsoft — esses só entram na Fase 2, e só
 * depois de recebermos uma exportação real anonimizada.
 */
import { z } from "zod";

export const importSourceTypes = [
  "APPOINTMENTS",
  "PRODUCTION_BILLING",
  "BUDGETS",
  "PATIENT_STATUS",
  "OUTSTANDING_BALANCES",
] as const;

export const importBatchStatuses = [
  "UPLOADED",
  "PARSED",
  "MAPPED",
  "VALIDATED",
  "COMMITTED",
  "REJECTED",
  "FAILED",
  "DUPLICATE",
] as const;

export type ImportSourceType = (typeof importSourceTypes)[number];
export type ImportBatchStatus = (typeof importBatchStatuses)[number];

/**
 * Transições permitidas do lote.
 * Os estados terminais (COMMITTED, REJECTED, FAILED, DUPLICATE) não têm saída:
 * um lote confirmado nunca volta atrás — corrige-se com um novo lote.
 */
export const ALLOWED_BATCH_TRANSITIONS: Readonly<
  Record<ImportBatchStatus, readonly ImportBatchStatus[]>
> = {
  UPLOADED: ["PARSED", "REJECTED", "FAILED", "DUPLICATE"],
  PARSED: ["MAPPED", "REJECTED", "FAILED"],
  MAPPED: ["VALIDATED", "REJECTED", "FAILED"],
  VALIDATED: ["COMMITTED", "REJECTED", "FAILED"],
  COMMITTED: [],
  REJECTED: [],
  FAILED: [],
  DUPLICATE: [],
};

export function canTransition(from: ImportBatchStatus, to: ImportBatchStatus): boolean {
  return ALLOWED_BATCH_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: ImportBatchStatus): boolean {
  return ALLOWED_BATCH_TRANSITIONS[status].length === 0;
}

/**
 * Campos que qualquer linha validada tem de trazer, independentemente do tipo
 * de exportação. Note-se a ausência de nome, contacto ou nota clínica: o
 * paciente entra apenas como referência pseudonimizada.
 */
export const canonicalRowSchema = z.object({
  sourceType: z.enum(importSourceTypes),
  /** Identificador do registo na origem, quando existe. */
  sourceRecordId: z.string().min(1).optional(),
  /** Chave estável derivada de campos normalizados; garante idempotência. */
  stableRowKey: z.string().min(1),
  clinicExternalId: z.string().min(1),
  practitionerExternalId: z.string().min(1).optional(),
  patientExternalRef: z.string().min(1).optional(),
  occurredAt: z.date(),
  sourceRowNumber: z.int().positive(),
  importProfileKey: z.string().min(1),
  importProfileVersion: z.int().positive(),
});

export type CanonicalRow = z.infer<typeof canonicalRowSchema>;

/** Erro atribuído a uma linha (e possivelmente a uma coluna) do ficheiro. */
export const rowErrorSchema = z.object({
  sourceRowNumber: z.int().positive(),
  columnName: z.string().min(1).optional(),
  /** Código estável para tradução e agregação, ex.: DATE_FORMAT_INVALID. */
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["WARNING", "ERROR"]).default("ERROR"),
});

export type RowError = z.infer<typeof rowErrorSchema>;

/** Limites de aceitação do ficheiro, aplicados antes de qualquer parsing. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_FILE_EXTENSIONS = [".csv", ".xlsx"] as const;
