/**
 * API do servidor Apps Script: validação (os mesmos esquemas Zod da app Next),
 * regras que dependem dos dados (sobreposição de consultas) e escrita no Sheets.
 *
 * Todas as funções devolvem `ApiResult` e, nas escritas, os dados atualizados —
 * o iPhone faz uma só ida ao servidor por ação.
 */
import type { ZodError } from "zod";

import { DEFAULT_EXAM_TYPES, DEFAULT_GOALS, DEFAULT_PROFILE, DEFAULT_SCENARIOS, DEFAULT_SCHEDULE, DEFAULT_TEMPLATES } from "@/modules/production/application/defaults";
import { InputError } from "@/modules/production/application/parse";
import {
  absenceSchema,
  clinicalDaySchema,
  examSchema,
  examTypeSchema,
  fieldErrors,
  planSchema,
  procedureSchema,
  sessionSchema,
  settingsSchema,
  templateSchema,
} from "@/modules/production/application/schemas";
import { parseGoalsForm, parseScenariosForm, parseScheduleForm } from "@/modules/production/application/settings-form";
import { buildDemoDataset } from "@/modules/production/demo/dataset";
import { findOverlap, formatTime } from "@/modules/production/domain/time";

import { SheetDb, type SpreadsheetLike } from "./sheets";
import { TABLES, type Row, type TableKey } from "./tables";

export interface Env {
  readonly spreadsheet: SpreadsheetLike;
  /** Endereço da folha (para a abrir a partir da app). */
  spreadsheetUrl(): string;
  newId(): string;
  /** Data civil de hoje em Europe/Lisbon. */
  today(): string;
  nowIso(): string;
  withLock<T>(fn: () => T): T;
}

export interface ApiResult {
  readonly ok: boolean;
  readonly message: string;
  readonly errors: Record<string, string>;
  readonly data?: AppData;
}

export interface AppData {
  readonly today: string;
  readonly spreadsheetUrl: string;
  readonly profile: Row;
  readonly schedule: Row[];
  readonly goals: Row[];
  readonly scenarios: Row[];
  readonly templates: Row[];
  readonly days: Row[];
  readonly procedures: Row[];
  readonly sessions: Row[];
  readonly absences: Row[];
  readonly plans: Row[];
  readonly exams: Row[];
  readonly examTypes: Row[];
}

class RuleError extends Error {
  constructor(message: string, readonly field = "_form") {
    super(message);
  }
}

type Form = Record<string, string>;

export class Api {
  private readonly db: SheetDb;

  constructor(private readonly env: Env) {
    this.db = new SheetDb(env.spreadsheet);
  }

  // -------------------------------------------------------------------------
  // Configuração e leitura
  // -------------------------------------------------------------------------

  /** Cria os separadores e o perfil com os valores iniciais. Idempotente. */
  setup(): string[] {
    return this.env.withLock(() => {
      const created = this.ensureTables();
      this.ensureProfile();
      return created;
    });
  }

  /** Cria os separadores em falta; um separador de tipos de exame novo recebe os tipos iniciais. */
  private ensureTables(): string[] {
    const created = this.db.ensureTables();
    if (created.includes(TABLES.examTypes.name)) {
      this.db.insertMany("examTypes", DEFAULT_EXAM_TYPES.map((t) => ({ id: this.env.newId(), ...t })));
    }
    return created;
  }

  private ensureProfile(): Row {
    const existing = this.db.read("profile")[0];
    if (existing) return existing;
    const profile: Row = { id: this.env.newId(), ...DEFAULT_PROFILE };
    this.db.insert("profile", profile);
    this.db.insertMany("schedule", DEFAULT_SCHEDULE.map((b) => ({ id: this.env.newId(), ...b })));
    this.db.insertMany("goals", DEFAULT_GOALS.map((g, i) => ({ id: this.env.newId(), ...g, sortOrder: i })));
    this.db.insertMany("scenarios", DEFAULT_SCENARIOS.map((s, i) => ({ id: this.env.newId(), ...s, sortOrder: i })));
    this.db.insertMany("templates", DEFAULT_TEMPLATES.map((t) => ({ id: this.env.newId(), ...t, payerType: "PRIVATE" })));
    return profile;
  }

