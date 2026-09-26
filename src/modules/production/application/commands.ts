/**
 * Escritas do módulo de produção. Cada comando valida regras que dependem da
 * base (sobreposição de consultas, datas únicas, Case ID) e grava numa transação.
 */
import { productionDb, type ProductionDb } from "@/lib/db/production";

import { findOverlap, formatTime } from "../domain/time";

import { getOrCreateProfile } from "./profile";
import type {
  AbsenceInput,
  ClinicalDayInput,
  PlanInput,
  ProcedureInput,
  SessionInput,
  TemplateInput,
} from "./schemas";

/** Erro de regra de negócio, com o campo a que se refere (para o formulário). */
export class CommandError extends Error {
  constructor(
    message: string,
    readonly field: string = "_form",
  ) {
    super(message);
    this.name = "CommandError";
  }
}

type Tx = Omit<ProductionDb, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

async function ensureCase(tx: Tx, doctorId: string, code: string | null): Promise<string | null> {
  if (!code) return null;
  const found = await tx.clinicalCase.findUnique({ where: { doctorId_code: { doctorId, code } } });
  if (found) return found.id;
  const created = await tx.clinicalCase.create({ data: { doctorId, code } });
  return created.id;
}

/**
 * Recusa consultas sobrepostas no mesmo dia: o tempo de cadeira contaria a
 * dobrar e o €/h ficaria artificialmente baixo.
 */
async function assertNoSessionOverlap(
  tx: Tx,
  doctorId: string,
  date: string,
  startMinute: number,
  endMinute: number,
  ignoreSessionId?: string,
): Promise<void> {
  const sameDay = await tx.procedureSession.findMany({
    where: { doctorId, date, ...(ignoreSessionId ? { id: { not: ignoreSessionId } } : {}) },
    include: { procedure: { select: { procedureType: true } } },
  });
  const clash = findOverlap({ startMinute, endMinute }, sameDay);
  if (clash) {
    throw new CommandError(
      `Sobrepõe-se a outra consulta (${clash.procedure.procedureType}, ${formatTime(clash.startMinute)}–${formatTime(clash.endMinute)}).`,
      "start",
    );
  }
}

// ---------------------------------------------------------------------------
// Dias clínicos
// ---------------------------------------------------------------------------

export async function saveClinicalDay(input: ClinicalDayInput, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const data = {
    startMinute: input.start,
    endMinute: input.end,
    breakMinutes: input.breakMinutes,
    status: input.status,
    note: input.note,
  };
  return db.clinicalDay.upsert({
    where: { doctorId_date: { doctorId: profile.id, date: input.date } },
    create: { ...data, date: input.date, doctorId: profile.id },
    update: data,
  });
}

export async function deleteClinicalDay(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  await db.clinicalDay.deleteMany({ where: { id, doctorId: profile.id } });
}

// ---------------------------------------------------------------------------
// Procedimentos e consultas
// ---------------------------------------------------------------------------

export async function createProcedure(input: ProcedureInput, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return db.$transaction(async (tx) => {
    const caseId = await ensureCase(tx, profile.id, input.caseCode);
    if (input.start !== null && input.end !== null) {
      await assertNoSessionOverlap(tx, profile.id, input.date, input.start, input.end);
    }
    return tx.procedure.create({
      data: {
        doctorId: profile.id,
        caseId,
        date: input.date,
        procedureType: input.procedureType,
        category: input.category,
        listPriceCents: input.listPrice,
        billedCents: input.billed,
        payerType: input.payerType,
        payerName: input.payerType === "PRIVATE" ? null : input.payerName,
        plannedVisits: input.plannedVisits,
        labCostCents: input.labCost,
        otherCostCents: input.otherCost,
        note: input.note,
        completed: input.completed,
        sessions:
          input.start !== null && input.end !== null
            ? { create: [{ doctorId: profile.id, date: input.date, startMinute: input.start, endMinute: input.end }] }
            : undefined,
      },
    });
  });
}

/** Atualiza os dados do procedimento (as consultas gerem-se à parte). */
export async function updateProcedure(
  id: string,
  input: ProcedureInput,
  db: ProductionDb = productionDb,
) {
  const profile = await getOrCreateProfile(db);
  return db.$transaction(async (tx) => {
    const existing = await tx.procedure.findFirst({ where: { id, doctorId: profile.id } });
    if (!existing) throw new CommandError("Procedimento não encontrado.");
    const caseId = await ensureCase(tx, profile.id, input.caseCode);
    return tx.procedure.update({
      where: { id },
      data: {
        caseId,
        date: input.date,
        procedureType: input.procedureType,
        category: input.category,
        listPriceCents: input.listPrice,
        billedCents: input.billed,
        payerType: input.payerType,
        payerName: input.payerType === "PRIVATE" ? null : input.payerName,
        plannedVisits: input.plannedVisits,
        labCostCents: input.labCost,
        otherCostCents: input.otherCost,
        note: input.note,
        completed: input.completed,
      },
    });
  });
}

