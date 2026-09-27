import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createProductionClient, type ProductionDb } from "@/lib/db/production";
import { addSession, CommandError, createAbsence, createPlan, createProcedure, nextCaseCode, saveClinicalDay } from "@/modules/production/application/commands";
import { getOrCreateProfile, updateSettings } from "@/modules/production/application/profile";
import { getDashboard, getProfitability } from "@/modules/production/application/queries";
import { absenceSchema, clinicalDaySchema, planSchema, procedureSchema, settingsSchema } from "@/modules/production/application/schemas";

import { createTestDb } from "./helpers";

let db: ProductionDb;
let file: string;
let cleanup: () => Promise<void>;

beforeAll(() => {
  ({ db, file, cleanup } = createTestDb());
});
afterAll(async () => cleanup());

const day = (date: string) => clinicalDaySchema.parse({ date, start: "09:30", end: "19:00", breakMinutes: "120" });
const procedure = (over: Record<string, string>) =>
  procedureSchema.parse({ date: "2026-09-01", procedureType: "Coroa cerâmica", category: "Coroa", billed: "600", plannedVisits: "3", completed: "on", ...over });

describe("perfil", () => {
  it("é criado com os valores pedidos (Diogo Costa, 50%, horário, objetivos)", async () => {
    const profile = await getOrCreateProfile(db);
    expect(profile.name).toBe("Diogo Costa");
    expect(profile.feeBps).toBe(5000);
    expect(profile.standardSlotMinutes).toBe(45);
    const goals = await db.productionGoal.findMany({ orderBy: { centsPerHour: "asc" } });
    expect(goals.map((g) => g.centsPerHour)).toEqual([8_500, 10_000, 12_500, 15_000]);
    expect(await db.scheduleBlock.count()).toBe(10);
    // idempotente
    expect((await getOrCreateProfile(db)).id).toBe(profile.id);
  });
});

describe("registo e cálculo", () => {
  it("coroa em 3 consultas no mesmo Case ID: uma receita, 3 h, €200/h", async () => {
    await saveClinicalDay(day("2026-09-01"), db);
    const crown = await createProcedure(procedure({ caseCode: "DC-2026-001", start: "09:30", end: "11:00", labCost: "150" }), db);
    await addSession(crown.id, { date: "2026-09-08", start: 570, end: 615 }, db);
    await addSession(crown.id, { date: "2026-09-15", start: 570, end: 615 }, db);

    const p = await getProfitability("2026-09-01", "2026-09-30", db);
    const row = p.perProcedure.find((x) => x.record.id === crown.id)!;
    expect(row.metrics.chairMinutes).toBe(180);
    expect(row.metrics.centsPerHour).toBe(20_000);
    expect(row.metrics.netCents).toBe(45_000);
    expect(p.cases.cases.find((c) => c.caseCode === "DC-2026-001")!.billedCents).toBe(60_000);
  });

  it("recusa consultas sobrepostas no mesmo dia, com mensagem compreensível", async () => {
    await expect(createProcedure(procedure({ procedureType: "Restauração", category: "Dentisteria", billed: "70", start: "10:30", end: "11:15" }), db)).rejects.toThrow(
      /Sobrepõe-se a outra consulta \(Coroa cerâmica, 09:30–11:00\)/,
    );
    await expect(createProcedure(procedure({ procedureType: "Restauração", category: "Dentisteria", billed: "70", start: "11:00", end: "11:45" }), db)).resolves.toBeTruthy();
  });

  it("uma consulta recusada não deixa dados a meio (transação)", async () => {
    const before = await db.procedure.count();
    await expect(createProcedure(procedure({ caseCode: "DC-2026-099", start: "09:00", end: "10:00" }), db)).rejects.toBeInstanceOf(CommandError);
    expect(await db.procedure.count()).toBe(before);
    expect(await db.clinicalCase.findFirst({ where: { code: "DC-2026-099" } })).toBeNull();
  });

  it("dashboard: produção, honorários, €/h e faltas do mês", async () => {
    await createAbsence(absenceSchema.parse({ date: "2026-09-01", start: "15:00", durationMinutes: "45", kind: "NO_SHOW", estimatedValue: "70" }), db);
    const d = await getDashboard("2026-09", db);
    expect(d.current.productionCents).toBe(67_000);
    expect(d.current.feeCents).toBe(33_500);
    expect(d.current.clinicalMinutes).toBe(450);
    expect(d.current.centsPerHour).toBeCloseTo((67_000 * 60) / 450, 6);
    expect(d.current.absences.netLostCents).toBe(7_000);
    expect(d.current.absences.missedRate).toBeCloseTo(1 / 5, 10); // 4 consultas + 1 falta
  });

  it("mudar a percentagem nas definições muda os honorários", async () => {
    await updateSettings(
      settingsSchema.parse({
        name: "Diogo Costa", feePercent: "40", feeBase: "BILLED", standardSlotMinutes: "45", saturdayMinutes: "210", primaryGoal: "100",
        targetNoShowPercent: "5", followUpMin: "500", followUpPriority: "1500", followUpFirstAlertDays: "7", followUpSecondAlertDays: "30",
      }),
      db,
    );
    const d = await getDashboard("2026-09", db);
    expect(d.current.feeCents).toBe(26_800);
  });

  it("planos e próximo Case ID", async () => {
    await createPlan(planSchema.parse({ caseCode: "DC-2026-002", presentedDate: "2026-09-01", total: "2000", phases: "2", status: "PRESENTED" }), db);
    expect(await nextCaseCode(2026, db)).toBe("DC-2026-003");
    const d = await getDashboard("2026-09", db);
    expect(d.current.plans.presentedCents).toBe(200_000);
  });

  it("os dados persistem: um cliente novo sobre o mesmo ficheiro vê os mesmos registos", async () => {
    const other = createProductionClient(`file:${file}`);
    try {
      expect(await other.procedure.count()).toBe(await db.procedure.count());
      expect(await other.procedureSession.count()).toBe(4);
    } finally {
      await other.$disconnect();
    }
  });
});
