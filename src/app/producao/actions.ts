"use server";

/**
 * Server actions do módulo de produção: só composição — converter o formulário,
 * chamar o serviço de aplicação e devolver mensagens compreensíveis.
 * Nenhuma regra de negócio vive aqui.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import * as commands from "@/modules/production/application/commands";
import { CommandError } from "@/modules/production/application/commands";
import { InputError } from "@/modules/production/application/parse";
import { replaceGoals, replaceSchedule, replaceScenarios, updateSettings } from "@/modules/production/application/profile";
import {
  absenceSchema,
  clinicalDaySchema,
  fieldErrors,
  formDataToObject,
  planSchema,
  procedureSchema,
  sessionSchema,
  settingsSchema,
  templateSchema,
} from "@/modules/production/application/schemas";
import { parseGoalsForm, parseScenariosForm, parseScheduleForm } from "@/modules/production/application/settings-form";
import { todayInLisbon } from "@/modules/production/domain/time";

export interface ActionState {
  readonly ok: boolean;
  readonly message: string;
  readonly errors: Record<string, string>;
  readonly values: Record<string, string>;
  /** Identificador do registo criado (para ligações "ver"). */
  readonly id?: string;
  /** Muda a cada submissão com sucesso, para os formulários limparem campos. */
  readonly nonce?: number;
}

const refresh = () => revalidatePath("/producao", "layout");

function failure(values: Record<string, string>, error: unknown): ActionState {
  if (error instanceof CommandError) {
    return { ok: false, message: error.message, errors: { [error.field]: error.message }, values };
  }
  if (error instanceof InputError) {
    return { ok: false, message: error.message, errors: {}, values };
  }
  console.error("Erro inesperado no módulo de produção:", error instanceof Error ? error.name : "desconhecido");
  return { ok: false, message: "Não foi possível gravar. Tente novamente.", errors: {}, values };
}

async function run<T>(
  formData: FormData,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: import("zod").ZodError } },
  save: (data: T) => Promise<{ id?: string } | void>,
  message: string,
): Promise<ActionState> {
  const values = formDataToObject(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos assinalados.", errors: fieldErrors(parsed.error), values };
  }
  try {
    const result = await save(parsed.data);
    refresh();
    return { ok: true, message, errors: {}, values: {}, id: result?.id, nonce: Date.now() };
  } catch (error) {
    return failure(values, error);
  }
}

export async function saveDayAction(_: ActionState | null, formData: FormData): Promise<ActionState> {
  return run(formData, clinicalDaySchema, (d) => commands.saveClinicalDay(d), "Dia clínico gravado.");
}

export async function createProcedureAction(_: ActionState | null, formData: FormData): Promise<ActionState> {
  return run(formData, procedureSchema, (d) => commands.createProcedure(d), "Procedimento registado.");
}

export async function updateProcedureAction(id: string, _: ActionState | null, formData: FormData): Promise<ActionState> {
  return run(formData, procedureSchema, (d) => commands.updateProcedure(id, d), "Procedimento atualizado.");
}

export async function addSessionAction(procedureId: string, _: ActionState | null, formData: FormData): Promise<ActionState> {
  return run(formData, sessionSchema, (d) => commands.addSession(procedureId, d), "Consulta adicionada.");
}

export async function createAbsenceAction(_: ActionState | null, formData: FormData): Promise<ActionState> {
  return run(formData, absenceSchema, (d) => commands.createAbsence(d), "Falta registada.");
}

export async function createPlanAction(_: ActionState | null, formData: FormData): Promise<ActionState> {
  return run(formData, planSchema, (d) => commands.createPlan(d), "Plano registado.");
}

export async function updatePlanAction(id: string, _: ActionState | null, formData: FormData): Promise<ActionState> {
  return run(formData, planSchema, (d) => commands.updatePlan(id, d), "Plano atualizado.");
}

export async function saveTemplateAction(_: ActionState | null, formData: FormData): Promise<ActionState> {
  return run(formData, templateSchema, (d) => commands.saveTemplate(d), "Template gravado.");
}

export async function saveSettingsAction(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const values = formDataToObject(formData);
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos assinalados.", errors: fieldErrors(parsed.error), values };
  }
  try {
    const schedule = parseScheduleForm(values);
    const goals = parseGoalsForm(values);
    const scenarios = parseScenariosForm(values);
    await updateSettings(parsed.data);
    await replaceSchedule(schedule);
    await replaceGoals(goals);
    await replaceScenarios(scenarios);
    refresh();
    return { ok: true, message: "Definições gravadas.", errors: {}, values: {}, nonce: Date.now() };
  } catch (error) {
    return failure(values, error);
  }
}

// Ações simples (botões): sem estado de formulário.

export async function deleteProcedureAction(id: string) {
  await commands.deleteProcedure(id);
  refresh();
  redirect("/producao/procedimentos");
}

export async function deleteSessionAction(id: string) {
  await commands.deleteSession(id);
  refresh();
}

export async function deleteDayAction(id: string) {
  await commands.deleteClinicalDay(id);
  refresh();
}

export async function deleteAbsenceAction(id: string) {
  await commands.deleteAbsence(id);
  refresh();
}

export async function deletePlanAction(id: string) {
  await commands.deletePlan(id);
  refresh();
  redirect("/producao/planos");
}

export async function markPlanContactedAction(id: string) {
  await commands.markPlanContacted(id, todayInLisbon());
  refresh();
}

export async function toggleFavoriteAction(id: string) {
  await commands.toggleTemplateFavorite(id);
  refresh();
}

export async function deleteTemplateAction(id: string) {
  await commands.deleteTemplate(id);
  refresh();
}

// Importação CSV: o ficheiro é reenviado pelo browser em cada passo (D-016);
// o servidor não guarda o conteúdo, só o SHA-256 e as contagens.

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function previewImportAction(entity: string, content: string) {
  const { ENTITIES, previewImport } = await import("@/modules/production/application/data-transfer");
  if (!ENTITIES.includes(entity as (typeof ENTITIES)[number])) return { ok: false as const, message: "Tipo de dados desconhecido." };
  if (content.length > MAX_IMPORT_BYTES) return { ok: false as const, message: "Ficheiro demasiado grande (máx. 5 MB)." };
  return { ok: true as const, preview: await previewImport(entity as (typeof ENTITIES)[number], content) };
}

export async function commitImportAction(entity: string, content: string, filename: string, allowPartial: boolean) {
  const { ENTITIES, ImportRefused, commitImport } = await import("@/modules/production/application/data-transfer");
  if (!ENTITIES.includes(entity as (typeof ENTITIES)[number])) return { ok: false as const, message: "Tipo de dados desconhecido." };
  if (content.length > MAX_IMPORT_BYTES) return { ok: false as const, message: "Ficheiro demasiado grande (máx. 5 MB)." };
  try {
    const outcome = await commitImport(entity as (typeof ENTITIES)[number], content, filename, { allowPartial });
    refresh();
    return {
      ok: true as const,
      message: `Importação concluída: ${outcome.imported} importadas, ${outcome.skipped} ignoradas (já existiam), ${outcome.invalid} inválidas.`,
    };
  } catch (error) {
    if (error instanceof ImportRefused) return { ok: false as const, message: error.message };
    console.error("Falha na importação:", error instanceof Error ? error.name : "desconhecido");
    return { ok: false as const, message: "A importação falhou e nada foi gravado." };
  }
}