export async function deleteProcedure(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  await db.procedure.deleteMany({ where: { id, doctorId: profile.id } });
}

/** Acrescenta uma consulta a um procedimento existente (tratamentos em várias consultas). */
export async function addSession(
  procedureId: string,
  input: SessionInput,
  db: ProductionDb = productionDb,
) {
  const profile = await getOrCreateProfile(db);
  return db.$transaction(async (tx) => {
    const procedure = await tx.procedure.findFirst({ where: { id: procedureId, doctorId: profile.id } });
    if (!procedure) throw new CommandError("Procedimento não encontrado.");
    await assertNoSessionOverlap(tx, profile.id, input.date, input.start, input.end);
    return tx.procedureSession.create({
      data: {
        doctorId: profile.id,
        procedureId,
        date: input.date,
        startMinute: input.start,
        endMinute: input.end,
      },
    });
  });
}

export async function deleteSession(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  await db.procedureSession.deleteMany({ where: { id, doctorId: profile.id } });
}

// ---------------------------------------------------------------------------
// Faltas
// ---------------------------------------------------------------------------

export async function createAbsence(input: AbsenceInput, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return db.absenceEvent.create({
    data: {
      doctorId: profile.id,
      date: input.date,
      startMinute: input.start,
      durationMinutes: input.durationMinutes,
      plannedProcedure: input.plannedProcedure,
      estimatedValueCents: input.estimatedValue,
      payerType: input.payerType,
      kind: input.kind,
      slotRecovered: input.slotRecovered,
      recoveredValueCents: input.slotRecovered ? input.recoveredValue : 0,
    },
  });
}

export async function deleteAbsence(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  await db.absenceEvent.deleteMany({ where: { id, doctorId: profile.id } });
}

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

function planData(input: PlanInput) {
  return {
    presentedDate: input.presentedDate,
    diagnosedCents: input.diagnosed,
    totalCents: input.total,
    phases: input.phases,
    status: input.status,
    acceptedCents: input.accepted,
    performedCents: input.performed,
    lastContactDate: input.lastContactDate,
    nextAppointmentBooked: input.nextAppointmentBooked,
    note: input.note,
  };
}

export async function createPlan(input: PlanInput, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return db.$transaction(async (tx) => {
    const caseId = (await ensureCase(tx, profile.id, input.caseCode)) as string;
    return tx.treatmentPlan.create({ data: { ...planData(input), doctorId: profile.id, caseId } });
  });
}

export async function updatePlan(id: string, input: PlanInput, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return db.$transaction(async (tx) => {
    const existing = await tx.treatmentPlan.findFirst({ where: { id, doctorId: profile.id } });
    if (!existing) throw new CommandError("Plano não encontrado.");
    const caseId = (await ensureCase(tx, profile.id, input.caseCode)) as string;
    return tx.treatmentPlan.update({ where: { id }, data: { ...planData(input), caseId } });
  });
}

/** Regista um contacto de follow-up hoje (sem enviar nada ao paciente). */
export async function markPlanContacted(id: string, date: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  await db.treatmentPlan.updateMany({ where: { id, doctorId: profile.id }, data: { lastContactDate: date } });
}

export async function deletePlan(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  await db.treatmentPlan.deleteMany({ where: { id, doctorId: profile.id } });
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function saveTemplate(input: TemplateInput, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const data = {
    category: input.category,
    priceCents: input.price,
    durationMinutes: input.durationMinutes,
    plannedVisits: input.plannedVisits,
    labCostCents: input.labCost,
    payerType: input.payerType,
    favorite: input.favorite,
  };
  return db.procedureTemplate.upsert({
    where: { doctorId_name: { doctorId: profile.id, name: input.name } },
    create: { ...data, name: input.name, doctorId: profile.id },
    update: data,
  });
}

export async function toggleTemplateFavorite(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const t = await db.procedureTemplate.findFirst({ where: { id, doctorId: profile.id } });
  if (!t) return;
  await db.procedureTemplate.update({ where: { id }, data: { favorite: !t.favorite } });
}

export async function deleteTemplate(id: string, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  await db.procedureTemplate.deleteMany({ where: { id, doctorId: profile.id } });
}

/** Próximo Case ID livre do ano: DC-2026-001, DC-2026-002, … */
export async function nextCaseCode(year: number, db: ProductionDb = productionDb): Promise<string> {
  const profile = await getOrCreateProfile(db);
  const prefix = `DC-${year}-`;
  const existing = await db.clinicalCase.findMany({
    where: { doctorId: profile.id, code: { startsWith: prefix } },
    select: { code: true },
  });
  const max = existing.reduce((m, c) => Math.max(m, Number(c.code.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
