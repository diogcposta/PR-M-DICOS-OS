/**
 * Validação e normalização de linhas de agenda.
 *
 * Função pura: recebe as linhas cruas e o mapeamento, devolve linhas canónicas,
 * erros por linha/campo e contagens. Não sabe o que é uma base de dados, um
 * ficheiro ou um pedido HTTP — e é por isso que é fácil de testar.
 */
import { createHash } from "node:crypto";

import {
  type AppointmentMapping,
  type AppointmentStatusValue,
  appointmentFieldKeys,
  isRequiredField,
} from "@/modules/imports/domain/appointment-profile";
import {
  normalizeLabel,
  normalizePortugueseDate,
  normalizeText,
} from "@/modules/imports/domain/normalizers";

/** Uma linha do ficheiro tal como saiu do parser: cabeçalho → valor. */
export type RawRow = Readonly<Record<string, unknown>>;

export interface ValidatedAppointmentRow {
  readonly stableRowKey: string;
  readonly sourceRecordId: string | null;
  readonly occurredAt: Date;
  readonly clinicExternalId: string;
  readonly practitionerExternalId: string | null;
  readonly patientExternalRef: string | null;
  readonly status: AppointmentStatusValue;
  readonly sourceStatusLabel: string;
  readonly durationMinutes: number | null;
  readonly sourceRowNumber: number;
}

export interface RowIssue {
  readonly sourceRowNumber: number;
  readonly columnName: string | null;
  readonly code: string;
  readonly message: string;
  readonly severity: "WARNING" | "ERROR";
}

export interface ValidationReport {
  readonly validRows: readonly ValidatedAppointmentRow[];
  readonly issues: readonly RowIssue[];
  readonly rowsTotal: number;
  readonly rowsValid: number;
  readonly rowsInvalid: number;
  /** Linhas válidas descartadas por serem duplicadas dentro do próprio ficheiro. */
  readonly duplicateRowsInFile: number;
}

/** Campos obrigatórios sem coluna atribuída. Impede a confirmação do lote. */
export function findUnmappedRequiredFields(mapping: AppointmentMapping): readonly string[] {
  return appointmentFieldKeys.filter(
    (field) => isRequiredField(field) && !mapping.columns[field],
  );
}

/**
 * Chave estável de uma linha.
 *
 * Preferimos o identificador da origem, como manda o contrato. Sem ele, deriva-se
 * uma chave de campos normalizados — documentada aqui porque é o que garante que
 * reimportar o mesmo ficheiro não duplica factos.
 */
export function buildStableRowKey(input: {
  readonly sourceRecordId: string | null;
  readonly clinicExternalId: string;
  readonly occurredAt: Date;
  readonly patientExternalRef: string | null;
  readonly practitionerExternalId: string | null;
}): string {
  if (input.sourceRecordId !== null) {
    return `APPOINTMENTS:id:${input.sourceRecordId}`;
  }

  const parts = [
    "APPOINTMENTS",
    input.clinicExternalId,
    input.occurredAt.toISOString(),
    input.patientExternalRef ?? "",
    input.practitionerExternalId ?? "",
  ].join("|");

  return `APPOINTMENTS:derived:${createHash("sha256").update(parts).digest("hex").slice(0, 32)}`;
}

