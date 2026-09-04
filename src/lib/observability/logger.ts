/**
 * Logger estruturado com allowlist de campos.
 *
 * Regra do produto: nunca registar nomes, contactos ou conteúdo de ficheiros.
 * Em vez de confiar em quem chama, o logger só deixa passar campos conhecidos —
 * um `patientName` acidental é descartado em vez de aparecer nos logs.
 */

const ALLOWED_FIELDS = [
  "organizationId",
  "clinicId",
  "practitionerId",
  "importBatchId",
  "importProfileKey",
  "importProfileVersion",
  "sourceType",
  "status",
  "durationMs",
  "rowsTotal",
  "rowsValid",
  "rowsInvalid",
  "rowsCommitted",
  "errorCode",
  "kpiKey",
  "definitionVersion",
] as const;

export type LogField = (typeof ALLOWED_FIELDS)[number];
export type LogContext = Partial<Record<LogField, string | number | boolean | null>>;

export type LogLevel = "debug" | "info" | "warn" | "error";

function pickAllowed(context: LogContext): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    const value = context[field];
    if (value !== undefined) {
      safe[field] = value;
    }
  }
  return safe;
}

function emit(level: LogLevel, message: string, context: LogContext = {}): void {
  const line = JSON.stringify({
    level,
    message,
    at: new Date().toISOString(),
    ...pickAllowed(context),
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
