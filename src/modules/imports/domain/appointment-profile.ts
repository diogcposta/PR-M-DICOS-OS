/**
 * Perfil de mapeamento para exportações de agenda.
 *
 * ATENÇÃO: os cabeçalhos aqui usados são **sintéticos**. Não conhecemos os
 * cabeçalhos reais do Newsoft e não os vamos inventar — o perfil real será
 * criado na Fase 4, a partir de uma exportação anonimizada. Até lá o perfil fica
 * marcado com `isSynthetic: true` e o ecrã diz isso ao utilizador.
 */
import { z } from "zod";

import { normalizeLabel } from "@/modules/imports/domain/normalizers";

export const appointmentStatuses = [
  "SCHEDULED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
  "RESCHEDULED",
] as const;

export type AppointmentStatusValue = (typeof appointmentStatuses)[number];

/** Campos canónicos de uma consulta e se são obrigatórios. */
export const APPOINTMENT_FIELDS = {
  sourceRecordId: { label: "ID do registo na origem", required: false },
  occurredAt: { label: "Data/hora da consulta", required: true },
  clinicExternalId: { label: "ID da clínica", required: true },
  practitionerExternalId: { label: "ID do médico", required: false },
  patientExternalRef: { label: "Referência do paciente (pseudonimizada)", required: false },
  status: { label: "Estado da consulta", required: true },
  durationMinutes: { label: "Duração (minutos)", required: false },
} as const;

export type AppointmentField = keyof typeof APPOINTMENT_FIELDS;

export const appointmentFieldKeys = Object.keys(APPOINTMENT_FIELDS) as readonly AppointmentField[];

export function isRequiredField(field: AppointmentField): boolean {
  return APPOINTMENT_FIELDS[field].required;
}

/**
 * Mapeamento coluna-do-ficheiro → campo canónico.
 * `null` significa "coluna não mapeada", que é diferente de "coluna ausente".
 */
export const appointmentMappingSchema = z.object({
  columns: z.record(z.enum(appointmentFieldKeys as [AppointmentField, ...AppointmentField[]]), z.string().nullable()),
  /** Rótulo da origem → estado normalizado. Rótulo desconhecido é erro, não UNKNOWN. */
  statusLabels: z.record(z.string(), z.enum(appointmentStatuses)),
});

export type AppointmentMapping = z.infer<typeof appointmentMappingSchema>;

/**
 * Perfil sintético por omissão.
 *
 * Serve para demonstrar o fluxo com as fixtures deste repositório e como ponto
 * de partida editável no ecrã. Não representa o Newsoft.
 */
export const SYNTHETIC_APPOINTMENT_PROFILE_KEY = "agenda-sintetica";
export const SYNTHETIC_APPOINTMENT_PROFILE_VERSION = 1;

export const SYNTHETIC_APPOINTMENT_MAPPING: AppointmentMapping = {
  columns: {
    sourceRecordId: "id_consulta",
    occurredAt: "data_hora",
    clinicExternalId: "id_clinica",
    practitionerExternalId: "id_medico",
    patientExternalRef: "ref_paciente",
    status: "estado",
    durationMinutes: "duracao_min",
  },
  statusLabels: {
    agendada: "SCHEDULED",
    marcada: "SCHEDULED",
    realizada: "COMPLETED",
    efetuada: "COMPLETED",
    concluida: "COMPLETED",
    faltou: "NO_SHOW",
    falta: "NO_SHOW",
    cancelada: "CANCELLED",
    anulada: "CANCELLED",
    remarcada: "RESCHEDULED",
  },
};

/**
 * Sugere um mapeamento a partir dos cabeçalhos encontrados no ficheiro.
 *
 * É só uma sugestão para poupar cliques: o utilizador vê e corrige o mapeamento
 * antes de validar. Uma coluna que não se reconheça fica `null`, nunca adivinhada.
 */
const FIELD_SYNONYMS: Record<AppointmentField, readonly string[]> = {
  sourceRecordId: ["id_consulta", "id consulta", "id", "codigo", "referencia"],
  occurredAt: ["data_hora", "data hora", "data", "data consulta", "datahora"],
  clinicExternalId: ["id_clinica", "id clinica", "clinica", "unidade"],
  practitionerExternalId: ["id_medico", "id medico", "medico", "profissional"],
  patientExternalRef: ["ref_paciente", "ref paciente", "paciente", "utente"],
  status: ["estado", "situacao", "status"],
  durationMinutes: ["duracao_min", "duracao", "duracao minutos", "minutos"],
};

export function suggestAppointmentMapping(headers: readonly string[]): AppointmentMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeLabel(header) ?? "",
  }));

  const columns = {} as Record<AppointmentField, string | null>;

  for (const field of appointmentFieldKeys) {
    const synonyms = FIELD_SYNONYMS[field];
    const match = normalizedHeaders.find((header) => synonyms.includes(header.normalized));
    columns[field] = match?.original ?? null;
  }

  return { columns, statusLabels: SYNTHETIC_APPOINTMENT_MAPPING.statusLabels };
}
