/**
 * Grava o conjunto de demonstração numa base de produção.
 * Apaga primeiro os registos do perfil (não o perfil nem as definições).
 */
import type { ProductionDb } from "@/lib/db/production";

import { getOrCreateProfile } from "../application/profile";

import { buildDemoDataset, type DemoDataset } from "./dataset";

export async function clearProductionData(db: ProductionDb, doctorId: string): Promise<void> {
  await db.$transaction([
    db.procedureSession.deleteMany({ where: { doctorId } }),
    db.procedure.deleteMany({ where: { doctorId } }),
    db.treatmentPlan.deleteMany({ where: { doctorId } }),
    db.clinicalCase.deleteMany({ where: { doctorId } }),
    db.absenceEvent.deleteMany({ where: { doctorId } }),
    db.clinicalDay.deleteMany({ where: { doctorId } }),
    db.productionImport.deleteMany({ where: { doctorId } }),
  ]);
}

export async function seedDemoData(db: ProductionDb, dataset: DemoDataset = buildDemoDataset()) {
  const profile = await getOrCreateProfile(db);
  const doctorId = profile.id;
  await clearProductionData(db, doctorId);

  const codes = new Set<string>([
    ...dataset.procedures.flatMap((p) => (p.caseCode ? [p.caseCode] : [])),
    ...dataset.plans.map((p) => p.caseCode),
  ]);

  await db.$transaction(async (tx) => {
    await tx.clinicalDay.createMany({ data: dataset.days.map((d) => ({ ...d, doctorId })) });
    await tx.clinicalCase.createMany({ data: [...codes].sort().map((code) => ({ code, doctorId })) });
    const cases = await tx.clinicalCase.findMany({ where: { doctorId }, select: { id: true, code: true } });
    const caseId = new Map(cases.map((c) => [c.code, c.id]));

    for (const p of dataset.procedures) {
      await tx.procedure.create({
        data: {
          doctorId,
          caseId: p.caseCode ? caseId.get(p.caseCode) : null,
          date: p.date,
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
          sessions: { create: p.sessions.map((s) => ({ ...s, doctorId })) },
        },
      });
    }
    await tx.absenceEvent.createMany({ data: dataset.absences.map((a) => ({ ...a, doctorId })) });
    await tx.treatmentPlan.createMany({
      data: dataset.plans.map(({ caseCode, ...plan }) => ({ ...plan, doctorId, caseId: caseId.get(caseCode)! })),
    });
  });

  return {
    days: dataset.days.length,
    procedures: dataset.procedures.length,
    sessions: dataset.procedures.reduce((s, p) => s + p.sessions.length, 0),
    absences: dataset.absences.length,
    plans: dataset.plans.length,
  };
}