export function validateAppointmentRows(
  rows: readonly RawRow[],
  mapping: AppointmentMapping,
): ValidationReport {
  const validRows: ValidatedAppointmentRow[] = [];
  const issues: RowIssue[] = [];
  const seenKeys = new Set<string>();
  let duplicateRowsInFile = 0;

  const column = (field: keyof AppointmentMapping["columns"]): string | null =>
    mapping.columns[field] ?? null;

  rows.forEach((row, index) => {
    // +2: a linha 1 é o cabeçalho, e as folhas contam a partir de 1. Assim o
    // número que mostramos é o que o gestor vê no Excel.
    const sourceRowNumber = index + 2;
    const rowIssues: RowIssue[] = [];

    const addIssue = (
      columnName: string | null,
      code: string,
      message: string,
      severity: "WARNING" | "ERROR" = "ERROR",
    ): void => {
      rowIssues.push({ sourceRowNumber, columnName, code, message, severity });
    };

    const readCell = (field: keyof AppointmentMapping["columns"]): unknown => {
      const name = column(field);
      return name === null ? null : row[name];
    };

    // --- clínica (obrigatória) ---
    const clinicExternalId = normalizeText(readCell("clinicExternalId"));
    if (clinicExternalId === null) {
      addIssue(column("clinicExternalId"), "CLINIC_ID_MISSING", "ID da clínica em falta.");
    }

    // --- data (obrigatória) ---
    const dateResult = normalizePortugueseDate(readCell("occurredAt"));
    if (!dateResult.ok) {
      addIssue(column("occurredAt"), dateResult.code, dateResult.message);
    }

    // --- estado (obrigatório) ---
    const rawStatus = normalizeText(readCell("status"));
    let status: AppointmentStatusValue | null = null;
    if (rawStatus === null) {
      addIssue(column("status"), "STATUS_MISSING", "Estado da consulta em falta.");
    } else {
      const normalized = normalizeLabel(rawStatus) ?? "";
      const mapped = mapping.statusLabels[normalized];
      if (mapped === undefined) {
        // Deliberadamente um erro, e não o estado UNKNOWN: um estado por mapear
        // silenciosamente enviado para UNKNOWN falsearia a taxa de faltas.
        addIssue(
          column("status"),
          "STATUS_UNMAPPED",
          `Estado "${rawStatus}" não está mapeado. Acrescente-o ao perfil antes de confirmar.`,
        );
      } else {
        status = mapped;
      }
    }

    // --- campos opcionais ---
    const sourceRecordId = normalizeText(readCell("sourceRecordId"));
    const practitionerExternalId = normalizeText(readCell("practitionerExternalId"));
    const patientExternalRef = normalizeText(readCell("patientExternalRef"));

    let durationMinutes: number | null = null;
    const rawDuration = normalizeText(readCell("durationMinutes"));
    if (rawDuration !== null) {
      const parsed = Number(rawDuration.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed < 0) {
        addIssue(column("durationMinutes"), "DURATION_INVALID", `Duração inválida: "${rawDuration}".`);
      } else {
        durationMinutes = Math.round(parsed);
      }
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      return;
    }

    // Os campos obrigatórios estão garantidos neste ponto.
    const occurredAt = (dateResult as { ok: true; value: Date }).value;
    const stableRowKey = buildStableRowKey({
      sourceRecordId,
      clinicExternalId: clinicExternalId as string,
      occurredAt,
      patientExternalRef,
      practitionerExternalId,
    });

    if (seenKeys.has(stableRowKey)) {
      duplicateRowsInFile += 1;
      issues.push({
        sourceRowNumber,
        columnName: column("sourceRecordId"),
        code: "ROW_DUPLICATE_IN_FILE",
        message: "Linha repetida dentro do próprio ficheiro; será gravada uma só vez.",
        severity: "WARNING",
      });
      return;
    }

    seenKeys.add(stableRowKey);
    validRows.push({
      stableRowKey,
      sourceRecordId,
      occurredAt,
      clinicExternalId: clinicExternalId as string,
      practitionerExternalId,
      patientExternalRef,
      status: status as AppointmentStatusValue,
      sourceStatusLabel: rawStatus as string,
      durationMinutes,
      sourceRowNumber,
    });
  });

  const rowsInvalid = new Set(
    issues.filter((issue) => issue.severity === "ERROR").map((issue) => issue.sourceRowNumber),
  ).size;

  return {
    validRows,
    issues,
    rowsTotal: rows.length,
    rowsValid: validRows.length,
    rowsInvalid,
    duplicateRowsInFile,
  };
}
