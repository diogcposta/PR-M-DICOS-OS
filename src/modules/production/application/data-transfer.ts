/**
 * Exportação e importação CSV do módulo de produção.
 *
 * Importação em dois passos — pré-visualizar (cabeçalhos, amostra, válidas /
 * inválidas, erro por linha) e confirmar — com SHA-256 do ficheiro: o mesmo
 * ficheiro nunca é importado duas vezes. A gravação é transacional; por omissão
 * uma linha inválida bloqueia o lote (D-008), a menos que o utilizador escolha
 * importar só as válidas.
 *
 * Fontes de importação são adaptadores (`ImportSource`): hoje existe o formato
 * nativo desta aplicação (o mesmo da exportação). Um futuro adaptador Newsoft
 * só precisa de mapear as colunas reais para a mesma forma — sem tocar no resto.
 * Nenhum nome de coluna Newsoft é assumido sem amostra real (CLAUDE.md).
 */
import { productionDb, type ProductionDb } from "@/lib/db/production";

import { ABSENCE_KINDS, PAYER_TYPES, PLAN_STATUSES } from "../domain/constants";
import { formatTime, isValidCivilDate, isValidTime, parseTime } from "../domain/time";
import { parseCsv, sha256, toCsv } from "../infrastructure/csv";

import { centsToInput } from "./parse";
import { getOrCreateProfile } from "./profile";
import { absenceSchema, clinicalDaySchema, fieldErrors, planSchema, procedureSchema } from "./schemas";

export const ENTITIES = ["dias", "procedimentos", "faltas", "planos"] as const;
export type Entity = (typeof ENTITIES)[number];

export const ENTITY_LABELS: Record<Entity, string> = {
  dias: "Dias clínicos",
  procedimentos: "Procedimentos (com consultas)",
  faltas: "Faltas e cancelamentos",
  planos: "Planos de tratamento",
};

const HEADERS: Record<Entity, readonly string[]> = {
  dias: ["data", "inicio", "fim", "pausa_min", "estado", "nota"],
  procedimentos: [
    "id", "data", "case_id", "procedimento", "categoria", "valor_tabelado", "valor_faturado", "pagador",
    "seguradora", "consultas_previstas", "custo_laboratorio", "outros_custos", "concluido", "observacao", "consultas",
  ],
  faltas: ["id", "data", "hora", "duracao_min", "procedimento_previsto", "valor_estimado", "pagador", "tipo", "slot_recuperado", "receita_recuperada"],
  planos: [
    "id", "case_id", "data_apresentacao", "valor_diagnosticado", "valor_total", "fases", "estado", "valor_aceite",
    "valor_realizado", "ultimo_contacto", "proxima_consulta_marcada", "observacao",
  ],
};

export function entityHeaders(entity: Entity): readonly string[] {
  return HEADERS[entity];
}

/** dd/MM/yyyy (formato do Excel português). */
const ptDate = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const money = (c: number) => centsToInput(c);
const yesNo = (b: boolean) => (b ? "sim" : "não");

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

