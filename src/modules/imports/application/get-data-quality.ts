/**
 * Qualidade dos dados importados.
 *
 * Responde às perguntas que precedem qualquer leitura de KPI: que ficheiros
 * entraram, quantas linhas se perderam pelo caminho, que campos vinham em falta
 * e que intervalo de tempo os dados cobrem de facto.
 *
 * Um KPI de janeiro calculado sobre dados que só começam a 15 de janeiro não
 * está errado — está incompleto. Sem esta página, isso é invisível.
 */
import { prisma } from "@/lib/db/client";

export interface QualityBatch {
  readonly id: string;
  readonly originalFilename: string;
  readonly shortHash: string;
  readonly status: string;
  readonly rowsTotal: number;
  readonly rowsValid: number;
  readonly rowsInvalid: number;
  readonly rowsCommitted: number;
  /** Válidas que não geraram facto novo: repetidas ou já importadas antes. */
  readonly rowsIgnored: number;
  readonly uploadedAt: Date;
  readonly committedAt: Date | null;
  readonly failureReason: string | null;
  readonly profileKey: string | null;
  readonly profileIsSynthetic: boolean;
}

export interface IssueBreakdown {
  readonly code: string;
  readonly label: string;
  readonly count: number;
  readonly severity: string;
}

export interface DataQualityReport {
  readonly batches: readonly QualityBatch[];
  readonly committedBatches: number;
  readonly duplicateBatches: number;
  readonly rejectedBatches: number;
  /** Total de linhas recusadas por erro em todos os lotes. */
  readonly rowsRejectedTotal: number;
  /** Total de linhas ignoradas por já existirem. */
  readonly rowsIgnoredTotal: number;
  readonly issueBreakdown: readonly IssueBreakdown[];
  /** Contagem de factos sem médico ou sem referência de paciente. */
  readonly missingPractitioner: number;
  readonly missingPatientRef: number;
  readonly totalFacts: number;
  /** Intervalo efetivamente coberto pelos dados. */
  readonly coverageFrom: Date | null;
  readonly coverageTo: Date | null;
  /** Meses dentro do intervalo que não têm uma única consulta. */
  readonly monthsWithoutData: readonly string[];
  readonly usesSyntheticProfileOnly: boolean;
}

/** Rótulos legíveis para os códigos de erro do validador. */
const ISSUE_LABELS: Record<string, string> = {
  DATE_MISSING: "Data em falta",
  DATE_FORMAT_INVALID: "Formato de data não reconhecido",
  DATE_OUT_OF_RANGE: "Data inexistente no calendário",
  DATE_INVALID: "Data inválida",
  CLINIC_ID_MISSING: "ID da clínica em falta",
  CLINIC_UNKNOWN: "Clínica desconhecida na organização",
  PRACTITIONER_UNKNOWN: "Médico desconhecido na organização",
  STATUS_MISSING: "Estado em falta",
  STATUS_UNMAPPED: "Estado sem mapeamento no perfil",
  DURATION_INVALID: "Duração não numérica",
  ROW_DUPLICATE_IN_FILE: "Linha repetida dentro do ficheiro",
};

interface MonthRow {
  month: string;
}

export async function getDataQualityReport(
  organizationId: string,
  timeZone: string,
): Promise<DataQualityReport> {
  const [rawBatches, issues, facts, coverage, missingPractitioner, missingPatientRef] =
    await Promise.all([
      prisma.importBatch.findMany({
        where: { organizationId },
        orderBy: { uploadedAt: "desc" },
        include: { importProfile: { select: { key: true, isSynthetic: true } } },
      }),
      prisma.importRowError.groupBy({
        by: ["code", "severity"],
        where: { importBatch: { organizationId } },
        _count: { _all: true },
      }),
      prisma.appointmentFact.count({ where: { organizationId } }),
      prisma.appointmentFact.aggregate({
        where: { organizationId },
        _min: { occurredAt: true },
        _max: { occurredAt: true },
      }),
      prisma.appointmentFact.count({ where: { organizationId, practitionerId: null } }),
      prisma.appointmentFact.count({ where: { organizationId, patientExternalRef: null } }),
    ]);

  const batches: QualityBatch[] = rawBatches.map((batch) => ({
    id: batch.id,
    originalFilename: batch.originalFilename,
    shortHash: batch.fileHash.slice(0, 12),
    status: batch.status,
    rowsTotal: batch.rowsTotal,
    rowsValid: batch.rowsValid,
    rowsInvalid: batch.rowsInvalid,
    rowsCommitted: batch.rowsCommitted,
    rowsIgnored:
      batch.status === "COMMITTED"
        ? Math.max(batch.rowsTotal - batch.rowsInvalid - batch.rowsCommitted, 0)
        : 0,
    uploadedAt: batch.uploadedAt,
    committedAt: batch.committedAt,
    failureReason: batch.failureReason,
    profileKey: batch.importProfile?.key ?? null,
    profileIsSynthetic: batch.importProfile?.isSynthetic ?? true,
  }));

  // Meses sem dados dentro do intervalo coberto. Um buraco no meio da série é
  // um sinal de ficheiro em falta, não de uma clínica parada.
  let monthsWithoutData: string[] = [];
  if (coverage._min.occurredAt && coverage._max.occurredAt) {
    const present = await prisma.$queryRawUnsafe<MonthRow[]>(
      `SELECT DISTINCT to_char(
         date_trunc('month', ("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE $2),
         'YYYY-MM'
       ) AS month
       FROM "appointment_facts"
       WHERE "organizationId" = $1`,
      organizationId,
      timeZone,
    );
    const presentMonths = new Set(present.map((row) => row.month));

    const cursor = new Date(coverage._min.occurredAt);
    const end = new Date(coverage._max.occurredAt);
    let year = cursor.getUTCFullYear();
    let month = cursor.getUTCMonth() + 1;

    while (year * 12 + month <= end.getUTCFullYear() * 12 + end.getUTCMonth() + 1) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      if (!presentMonths.has(key)) {
        monthsWithoutData.push(key);
      }
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  monthsWithoutData = monthsWithoutData.sort();

  return {
    batches,
    committedBatches: batches.filter((batch) => batch.status === "COMMITTED").length,
    duplicateBatches: batches.filter((batch) => batch.status === "DUPLICATE").length,
    rejectedBatches: batches.filter((batch) => batch.status === "REJECTED").length,
    rowsRejectedTotal: batches.reduce((sum, batch) => sum + batch.rowsInvalid, 0),
    rowsIgnoredTotal: batches.reduce((sum, batch) => sum + batch.rowsIgnored, 0),
    issueBreakdown: issues
      .map((issue) => ({
        code: issue.code,
        label: ISSUE_LABELS[issue.code] ?? issue.code,
        count: issue._count._all,
        severity: issue.severity,
      }))
      .sort((a, b) => b.count - a.count),
    missingPractitioner,
    missingPatientRef,
    totalFacts: facts,
    coverageFrom: coverage._min.occurredAt,
    coverageTo: coverage._max.occurredAt,
    monthsWithoutData,
    usesSyntheticProfileOnly: batches.every((batch) => batch.profileIsSynthetic),
  };
}
