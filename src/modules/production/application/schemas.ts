/**
 * Contratos de entrada (Zod). Toda a validação acontece aqui, antes de gravar;
 * as mensagens são para o médico, em linguagem simples.
 */
import { z } from "zod";

import {
  ABSENCE_KINDS,
  CASE_CODE_PATTERN,
  DAY_STATUSES,
  PAYER_TYPES,
  PLAN_STATUSES,
  PROCEDURE_CATEGORIES,
} from "../domain/constants";
import { isValidCivilDate, isValidTime, parseTime } from "../domain/time";

import { InputError, assertNoPersonalData, parseEuros, parsePercentToBps } from "./parse";

const civilDate = z
  .string({ error: "Data em falta." })
  .trim()
  .refine(isValidCivilDate, "Data inválida.");

const time = z
  .string({ error: "Hora em falta." })
  .trim()
  .refine(isValidTime, "Hora inválida (use HH:mm).")
  .transform(parseTime);

const optionalTime = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!isValidTime(v)) {
      ctx.addIssue({ code: "custom", message: "Hora inválida (use HH:mm)." });
      return z.NEVER;
    }
    return parseTime(v);
  });

function money(label: string, options: { optional?: boolean } = {}) {
  return z
    .string()
    .optional()
    .transform((v, ctx) => {
      const text = (v ?? "").trim();
      if (text === "") {
        if (options.optional) return 0;
        ctx.addIssue({ code: "custom", message: `${label}: valor em falta.` });
        return z.NEVER;
      }
      try {
        const cents = parseEuros(text);
        if (cents < 0) {
          ctx.addIssue({ code: "custom", message: `${label}: não pode ser negativo.` });
          return z.NEVER;
        }
        return cents;
      } catch (error) {
        ctx.addIssue({ code: "custom", message: error instanceof InputError ? error.message : "Valor inválido." });
        return z.NEVER;
      }
    });
}

const caseCode = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    const text = (v ?? "").toUpperCase();
    if (text === "") return null;
    if (!CASE_CODE_PATTERN.test(text)) {
      ctx.addIssue({ code: "custom", message: "Case ID inválido. Formato: DC-2026-001 (sem nomes)." });
      return z.NEVER;
    }
    return text;
  });