export async function exportEntity(entity: Entity, db: ProductionDb = productionDb): Promise<string> {
  const profile = await getOrCreateProfile(db);
  const doctorId = profile.id;
  switch (entity) {
    case "dias": {
      const rows = await db.clinicalDay.findMany({ where: { doctorId }, orderBy: { date: "asc" } });
      return toCsv(HEADERS.dias, rows.map((d) => [ptDate(d.date), formatTime(d.startMinute), formatTime(d.endMinute), d.breakMinutes, d.status, d.note]));
    }
    case "procedimentos": {
      const rows = await db.procedure.findMany({
        where: { doctorId },
        include: { case: true, sessions: { orderBy: [{ date: "asc" }, { startMinute: "asc" }] } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      });
      return toCsv(
        HEADERS.procedimentos,
        rows.map((p) => [
          p.id, ptDate(p.date), p.case?.code ?? "", p.procedureType, p.category, money(p.listPriceCents), money(p.billedCents),
          p.payerType, p.payerName, p.plannedVisits, money(p.labCostCents), money(p.otherCostCents), yesNo(p.completed), p.note,
          p.sessions.map((s) => `${ptDate(s.date)} ${formatTime(s.startMinute)}-${formatTime(s.endMinute)}`).join("|"),
        ]),
      );
    }
    case "faltas": {
      const rows = await db.absenceEvent.findMany({ where: { doctorId }, orderBy: [{ date: "asc" }, { startMinute: "asc" }] });
      return toCsv(
        HEADERS.faltas,
        rows.map((a) => [a.id, ptDate(a.date), formatTime(a.startMinute), a.durationMinutes, a.plannedProcedure, money(a.estimatedValueCents), a.payerType, a.kind, yesNo(a.slotRecovered), money(a.recoveredValueCents)]),
      );
    }
    case "planos": {
      const rows = await db.treatmentPlan.findMany({ where: { doctorId }, include: { case: true }, orderBy: { presentedDate: "asc" } });
      return toCsv(
        HEADERS.planos,
        rows.map((p) => [
          p.id, p.case.code, ptDate(p.presentedDate), money(p.diagnosedCents), money(p.totalCents), p.phases, p.status,
          money(p.acceptedCents), money(p.performedCents), ptDate(p.lastContactDate), yesNo(p.nextAppointmentBooked), p.note,
        ]),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

/** "02/09/2026" ou "2026-09-02" → "2026-09-02"; outro formato fica como está (e falha na validação). */
export function normaliseDate(value: string): string {
  const pt = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return pt ? `${pt[3]}-${pt[2]}-${pt[1]}` : value.trim();
}

function normaliseBool(value: string | undefined): string {
  return /^(sim|s|true|1|yes|y|on)$/i.test((value ?? "").trim()) ? "on" : "";
}

const PAYER_ALIASES: Record<string, string> = { particular: "PRIVATE", seguro: "INSURANCE", "convenção": "AGREEMENT", convencao: "AGREEMENT" };
function normaliseEnum(value: string | undefined, allowed: readonly string[], aliases: Record<string, string> = {}): string {
  const v = (value ?? "").trim();
  const upper = v.toUpperCase();
  if (allowed.includes(upper)) return upper;
  return aliases[v.toLowerCase()] ?? v;
}

export interface ImportSession {
  readonly date: string;
  readonly startMinute: number;
  readonly endMinute: number;
}

/** "02/09/2026 09:30-11:00|09/09/2026 09:30-10:15" → consultas. */
export function parseSessions(value: string): ImportSession[] {
  if (!value.trim()) return [];
  return value.split("|").map((chunk) => {
    const m = /^\s*(\S+)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$/.exec(chunk);
    if (!m) throw new Error(`Consulta inválida: "${chunk.trim()}". Formato: dd/mm/aaaa HH:mm-HH:mm.`);
    const date = normaliseDate(m[1]!);
    if (!isValidCivilDate(date) || !isValidTime(m[2]!) || !isValidTime(m[3]!)) {
      throw new Error(`Consulta inválida: "${chunk.trim()}".`);
    }
    const startMinute = parseTime(m[2]!);
    const endMinute = parseTime(m[3]!);
    if (endMinute <= startMinute) throw new Error(`Consulta com fim antes do início: "${chunk.trim()}".`);
    return { date, startMinute, endMinute };
  });
}

/** Adaptador de fonte: converte uma linha bruta na forma dos formulários. */
export interface ImportSource {
  readonly key: string;
  readonly label: string;
  readonly entity: Entity;
  readonly requiredHeaders: readonly string[];
  mapRow(row: Record<string, string>): Record<string, string>;
}

const NATIVE_SOURCES: Record<Entity, ImportSource> = {
  dias: {
    key: "NATIVE_CSV_V1", label: "CSV desta aplicação", entity: "dias", requiredHeaders: ["data", "inicio", "fim"],
    mapRow: (r) => ({ date: normaliseDate(r.data ?? ""), start: r.inicio ?? "", end: r.fim ?? "", breakMinutes: r.pausa_min || "0", status: normaliseEnum(r.estado || "WORKED", ["WORKED", "PLANNED"]), note: r.nota ?? "" }),
  },
  procedimentos: {
    key: "NATIVE_CSV_V1", label: "CSV desta aplicação", entity: "procedimentos", requiredHeaders: ["data", "procedimento", "categoria", "valor_faturado"],
    mapRow: (r) => ({
      date: normaliseDate(r.data ?? ""), caseCode: r.case_id ?? "", procedureType: r.procedimento ?? "", category: r.categoria ?? "",
      listPrice: r.valor_tabelado ?? "", billed: r.valor_faturado ?? "", payerType: normaliseEnum(r.pagador || "PRIVATE", PAYER_TYPES, PAYER_ALIASES),
      payerName: r.seguradora ?? "", plannedVisits: r.consultas_previstas || "1", labCost: r.custo_laboratorio ?? "", otherCost: r.outros_custos ?? "",
      completed: r.concluido === undefined || r.concluido === "" ? "on" : normaliseBool(r.concluido), note: r.observacao ?? "",
    }),
  },
  faltas: {
    key: "NATIVE_CSV_V1", label: "CSV desta aplicação", entity: "faltas", requiredHeaders: ["data", "hora", "tipo"],
    mapRow: (r) => ({
      date: normaliseDate(r.data ?? ""), start: r.hora ?? "", durationMinutes: r.duracao_min || "45", plannedProcedure: r.procedimento_previsto ?? "",
      estimatedValue: r.valor_estimado ?? "", payerType: normaliseEnum(r.pagador || "PRIVATE", PAYER_TYPES, PAYER_ALIASES),
      kind: normaliseEnum(r.tipo, ABSENCE_KINDS, { falta: "NO_SHOW", "cancelamento tardio": "LATE_CANCEL", "cancelamento antecipado": "EARLY_CANCEL" }),
      slotRecovered: normaliseBool(r.slot_recuperado), recoveredValue: r.receita_recuperada ?? "",
    }),
  },
  planos: {
    key: "NATIVE_CSV_V1", label: "CSV desta aplicação", entity: "planos", requiredHeaders: ["case_id", "data_apresentacao", "valor_total", "estado"],
    mapRow: (r) => ({
      caseCode: r.case_id ?? "", presentedDate: normaliseDate(r.data_apresentacao ?? ""), diagnosed: r.valor_diagnosticado ?? "", total: r.valor_total ?? "",
      phases: r.fases || "1", status: normaliseEnum(r.estado, PLAN_STATUSES), accepted: r.valor_aceite ?? "", performed: r.valor_realizado ?? "",
      lastContactDate: r.ultimo_contacto ? normaliseDate(r.ultimo_contacto) : "", nextAppointmentBooked: normaliseBool(r.proxima_consulta_marcada), note: r.observacao ?? "",
    }),
  },
};

export function importSource(entity: Entity): ImportSource {
  return NATIVE_SOURCES[entity];
}

export interface RowResult {
  readonly rowNumber: number;
  readonly valid: boolean;
  readonly errors: string[];
  /** Linha já existente (mesmo `id`) — será ignorada, não duplicada. */
  readonly duplicate: boolean;
}

export interface ImportPreview {
  readonly entity: Entity;
  readonly fileHash: string;
  readonly alreadyImported: boolean;
  readonly headers: string[];
  readonly missingHeaders: string[];
  readonly sample: Array<Record<string, string>>;
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly duplicates: number;
  readonly rows: RowResult[];
}

interface ValidatedRow {
  readonly rowNumber: number;
  readonly externalId: string | null;
  readonly data: unknown;
  readonly sessions: ImportSession[];
}

function validateRows(entity: Entity, rows: Array<Record<string, string>>) {
  const source = importSource(entity);
  const results: RowResult[] = [];
  const validRows: ValidatedRow[] = [];
  const schema = { dias: clinicalDaySchema, procedimentos: procedureSchema, faltas: absenceSchema, planos: planSchema }[entity];
  rows.forEach((raw, index) => {
    const rowNumber = index + 2; // linha 1 = cabeçalho
    const errors: string[] = [];
    const parsed = schema.safeParse(source.mapRow(raw));
    if (!parsed.success) errors.push(...Object.entries(fieldErrors(parsed.error)).map(([, m]) => m));
    let sessions: ImportSession[] = [];
    if (entity === "procedimentos") {
      try {
        sessions = parseSessions(raw.consultas ?? "");
      } catch (error) {
        errors.push((error as Error).message);
      }
    }
    results.push({ rowNumber, valid: errors.length === 0, errors, duplicate: false });
    if (errors.length === 0 && parsed.success) {
      validRows.push({ rowNumber, externalId: raw.id?.trim() || null, data: parsed.data, sessions });
    }
  });
  return { results, validRows };
}

async function existingIds(db: ProductionDb, entity: Entity, doctorId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0 || entity === "dias") return new Set();
  const where = { doctorId, id: { in: ids } };
  const found =
    entity === "procedimentos"
      ? await db.procedure.findMany({ where, select: { id: true } })
      : entity === "faltas"
        ? await db.absenceEvent.findMany({ where, select: { id: true } })
        : await db.treatmentPlan.findMany({ where, select: { id: true } });
  return new Set(found.map((f) => f.id));
}

export async function previewImport(entity: Entity, content: string, db: ProductionDb = productionDb): Promise<ImportPreview> {
  const profile = await getOrCreateProfile(db);
  const fileHash = sha256(content);
  const csv = parseCsv(content);
  const missingHeaders = importSource(entity).requiredHeaders.filter((h) => !csv.headers.includes(h));
  const already = await db.productionImport.findUnique({ where: { doctorId_fileHash: { doctorId: profile.id, fileHash } } });
  const { results, validRows } = missingHeaders.length ? { results: [], validRows: [] } : validateRows(entity, csv.rows);
  const dupIds = await existingIds(db, entity, profile.id, validRows.flatMap((r) => (r.externalId ? [r.externalId] : [])));
  const rows = results.map((r) => {
    const vr = validRows.find((v) => v.rowNumber === r.rowNumber);
    return vr?.externalId && dupIds.has(vr.externalId) ? { ...r, duplicate: true } : r;
  });
  return {
    entity,
    fileHash,
    alreadyImported: Boolean(already),
    headers: csv.headers,
    missingHeaders,
    sample: csv.rows.slice(0, 5),
    total: csv.rows.length,
    valid: rows.filter((r) => r.valid && !r.duplicate).length,
    invalid: rows.filter((r) => !r.valid).length,
    duplicates: rows.filter((r) => r.duplicate).length,
    rows,
  };
}

export class ImportRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportRefused";
  }
}

export interface ImportOutcome {
  readonly imported: number;
  readonly skipped: number;
  readonly invalid: number;
}

/**
 * Grava as linhas válidas numa única transação. Recusa o ficheiro se já foi
 * importado (SHA-256), se faltam colunas, ou se há linhas inválidas e o
 * utilizador não escolheu importar só as válidas.
 */
export async function commitImport(
  entity: Entity,
  content: string,
  filename: string,
  options: { allowPartial: boolean },
  db: ProductionDb = productionDb,
): Promise<ImportOutcome> {
  const preview = await previewImport(entity, content, db);
  if (preview.alreadyImported) throw new ImportRefused("Este ficheiro já foi importado (mesmo SHA-256). Nada foi alterado.");
  if (preview.missingHeaders.length) throw new ImportRefused(`Faltam colunas obrigatórias: ${preview.missingHeaders.join(", ")}.`);
  if (preview.invalid > 0 && !options.allowPartial) {
    throw new ImportRefused(`${preview.invalid} linha(s) inválida(s). Corrija o ficheiro ou escolha importar só as linhas válidas.`);
  }
  const profile = await getOrCreateProfile(db);
  const doctorId = profile.id;
  const csv = parseCsv(content);
  const { validRows } = validateRows(entity, csv.rows);
  const dupIds = await existingIds(db, entity, doctorId, validRows.flatMap((r) => (r.externalId ? [r.externalId] : [])));
  const toImport = validRows.filter((r) => !(r.externalId && dupIds.has(r.externalId)));

  await db.$transaction(async (tx) => {
    const caseIdFor = async (code: string | null) => {
      if (!code) return null;
      const c = await tx.clinicalCase.upsert({ where: { doctorId_code: { doctorId, code } }, create: { doctorId, code }, update: {} });
      return c.id;
    };
    for (const row of toImport) {
      switch (entity) {
        case "dias": {
          const d = row.data as import("./schemas").ClinicalDayInput;
          const data = { startMinute: d.start, endMinute: d.end, breakMinutes: d.breakMinutes, status: d.status, note: d.note };
          await tx.clinicalDay.upsert({ where: { doctorId_date: { doctorId, date: d.date } }, create: { ...data, doctorId, date: d.date }, update: data });
          break;
        }
        case "procedimentos": {
          const p = row.data as import("./schemas").ProcedureInput;
          await tx.procedure.create({
            data: {
              ...(row.externalId ? { id: row.externalId } : {}),
              doctorId, caseId: await caseIdFor(p.caseCode), date: p.date, procedureType: p.procedureType, category: p.category,
              listPriceCents: p.listPrice, billedCents: p.billed, payerType: p.payerType, payerName: p.payerType === "PRIVATE" ? null : p.payerName,
              plannedVisits: p.plannedVisits, labCostCents: p.labCost, otherCostCents: p.otherCost, note: p.note, completed: p.completed,
              sessions: { create: row.sessions.map((s) => ({ ...s, doctorId })) },
            },
          });
          break;
        }
        case "faltas": {
          const a = row.data as import("./schemas").AbsenceInput;
          await tx.absenceEvent.create({
            data: {
              ...(row.externalId ? { id: row.externalId } : {}),
              doctorId, date: a.date, startMinute: a.start, durationMinutes: a.durationMinutes, plannedProcedure: a.plannedProcedure,
              estimatedValueCents: a.estimatedValue, payerType: a.payerType, kind: a.kind, slotRecovered: a.slotRecovered,
              recoveredValueCents: a.slotRecovered ? a.recoveredValue : 0,
            },
          });
          break;
        }
        case "planos": {
          const p = row.data as import("./schemas").PlanInput;
          await tx.treatmentPlan.create({
            data: {
              ...(row.externalId ? { id: row.externalId } : {}),
              doctorId, caseId: (await caseIdFor(p.caseCode))!, presentedDate: p.presentedDate, diagnosedCents: p.diagnosed, totalCents: p.total,
              phases: p.phases, status: p.status, acceptedCents: p.accepted, performedCents: p.performed, lastContactDate: p.lastContactDate,
              nextAppointmentBooked: p.nextAppointmentBooked, note: p.note,
            },
          });
          break;
        }
      }
    }
    await tx.productionImport.create({
      data: {
        doctorId, entity, originalFilename: filename.slice(0, 200), fileHash: preview.fileHash,
        rowsTotal: preview.total, rowsImported: toImport.length, rowsSkipped: validRows.length - toImport.length, rowsInvalid: preview.invalid,
      },
    });
  });

  return { imported: toImport.length, skipped: validRows.length - toImport.length, invalid: preview.invalid };
}

export async function listImports(db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return db.productionImport.findMany({ where: { doctorId: profile.id }, orderBy: { createdAt: "desc" }, take: 20 });
}
