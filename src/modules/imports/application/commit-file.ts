/**
 * Confirmação transacional de um lote.
 *
 * Ou entra o lote segundo a política escolhida, ou o estado fica coerente: tudo
 * acontece dentro de uma transação, incluindo o registo do próprio lote. Se a
 * gravação dos factos falhar a meio, não fica um `ImportBatch` órfão a dizer que
 * correu bem.
 */
import { prisma } from "@/lib/db/client";
import { ImportSourceType } from "@/generated/prisma/enums";
import { logger } from "@/lib/observability/logger";
import {
  SYNTHETIC_APPOINTMENT_PROFILE_KEY,
  SYNTHETIC_APPOINTMENT_PROFILE_VERSION,
  type AppointmentMapping,
} from "@/modules/imports/domain/appointment-profile";
import { analyzeFile } from "@/modules/imports/application/validate-file";
import { findCommittedBatchByHash } from "@/modules/imports/application/inspect-file";

/**
 * Política de linhas inválidas (D-008).
 *
 * `ALL_OR_NOTHING` é o valor por omissão: uma linha inválida impede a gravação.
 * `VALID_ROWS_ONLY` só é usado quando o gestor o escolhe explicitamente no ecrã,
 * depois de ver as contagens e os erros.
 */
export type RowPolicy = "ALL_OR_NOTHING" | "VALID_ROWS_ONLY";

/**
 * Destino de cada linha do ficheiro. As três contagens somam sempre `rowsTotal`,
 * e é isso que permite ao ecrã dizer ao gestor onde foi parar cada linha.
 */
export interface RowDisposition {
  readonly rowsTotal: number;
  /** Gravadas como facto novo. */
  readonly rowsAccepted: number;
  /** Recusadas por erro de validação. */
  readonly rowsRejected: number;
  /** Válidas, mas já existentes — repetidas no ficheiro ou já importadas antes. */
  readonly rowsIgnored: number;
}

export type CommitOutcome =
  | ({ readonly kind: "COMMITTED"; readonly batchId: string } & RowDisposition)
  | { readonly kind: "DUPLICATE"; readonly batchId: string; readonly previousBatchId: string }
  | { readonly kind: "REJECTED"; readonly batchId: string; readonly reason: string };