function safeText(label: string, max = 200) {
  return z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres.`)
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      try {
        assertNoPersonalData(v, label);
      } catch (error) {
        ctx.addIssue({ code: "custom", message: (error as Error).message });
        return z.NEVER;
      }
      return v;
    });
}

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("false"), z.literal("0"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1");

const positiveInt = (label: string, min = 1, max = 100) =>
  z.coerce
    .number({ error: `${label}: número inválido.` })
    .int(`${label}: tem de ser inteiro.`)
    .min(min, `${label}: mínimo ${min}.`)
    .max(max, `${label}: máximo ${max}.`);

export const clinicalDaySchema = z
  .object({
    date: civilDate,
    start: time,
    end: time,
    breakMinutes: positiveInt("Pausa", 0, 600),
    status: z.enum(DAY_STATUSES).default("WORKED"),
    note: safeText("Nota"),
  })
  .superRefine((v, ctx) => {
    if (v.end <= v.start) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "A hora de fim tem de ser posterior à de início." });
    } else if (v.breakMinutes >= v.end - v.start) {
      ctx.addIssue({ code: "custom", path: ["breakMinutes"], message: "A pausa não pode ocupar o dia inteiro." });
    }
  });
export type ClinicalDayInput = z.infer<typeof clinicalDaySchema>;

export const procedureSchema = z
  .object({
    date: civilDate,
    caseCode,
    procedureType: z.string().trim().min(1, "Indique o procedimento.").max(80),
    category: z.enum(PROCEDURE_CATEGORIES, { error: "Escolha uma categoria." }),
    listPrice: money("Valor tabelado", { optional: true }),
    billed: money("Valor faturado"),
    payerType: z.enum(PAYER_TYPES).default("PRIVATE"),
    payerName: safeText("Seguradora/convenção", 80),
    start: optionalTime,
    end: optionalTime,
    plannedVisits: positiveInt("Consultas necessárias", 1, 30),
    labCost: money("Custo de laboratório", { optional: true }),
    otherCost: money("Outros custos", { optional: true }),
    note: safeText("Observação"),
    completed: checkbox,
  })
  .superRefine((v, ctx) => {
    if ((v.start === null) !== (v.end === null)) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "Indique a hora de início e a de fim (ou nenhuma)." });
    } else if (v.start !== null && v.end !== null && v.end <= v.start) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "A hora de fim tem de ser posterior à de início." });
    }
    if (v.payerType !== "PRIVATE" && !v.payerName) {
      ctx.addIssue({ code: "custom", path: ["payerName"], message: "Indique a seguradora ou convenção." });
    }
  })
  .transform((v) => ({ ...v, listPrice: v.listPrice === 0 ? v.billed : v.listPrice }));
export type ProcedureInput = z.infer<typeof procedureSchema>;

export const sessionSchema = z
  .object({ date: civilDate, start: time, end: time })
  .superRefine((v, ctx) => {
    if (v.end <= v.start) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "A hora de fim tem de ser posterior à de início." });
    }
  });
export type SessionInput = z.infer<typeof sessionSchema>;

export const absenceSchema = z
  .object({
    date: civilDate,
    start: time,
    durationMinutes: positiveInt("Duração prevista", 5, 480),
    plannedProcedure: safeText("Procedimento previsto", 80),
    estimatedValue: money("Valor estimado", { optional: true }),
    payerType: z.enum(PAYER_TYPES).default("PRIVATE"),
    kind: z.enum(ABSENCE_KINDS, { error: "Escolha o tipo." }),
    slotRecovered: checkbox,
    recoveredValue: money("Receita recuperada", { optional: true }),
  })
  .superRefine((v, ctx) => {
    if (!v.slotRecovered && v.recoveredValue > 0) {
      ctx.addIssue({ code: "custom", path: ["recoveredValue"], message: "Só há receita recuperada se o slot foi ocupado." });
    }
    if (v.start + v.durationMinutes > 24 * 60) {
      ctx.addIssue({ code: "custom", path: ["durationMinutes"], message: "A falta não pode passar da meia-noite." });
    }
  });
export type AbsenceInput = z.infer<typeof absenceSchema>;

export const planSchema = z
  .object({
    caseCode: caseCode.refine((v) => v !== null, "O plano precisa de um Case ID."),
    presentedDate: civilDate,
    diagnosed: money("Valor diagnosticado", { optional: true }),
    total: money("Valor total"),
    phases: positiveInt("Número de fases", 1, 20),
    status: z.enum(PLAN_STATUSES),
    accepted: money("Valor aceite", { optional: true }),
    performed: money("Valor realizado", { optional: true }),
    lastContactDate: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        if (!isValidCivilDate(v)) {
          ctx.addIssue({ code: "custom", message: "Data do último contacto inválida." });
          return z.NEVER;
        }
        return v;
      }),
    nextAppointmentBooked: checkbox,
    note: safeText("Observação"),
  })
  .superRefine((v, ctx) => {
    if (v.accepted > v.total) {
      ctx.addIssue({ code: "custom", path: ["accepted"], message: "O valor aceite não pode exceder o total." });
    }
    if (v.performed > Math.max(v.accepted, 0) && v.status !== "COMPLETED") {
      ctx.addIssue({ code: "custom", path: ["performed"], message: "O valor realizado não pode exceder o aceite." });
    }
    if ((v.status === "ACCEPTED" || v.status === "PARTIALLY_ACCEPTED") && v.accepted === 0) {
      ctx.addIssue({ code: "custom", path: ["accepted"], message: "Indique o valor aceite." });
    }
    if (v.status === "ACCEPTED" && v.accepted !== v.total) {
      ctx.addIssue({ code: "custom", path: ["accepted"], message: "Plano aceite: o valor aceite deve ser igual ao total (ou use 'parcialmente aceite')." });
    }
    if (v.status === "REJECTED" && v.accepted > 0) {
      ctx.addIssue({ code: "custom", path: ["accepted"], message: "Um plano rejeitado não tem valor aceite." });
    }
    if (v.lastContactDate && v.lastContactDate < v.presentedDate) {
      ctx.addIssue({ code: "custom", path: ["lastContactDate"], message: "O último contacto não pode ser anterior à apresentação." });
    }
  })
  .transform((v) => ({
    ...v,
    caseCode: v.caseCode as string,
    diagnosed: Math.max(v.diagnosed, v.total),
    // Concluído sem valor aceite explícito: assume-se o total aceite e realizado.
    accepted: v.status === "COMPLETED" && v.accepted === 0 ? v.total : v.accepted,
    performed: v.status === "COMPLETED" && v.performed === 0 ? (v.accepted || v.total) : v.performed,
  }));
export type PlanInput = z.infer<typeof planSchema>;

export const settingsSchema = z.object({
  name: z.string().trim().min(1, "Indique o nome.").max(80),
  feePercent: z.string().transform((v, ctx) => {
    try {
      return parsePercentToBps(v);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
  }),
  feeBase: z.enum(["BILLED", "NET"]),
  standardSlotMinutes: positiveInt("Consulta standard", 10, 240),
  saturdayMinutes: positiveInt("Sábado", 0, 720),
  primaryGoal: money("Objetivo principal"),
  targetNoShowPercent: z.string().transform((v, ctx) => {
    try {
      return parsePercentToBps(v);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
  }),
  followUpMin: money("Follow-up a partir de"),
  followUpPriority: money("Follow-up prioritário a partir de"),
  followUpFirstAlertDays: positiveInt("Primeiro alerta", 1, 365),
  followUpSecondAlertDays: positiveInt("Segundo alerta", 1, 365),
}).superRefine((v, ctx) => {
  if (v.followUpSecondAlertDays <= v.followUpFirstAlertDays) {
    ctx.addIssue({ code: "custom", path: ["followUpSecondAlertDays"], message: "O segundo alerta tem de vir depois do primeiro." });
  }
  if (v.followUpPriority < v.followUpMin) {
    ctx.addIssue({ code: "custom", path: ["followUpPriority"], message: "O limiar prioritário deve ser ≥ ao limiar de follow-up." });
  }
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Indique o nome.").max(80),
  category: z.enum(PROCEDURE_CATEGORIES),
  price: money("Preço"),
  durationMinutes: positiveInt("Duração", 5, 600),
  plannedVisits: positiveInt("Consultas", 1, 30),
  labCost: money("Laboratório", { optional: true }),
  payerType: z.enum(PAYER_TYPES).default("PRIVATE"),
  favorite: checkbox,
});
export type TemplateInput = z.infer<typeof templateSchema>;

/** Exame complementar (ortopantomografia, CBCT…): tipo, data e valor; Case ID opcional. */
export const examSchema = z.object({
  date: civilDate,
  examType: z.string().trim().min(1, "Indique o exame.").max(80, "Exame: máximo 80 caracteres."),
  caseCode,
  billed: money("Valor do exame").refine((v) => v > 0, "Valor do exame: tem de ser maior que zero."),
  note: safeText("Observação"),
});
export type ExamInput = z.infer<typeof examSchema>;

/** Tipo de exame nas Definições, com o valor habitual (vazio = sem valor predefinido). */
export const examTypeSchema = z.object({
  name: z.string().trim().min(1, "Indique o nome do exame.").max(80, "Nome: máximo 80 caracteres."),
  price: money("Valor habitual", { optional: true }),
});
export type ExamTypeInput = z.infer<typeof examTypeSchema>;

/** Horas "130,5", "130.5" ou "130:30" → minutos; vazio → null. */
const optionalHours = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const hm = /^(\d{1,4}):([0-5]\d)$/.exec(v);
    const dec = /^\d{1,4}([.,]\d{1,2})?$/.test(v) ? Number(v.replace(",", ".")) : null;
    const minutes = hm ? Number(hm[1]) * 60 + Number(hm[2]) : dec === null ? null : Math.round(dec * 60);
    if (minutes === null || minutes > 744 * 60) {
      ctx.addIssue({ code: "custom", message: "Horas inválidas (ex.: 130,5 ou 130:30)." });
      return z.NEVER;
    }
    return minutes;
  });

/** Fecho do mês: total da folha de honorários (atos e exames); produção e horas só para meses sem registos. */
export const closingSchema = z.object({
  month: z
    .string({ error: "Mês em falta." })
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido."),
  received: money("Total recebido").refine((v) => v > 0, "Total recebido: tem de ser maior que zero."),
  production: money("Valor pago pelos pacientes", { optional: true }).transform((v) => (v === 0 ? null : v)),
  hours: optionalHours,
  note: safeText("Nota"),
});
export type ClosingInput = z.infer<typeof closingSchema>;

/** Converte FormData num objeto simples de strings (o que os esquemas esperam). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

/** Erros do Zod por campo, primeira mensagem de cada. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
