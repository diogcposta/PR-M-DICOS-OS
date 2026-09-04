/**
 * Validação de um ficheiro contra um mapeamento, sem gravar nada.
 *
 * Corre exatamente o mesmo pipeline que a confirmação — é a mesma função que o
 * commit usa. Se a pré-visualização e a gravação usassem caminhos diferentes,
 * mais cedo ou mais tarde divergiriam e o gestor confirmaria algo diferente do
 * que viu.
 */
import { prisma } from "@/lib/db/client";
import type { AppointmentMapping } from "@/modules/imports/domain/appointment-profile";
import {
  type RowIssue,
  type ValidatedAppointmentRow,
  findUnmappedRequiredFields,
  validateAppointmentRows,
} from "@/modules/imports/domain/validate-appointments";
import {
  type FileKind,
  assertAcceptableFile,
  hashFileContent,
  parseImportFile,
} from "@/modules/imports/infrastructure/file-parser";

export interface AnalyzedFile {
  readonly fileHash: string;
  readonly fileSizeBytes: number;
  readonly kind: FileKind;
  readonly sheetName: string;
  readonly rowsTotal: number;
  readonly rowsValid: number;
  readonly rowsInvalid: number;
  readonly duplicateRowsInFile: number;
  readonly issues: readonly RowIssue[];
  readonly resolvedRows: readonly ResolvedAppointmentRow[];
  readonly unmappedRequiredFields: readonly string[];
}

export interface ResolvedAppointmentRow extends ValidatedAppointmentRow {
  readonly clinicId: string;
  readonly practitionerId: string | null;
}

/**
 * Resolve identificadores externos em entidades da base.
 *
 * Uma clínica ou um médico desconhecidos são um erro de linha, não uma criação
 * automática: inventar entidades a partir de um ficheiro encheria a base de
 * duplicados por causa de uma gralha na exportação.
 */
async function resolveEntities(
  organizationId: string,
  rows: readonly ValidatedAppointmentRow[],
): Promise<{ resolved: ResolvedAppointmentRow[]; issues: RowIssue[] }> {
  const clinicIds = [...new Set(rows.map((row) => row.clinicExternalId))];
  const practitionerIds = [
    ...new Set(rows.map((row) => row.practitionerExternalId).filter((id): id is string => id !== null)),
  ];

  const [clinics, practitioners] = await Promise.all([
    prisma.clinic.findMany({
      where: { organizationId, externalId: { in: clinicIds } },
      select: { id: true, externalId: true },
    }),
    practitionerIds.length === 0
      ? Promise.resolve([])
      : prisma.practitioner.findMany({
          where: { organizationId, externalId: { in: practitionerIds } },
          select: { id: true, externalId: true },
        }),
  ]);

  const clinicByExternal = new Map(clinics.map((clinic) => [clinic.externalId, clinic.id]));
  const practitionerByExternal = new Map(
    practitioners
      .filter((p): p is { id: string; externalId: string } => p.externalId !== null)
      .map((p) => [p.externalId, p.id]),
  );

  const resolved: ResolvedAppointmentRow[] = [];
  const issues: RowIssue[] = [];

  for (const row of rows) {
    const clinicId = clinicByExternal.get(row.clinicExternalId);
    if (clinicId === undefined) {
      issues.push({
        sourceRowNumber: row.sourceRowNumber,
        columnName: null,
        code: "CLINIC_UNKNOWN",
        message: `A clínica "${row.clinicExternalId}" não existe nesta organização.`,
        severity: "ERROR",
      });
      continue;
    }

    let practitionerId: string | null = null;
    if (row.practitionerExternalId !== null) {
      const found = practitionerByExternal.get(row.practitionerExternalId);
      if (found === undefined) {
        issues.push({
          sourceRowNumber: row.sourceRowNumber,
          columnName: null,
          code: "PRACTITIONER_UNKNOWN",
          message: `O médico "${row.practitionerExternalId}" não existe nesta organização.`,
          severity: "ERROR",
        });
        continue;
      }
      practitionerId = found;
    }

    resolved.push({ ...row, clinicId, practitionerId });
  }

  return { resolved, issues };
}

export async function analyzeFile(input: {
  readonly organizationId: string;
  readonly filename: string;
  readonly content: Buffer;
  readonly mapping: AppointmentMapping;
  readonly sheetName?: string;
}): Promise<AnalyzedFile> {
  const kind = assertAcceptableFile(input.filename, input.content.byteLength);
  const fileHash = hashFileContent(input.content);
  const parsed = await parseImportFile(kind, input.content);

  const sheet =
    (input.sheetName === undefined
      ? parsed.sheets[0]
      : parsed.sheets.find((candidate) => candidate.name === input.sheetName)) ?? parsed.sheets[0];

  if (!sheet) {
    throw new Error("O ficheiro não tem folhas legíveis.");
  }

  const unmappedRequiredFields = findUnmappedRequiredFields(input.mapping);
  const report = validateAppointmentRows(sheet.rows, input.mapping);
  const { resolved, issues: entityIssues } = await resolveEntities(
    input.organizationId,
    report.validRows,
  );

  const issues = [...report.issues, ...entityIssues].sort(
    (a, b) => a.sourceRowNumber - b.sourceRowNumber,
  );

  const rowsInvalid = new Set(
    issues.filter((issue) => issue.severity === "ERROR").map((issue) => issue.sourceRowNumber),
  ).size;

  return {
    fileHash,
    fileSizeBytes: input.content.byteLength,
    kind,
    sheetName: sheet.name,
    rowsTotal: report.rowsTotal,
    rowsValid: resolved.length,
    rowsInvalid,
    duplicateRowsInFile: report.duplicateRowsInFile,
    issues,
    resolvedRows: resolved,
    unmappedRequiredFields,
  };
}