export async function commitAppointmentFile(input: {
  readonly organizationId: string;
  readonly filename: string;
  readonly content: Buffer;
  readonly mapping: AppointmentMapping;
  readonly sheetName?: string;
  readonly rowPolicy: RowPolicy;
  /** Hash mostrado ao gestor na pré-visualização, para detetar troca de ficheiro. */
  readonly expectedFileHash?: string;
}): Promise<CommitOutcome> {
  const analysis = await analyzeFile({
    organizationId: input.organizationId,
    filename: input.filename,
    content: input.content,
    mapping: input.mapping,
    ...(input.sheetName === undefined ? {} : { sheetName: input.sheetName }),
  });

  // O ficheiro é reenviado na confirmação porque não guardamos o conteúdo
  // (D-007). Confirmamos que é mesmo o ficheiro que foi pré-visualizado.
  if (input.expectedFileHash !== undefined && input.expectedFileHash !== analysis.fileHash) {
    throw new Error(
      "O ficheiro enviado na confirmação não é o mesmo que foi pré-visualizado. Repita a pré-visualização.",
    );
  }

  const baseBatch = {
    organizationId: input.organizationId,
    originalFilename: input.filename,
    fileHash: analysis.fileHash,
    fileSizeBytes: analysis.fileSizeBytes,
    sourceType: ImportSourceType.APPOINTMENTS,
    rowsTotal: analysis.rowsTotal,
    rowsValid: analysis.rowsValid,
    rowsInvalid: analysis.rowsInvalid,
  };

  // --- ficheiro já confirmado antes: regista-se o duplicado, não se grava nada
  const previous = await findCommittedBatchByHash(input.organizationId, analysis.fileHash);
  if (previous) {
    const batch = await prisma.importBatch.create({
      data: {
        ...baseBatch,
        status: "DUPLICATE",
        rowsCommitted: 0,
        failureReason: `Ficheiro já importado no lote ${previous.batchId}. Nenhum facto foi gravado.`,
      },
      select: { id: true },
    });
    logger.warn("lote duplicado recusado", {
      organizationId: input.organizationId,
      importBatchId: batch.id,
      status: "DUPLICATE",
    });
    return { kind: "DUPLICATE", batchId: batch.id, previousBatchId: previous.batchId };
  }

  const reject = async (reason: string): Promise<CommitOutcome> => {
    const batch = await prisma.importBatch.create({
      data: { ...baseBatch, status: "REJECTED", rowsCommitted: 0, failureReason: reason },
      select: { id: true },
    });
    return { kind: "REJECTED", batchId: batch.id, reason };
  };

  // --- coluna obrigatória por mapear: impede a confirmação
  if (analysis.unmappedRequiredFields.length > 0) {
    return reject(
      `Campos obrigatórios sem coluna atribuída: ${analysis.unmappedRequiredFields.join(", ")}.`,
    );
  }

  // --- política de linhas inválidas (D-008)
  if (analysis.rowsInvalid > 0 && input.rowPolicy === "ALL_OR_NOTHING") {
    return reject(
      `${analysis.rowsInvalid} de ${analysis.rowsTotal} linhas são inválidas. Corrija o ficheiro ou escolha explicitamente gravar apenas as linhas válidas.`,
    );
  }

  if (analysis.resolvedRows.length === 0) {
    return reject("Não há nenhuma linha válida para gravar.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // O perfil de mapeamento é versionado: a mesma chave+versão é reutilizada,
    // para que cada lote possa dizer com que mapeamento foi gravado.
    const profile = await tx.importProfile.upsert({
      where: {
        organizationId_key_version: {
          organizationId: input.organizationId,
          key: SYNTHETIC_APPOINTMENT_PROFILE_KEY,
          version: SYNTHETIC_APPOINTMENT_PROFILE_VERSION,
        },
      },
      update: { mapping: input.mapping },
      create: {
        organizationId: input.organizationId,
        key: SYNTHETIC_APPOINTMENT_PROFILE_KEY,
        version: SYNTHETIC_APPOINTMENT_PROFILE_VERSION,
        sourceType: ImportSourceType.APPOINTMENTS,
        name: "Agenda sintética v1 (perfil de demonstração; não corresponde a nenhuma exportação real)",
        isSynthetic: true,
        mapping: input.mapping,
      },
      select: { id: true },
    });

    const batch = await tx.importBatch.create({
      data: {
        ...baseBatch,
        status: "VALIDATED",
        rowsCommitted: 0,
        importProfileId: profile.id,
        importProfileVersion: SYNTHETIC_APPOINTMENT_PROFILE_VERSION,
      },
      select: { id: true },
    });

    if (analysis.issues.length > 0) {
      await tx.importRowError.createMany({
        data: analysis.issues.map((issue) => ({
          importBatchId: batch.id,
          sourceRowNumber: issue.sourceRowNumber,
          columnName: issue.columnName,
          code: issue.code,
          message: issue.message,
          severity: issue.severity,
        })),
      });
    }

    // `skipDuplicates` sobre (organizationId, stableRowKey): reimportar um
    // ficheiro que se sobreponha a outro não cria factos repetidos.
    const created = await tx.appointmentFact.createMany({
      data: analysis.resolvedRows.map((row) => ({
        organizationId: input.organizationId,
        clinicId: row.clinicId,
        practitionerId: row.practitionerId,
        patientExternalRef: row.patientExternalRef,
        sourceRecordId: row.sourceRecordId,
        stableRowKey: row.stableRowKey,
        occurredAt: row.occurredAt,
        status: row.status,
        sourceStatusLabel: row.sourceStatusLabel,
        durationMinutes: row.durationMinutes,
        importBatchId: batch.id,
        sourceRowNumber: row.sourceRowNumber,
      })),
      skipDuplicates: true,
    });

    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMMITTED",
        rowsCommitted: created.count,
        committedAt: new Date(),
      },
    });

    return { batchId: batch.id, rowsCommitted: created.count };
  });

  logger.info("lote confirmado", {
    organizationId: input.organizationId,
    importBatchId: result.batchId,
    status: "COMMITTED",
    rowsTotal: analysis.rowsTotal,
    rowsValid: analysis.rowsValid,
    rowsInvalid: analysis.rowsInvalid,
    rowsCommitted: result.rowsCommitted,
  });

  return {
    kind: "COMMITTED",
    batchId: result.batchId,
    rowsTotal: analysis.rowsTotal,
    rowsAccepted: result.rowsCommitted,
    rowsRejected: analysis.rowsInvalid,
    // O resto são linhas válidas que não geraram facto novo: repetidas dentro
    // do ficheiro, ou consultas que já tinham entrado num lote anterior.
    rowsIgnored: analysis.rowsTotal - analysis.rowsInvalid - result.rowsCommitted,
  };
}
