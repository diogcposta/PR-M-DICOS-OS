/**
 * Vocabulário do módulo "Produção clínica".
 *
 * Os valores são guardados como texto (SQLite não tem enums nativos e o esquema
 * tem de migrar sem alterações para PostgreSQL); estes tuplos são a única lista
 * válida e alimentam os esquemas Zod da camada de aplicação.
 */

export const PROCEDURE_CATEGORIES = [
  "Consulta",
  "Diagnóstico",
  "Dentisteria",
  "Endodontia",
  "Retratamento endodôntico",
  "Periodontologia",
  "Higiene oral",
  "Cirurgia",
  "Implantologia",
  "Prótese fixa",
  "Coroa",
  "Onlay/Overlay",
  "Prótese removível",
  "Estética",
  "Urgência",
  "Controlo",
  "Outro",
] as const;
export type ProcedureCategory = (typeof PROCEDURE_CATEGORIES)[number];

export const PAYER_TYPES = ["PRIVATE", "INSURANCE", "AGREEMENT"] as const;
export type PayerType = (typeof PAYER_TYPES)[number];

export const PAYER_LABELS: Record<PayerType, string> = {
  PRIVATE: "Particular",
  INSURANCE: "Seguro",
  AGREEMENT: "Convenção",
};

/** Seguro e convenção são tratados em conjunto quando comparados com particular. */
export function isThirdPartyPayer(payerType: string): boolean {
  return payerType === "INSURANCE" || payerType === "AGREEMENT";
}

export const ABSENCE_KINDS = ["NO_SHOW", "LATE_CANCEL", "EARLY_CANCEL"] as const;
export type AbsenceKind = (typeof ABSENCE_KINDS)[number];

export const ABSENCE_LABELS: Record<AbsenceKind, string> = {
  NO_SHOW: "Falta",
  LATE_CANCEL: "Cancelamento tardio",
  EARLY_CANCEL: "Cancelamento antecipado",
};

export const PLAN_STATUSES = [
  "PRESENTED",
  "PARTIALLY_ACCEPTED",
  "ACCEPTED",
  "REJECTED",
  "PENDING",
  "COMPLETED",
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  PRESENTED: "Apresentado",
  PARTIALLY_ACCEPTED: "Parcialmente aceite",
  ACCEPTED: "Aceite",
  REJECTED: "Rejeitado",
  PENDING: "Pendente",
  COMPLETED: "Concluído",
};

export const DAY_STATUSES = ["WORKED", "PLANNED"] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

/** Durações de slot suportadas pela agenda. */
export const SLOT_OPTIONS = [30, 45, 60, 90, 120] as const;

/** Formato do Case ID. Nunca conter nome, número de utente ou contacto. */
export const CASE_CODE_PATTERN = /^[A-Z]{2,4}-\d{4}-\d{3,5}$/;