  /** Carrega todas as tabelas numa só leitura; sem isso, garante que os separadores existem. */
  private load(): void {
    if (!this.db.preload()) this.ensureTables();
  }

  getData(): AppData {
    this.load();
    const profile = this.ensureProfile();
    const bySort = (a: Row, b: Row) => Number(a.sortOrder) - Number(b.sortOrder);
    return {
      today: this.env.today(),
      spreadsheetUrl: this.env.spreadsheetUrl(),
      profile,
      schedule: [...this.db.read("schedule")].sort((a, b) => Number(a.weekday) - Number(b.weekday) || Number(a.startMinute) - Number(b.startMinute)),
      goals: [...this.db.read("goals")].sort(bySort),
      scenarios: [...this.db.read("scenarios")].sort(bySort),
      templates: this.db.read("templates"),
      days: this.db.read("days"),
      procedures: this.db.read("procedures"),
      sessions: this.db.read("sessions"),
      absences: this.db.read("absences"),
      plans: this.db.read("plans"),
      exams: this.db.read("exams"),
      examTypes: [...this.db.read("examTypes")].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt")),
    };
  }

  // -------------------------------------------------------------------------
  // Infraestrutura das escritas
  // -------------------------------------------------------------------------

  private run<T>(
    form: Form,
    schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } },
    save: (data: T) => void,
    message: string,
  ): ApiResult {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      return { ok: false, message: "Verifique os campos assinalados.", errors: fieldErrors(parsed.error) };
    }
    return this.mutate(() => save(parsed.data), message);
  }

  private mutate(fn: () => void, message: string): ApiResult {
    try {
      this.env.withLock(() => {
        // Lido dentro do bloqueio: as validações veem os dados mais recentes.
        this.load();
        this.ensureProfile();
        fn();
      });
      // As escritas atualizam a cache da execução: não é preciso reler a folha.
      return { ok: true, message, errors: {}, data: this.getData() };
    } catch (error) {
      if (error instanceof RuleError) return { ok: false, message: error.message, errors: { [error.field]: error.message } };
      if (error instanceof InputError) return { ok: false, message: error.message, errors: {} };
      return { ok: false, message: error instanceof Error ? error.message : "Não foi possível gravar.", errors: {} };
    }
  }

  private find(key: TableKey, id: string): Row {
    const row = this.db.read(key).find((r) => r.id === id);
    if (!row) throw new RuleError("Registo não encontrado (pode ter sido apagado noutro dispositivo).");
    return row;
  }

  /** Consultas sobrepostas no mesmo dia são recusadas (o tempo contaria a dobrar). */
  private assertNoOverlap(date: string, startMinute: number, endMinute: number, ignoreId?: string): void {
    const sameDay = this.db
      .read("sessions")
      .filter((s) => s.date === date && s.id !== ignoreId)
      .map((s) => ({ id: String(s.id), procedureId: String(s.procedureId), startMinute: Number(s.startMinute), endMinute: Number(s.endMinute) }));
    const clash = findOverlap({ startMinute, endMinute }, sameDay);
    if (clash) {
      const type = this.db.read("procedures").find((p) => p.id === clash.procedureId)?.procedureType ?? "procedimento";
      throw new RuleError(`Sobrepõe-se a outra consulta (${String(type)}, ${formatTime(clash.startMinute)}–${formatTime(clash.endMinute)}).`, "start");
    }
  }

  // -------------------------------------------------------------------------
  // Dias clínicos
  // -------------------------------------------------------------------------

  saveDay(form: Form): ApiResult {
    return this.run(form, clinicalDaySchema, (d) => {
      const row: Row = { date: d.date, startMinute: d.start, endMinute: d.end, breakMinutes: d.breakMinutes, status: d.status, note: d.note };
      const existing = this.db.read("days").find((r) => r.date === d.date);
      if (existing) this.db.update("days", String(existing.id), { ...row, id: String(existing.id) });
      else this.db.insert("days", { ...row, id: this.env.newId() });
    }, "Dia clínico gravado.");
  }

  deleteDay(id: string): ApiResult {
    return this.mutate(() => void this.db.remove("days", id), "Dia apagado.");
  }

  // -------------------------------------------------------------------------
  // Procedimentos e consultas
  // -------------------------------------------------------------------------

  createProcedure(form: Form): ApiResult {
    return this.run(form, procedureSchema, (p) => {
      if (p.start !== null && p.end !== null) this.assertNoOverlap(p.date, p.start, p.end);
      const id = this.env.newId();
      this.db.insert("procedures", {
        id,
        date: p.date,
        caseCode: p.caseCode,
        procedureType: p.procedureType,
        category: p.category,
        listPriceCents: p.listPrice,
        billedCents: p.billed,
        payerType: p.payerType,
        payerName: p.payerType === "PRIVATE" ? null : p.payerName,
        plannedVisits: p.plannedVisits,
        labCostCents: p.labCost,
        otherCostCents: p.otherCost,
        note: p.note,
        completed: p.completed,
        createdAt: this.env.nowIso(),
      });
      if (p.start !== null && p.end !== null) {
        this.db.insert("sessions", { id: this.env.newId(), procedureId: id, date: p.date, startMinute: p.start, endMinute: p.end });
      }
    }, "Procedimento registado.");
  }

  updateProcedure(id: string, form: Form): ApiResult {
    return this.run(form, procedureSchema, (p) => {
      const existing = this.find("procedures", id);
      this.db.update("procedures", id, {
        ...existing,
        date: p.date,
        caseCode: p.caseCode,
        procedureType: p.procedureType,
        category: p.category,
        listPriceCents: p.listPrice,
        billedCents: p.billed,
        payerType: p.payerType,
        payerName: p.payerType === "PRIVATE" ? null : p.payerName,
        plannedVisits: p.plannedVisits,
        labCostCents: p.labCost,
        otherCostCents: p.otherCost,
        note: p.note,
        completed: p.completed,
      });
    }, "Procedimento atualizado.");
  }

  deleteProcedure(id: string): ApiResult {
    return this.mutate(() => {
      for (const s of this.db.read("sessions").filter((x) => x.procedureId === id)) this.db.remove("sessions", String(s.id));
      this.db.remove("procedures", id);
    }, "Procedimento apagado.");
  }

  addSession(procedureId: string, form: Form): ApiResult {
    return this.run(form, sessionSchema, (s) => {
      this.find("procedures", procedureId);
      this.assertNoOverlap(s.date, s.start, s.end);
      this.db.insert("sessions", { id: this.env.newId(), procedureId, date: s.date, startMinute: s.start, endMinute: s.end });
    }, "Consulta adicionada.");
  }

  deleteSession(id: string): ApiResult {
    return this.mutate(() => void this.db.remove("sessions", id), "Consulta removida.");
  }

  // -------------------------------------------------------------------------
  // Faltas
  // -------------------------------------------------------------------------

  createAbsence(form: Form): ApiResult {
    return this.run(form, absenceSchema, (a) => {
      this.db.insert("absences", {
        id: this.env.newId(),
        date: a.date,
        startMinute: a.start,
        durationMinutes: a.durationMinutes,
        plannedProcedure: a.plannedProcedure,
        estimatedValueCents: a.estimatedValue,
        payerType: a.payerType,
        kind: a.kind,
        slotRecovered: a.slotRecovered,
        recoveredValueCents: a.slotRecovered ? a.recoveredValue : 0,
      });
    }, "Falta registada.");
  }

  deleteAbsence(id: string): ApiResult {
    return this.mutate(() => void this.db.remove("absences", id), "Falta apagada.");
  }

  // -------------------------------------------------------------------------
  // Exames (ortopantomografia, CBCT…)
  // -------------------------------------------------------------------------

  createExam(form: Form): ApiResult {
    return this.run(form, examSchema, (x) => {
      this.db.insert("exams", {
        id: this.env.newId(),
        date: x.date,
        examType: x.examType,
        caseCode: x.caseCode,
        billedCents: x.billed,
        note: x.note,
        createdAt: this.env.nowIso(),
      });
    }, "Exame registado.");
  }

  deleteExam(id: string): ApiResult {
    return this.mutate(() => void this.db.remove("exams", id), "Exame apagado.");
  }

  /** Grava um tipo de exame; se já existir um com o mesmo nome, atualiza o valor habitual. */
  saveExamType(form: Form): ApiResult {
    return this.run(form, examTypeSchema, (t) => {
      const existing = this.db.read("examTypes").find((x) => String(x.name).toLowerCase() === t.name.toLowerCase());
      if (existing) this.db.update("examTypes", String(existing.id), { ...existing, priceCents: t.price });
      else this.db.insert("examTypes", { id: this.env.newId(), name: t.name, priceCents: t.price });
    }, "Tipo de exame gravado.");
  }

  deleteExamType(id: string): ApiResult {
    return this.mutate(() => void this.db.remove("examTypes", id), "Tipo de exame apagado.");
  }

  // -------------------------------------------------------------------------
  // Planos
  // -------------------------------------------------------------------------

  private planRow(p: import("@/modules/production/application/schemas").PlanInput): Row {
    return {
      caseCode: p.caseCode,
      presentedDate: p.presentedDate,
      diagnosedCents: p.diagnosed,
      totalCents: p.total,
      phases: p.phases,
      status: p.status,
      acceptedCents: p.accepted,
      performedCents: p.performed,
      lastContactDate: p.lastContactDate,
      nextAppointmentBooked: p.nextAppointmentBooked,
      note: p.note,
    };
  }

  createPlan(form: Form): ApiResult {
    return this.run(form, planSchema, (p) => this.db.insert("plans", { id: this.env.newId(), ...this.planRow(p) }), "Plano registado.");
  }

  updatePlan(id: string, form: Form): ApiResult {
    return this.run(form, planSchema, (p) => {
      this.find("plans", id);
      this.db.update("plans", id, { id, ...this.planRow(p) });
    }, "Plano atualizado.");
  }

  markPlanContacted(id: string): ApiResult {
    return this.mutate(() => {
      const plan = this.find("plans", id);
      this.db.update("plans", id, { ...plan, lastContactDate: this.env.today() });
    }, "Contacto registado.");
  }

  deletePlan(id: string): ApiResult {
    return this.mutate(() => void this.db.remove("plans", id), "Plano apagado.");
  }

  // -------------------------------------------------------------------------
  // Definições e templates
  // -------------------------------------------------------------------------

  saveSettings(form: Form): ApiResult {
    const parsed = settingsSchema.safeParse(form);
    if (!parsed.success) return { ok: false, message: "Verifique os campos assinalados.", errors: fieldErrors(parsed.error) };
    let schedule: ReturnType<typeof parseScheduleForm>;
    let goals: ReturnType<typeof parseGoalsForm>;
    let scenarios: ReturnType<typeof parseScenariosForm>;
    try {
      schedule = parseScheduleForm(form);
      goals = parseGoalsForm(form);
      scenarios = parseScenariosForm(form);
    } catch (error) {
      return { ok: false, message: (error as Error).message, errors: {} };
    }
    const s = parsed.data;
    return this.mutate(() => {
      const profile = this.db.read("profile")[0]!;
      this.db.update("profile", String(profile.id), {
        id: String(profile.id),
        name: s.name,
        feeBps: s.feePercent,
        feeBase: s.feeBase,
        standardSlotMinutes: s.standardSlotMinutes,
        saturdayMinutes: s.saturdayMinutes,
        primaryGoalCentsPerHour: s.primaryGoal,
        targetNoShowBps: s.targetNoShowPercent,
        followUpMinCents: s.followUpMin,
        followUpPriorityCents: s.followUpPriority,
        followUpFirstAlertDays: s.followUpFirstAlertDays,
        followUpSecondAlertDays: s.followUpSecondAlertDays,
      });
      this.db.replaceAll("schedule", schedule.map((b) => ({ id: this.env.newId(), ...b })));
      this.db.replaceAll("goals", goals.map((g, i) => ({ id: this.env.newId(), ...g, sortOrder: i })));
      this.db.replaceAll("scenarios", scenarios.map((c, i) => ({ id: this.env.newId(), ...c, sortOrder: i })));
    }, "Definições gravadas.");
  }

  saveTemplate(form: Form): ApiResult {
    return this.run(form, templateSchema, (t) => {
      const row: Row = {
        name: t.name,
        category: t.category,
        priceCents: t.price,
        durationMinutes: t.durationMinutes,
        plannedVisits: t.plannedVisits,
        labCostCents: t.labCost,
        payerType: t.payerType,
        favorite: t.favorite,
      };
      const existing = this.db.read("templates").find((x) => x.name === t.name);
      if (existing) this.db.update("templates", String(existing.id), { ...row, id: String(existing.id) });
      else this.db.insert("templates", { ...row, id: this.env.newId() });
    }, "Template gravado.");
  }

  toggleFavorite(id: string): ApiResult {
    return this.mutate(() => {
      const t = this.find("templates", id);
      this.db.update("templates", id, { ...t, favorite: !t.favorite });
    }, "Favoritos atualizados.");
  }

  deleteTemplate(id: string): ApiResult {
    return this.mutate(() => void this.db.remove("templates", id), "Template apagado.");
  }

  // -------------------------------------------------------------------------
  // Demonstração
  // -------------------------------------------------------------------------

  /** Substitui os registos pelos dados sintéticos de demonstração (definições mantêm-se). */
  loadDemo(): ApiResult {
    return this.mutate(() => {
      const demo = buildDemoDataset();
      this.db.replaceAll("days", demo.days.map((d) => ({ id: this.env.newId(), ...d, note: null })));
      const procedures: Row[] = [];
      const sessions: Row[] = [];
      demo.procedures.forEach((p, i) => {
        const id = this.env.newId();
        procedures.push({
          id,
          date: p.date,
          caseCode: p.caseCode,
          procedureType: p.procedureType,
          category: p.category,
          listPriceCents: p.listPriceCents,
          billedCents: p.billedCents,
          payerType: p.payerType,
          payerName: p.payerName,
          plannedVisits: p.plannedVisits,
          labCostCents: p.labCostCents,
          otherCostCents: p.otherCostCents,
          note: p.note,
          completed: p.completed,
          createdAt: `2026-01-01T00:00:${String(i).padStart(6, "0")}`,
        });
        for (const s of p.sessions) sessions.push({ id: this.env.newId(), procedureId: id, ...s });
      });
      this.db.replaceAll("procedures", procedures);
      this.db.replaceAll("sessions", sessions);
      this.db.replaceAll("absences", demo.absences.map((a) => ({ id: this.env.newId(), ...a })));
      this.db.replaceAll("plans", demo.plans.map((p) => ({ id: this.env.newId(), ...p, note: null })));
      this.db.replaceAll("exams", []);
    }, "Dados de demonstração carregados.");
  }

  /** Apaga todos os registos (dias, procedimentos, consultas, faltas, planos, exames). */
  clearRecords(): ApiResult {
    return this.mutate(() => {
      for (const key of ["days", "procedures", "sessions", "absences", "plans", "exams"] as const) this.db.replaceAll(key, []);
    }, "Registos apagados. As definições mantêm-se.");
  }
}

/** Nomes das operações que o cliente pode chamar (lista fechada). */
export const OPERATIONS = [
  "getData",
  "saveDay",
  "deleteDay",
  "createProcedure",
  "updateProcedure",
  "deleteProcedure",
  "addSession",
  "deleteSession",
  "createAbsence",
  "deleteAbsence",
  "createPlan",
  "updatePlan",
  "markPlanContacted",
  "deletePlan",
  "saveSettings",
  "saveTemplate",
  "toggleFavorite",
  "deleteTemplate",
  "createExam",
  "deleteExam",
  "saveExamType",
  "deleteExamType",
  "loadDemo",
  "clearRecords",
] as const;
export type Operation = (typeof OPERATIONS)[number];

/** Ponto de entrada único do cliente: valida o nome da operação e serializa o resultado. */
export function dispatch(env: Env, name: string, args: unknown[]): string {
  if (!(OPERATIONS as readonly string[]).includes(name)) {
    return JSON.stringify({ ok: false, message: "Operação desconhecida.", errors: {} });
  }
  const api = new Api(env);
  const fn = (api as unknown as Record<string, (...a: unknown[]) => unknown>)[name]!;
  const result = fn.apply(api, args);
  return JSON.stringify(name === "getData" ? { ok: true, message: "", errors: {}, data: result } : result);
}
