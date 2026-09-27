import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ProductionDb } from "@/lib/db/production";
import { commitImport, exportEntity, ImportRefused, parseSessions, previewImport } from "@/modules/production/application/data-transfer";
import { getMonthlyReport } from "@/modules/production/application/queries";
import { reportMarkdown } from "@/modules/production/application/report";
import { seedDemoData } from "@/modules/production/demo/seed";

import { createTestDb } from "./helpers";

let source: ReturnType<typeof createTestDb>;
let target: ReturnType<typeof createTestDb>;
let db: ProductionDb;

beforeAll(async () => {
  source = createTestDb();
  target = createTestDb();
  db = source.db;
  await seedDemoData(db);
}, 60_000);
afterAll(async () => {
  await source.cleanup();
  await target.cleanup();
});

describe("dados de demonstração na base", () => {
  it("setembro de 2026: €8.619, €4.309,50, 130,5 h", async () => {
    const report = await getMonthlyReport("2026-09", db);
    const c = report.dashboard.current;
    expect(c.productionCents).toBe(861_900);
    expect(c.feeCents).toBe(430_950);
    expect(c.clinicalMinutes).toBe(7_830);
    const md = reportMarkdown(report);
    expect(md).toContain("€8.619");
    expect(md).toContain("€4.309,50");
    expect(md).toContain("130,5 h");
  });
});

describe("exportação → importação", () => {
  it("CSV para Excel português: BOM, ; e datas dd/mm/aaaa", async () => {
    const csv = await exportEntity("procedimentos", db);
    expect(csv.startsWith("﻿id;data;case_id")).toBe(true);
    expect(csv).toMatch(/02\/09\/2026 09:30-11:00\|09\/09\/2026 09:30-10:15/);
  });

  it("cópia completa para outra base reproduz os mesmos números", async () => {
    for (const entity of ["dias", "procedimentos", "faltas", "planos"] as const) {
      const csv = await exportEntity(entity, db);
      const outcome = await commitImport(entity, csv, `${entity}.csv`, { allowPartial: false }, target.db);
      expect(outcome.invalid).toBe(0);
    }
    const a = (await getMonthlyReport("2026-09", db)).dashboard.current;
    const b = (await getMonthlyReport("2026-09", target.db)).dashboard.current;
    expect(b.productionCents).toBe(a.productionCents);
    expect(b.clinicalMinutes).toBe(a.clinicalMinutes);
    expect(b.appointmentCount).toBe(a.appointmentCount);
    expect(b.absences.netLostCents).toBe(a.absences.netLostCents);
    expect(b.plans.presentedCents).toBe(a.plans.presentedCents);
  }, 60_000);

  it("reimportar o mesmo ficheiro é recusado (SHA-256) e não duplica", async () => {
    const csv = await exportEntity("faltas", db);
    const before = await target.db.absenceEvent.count();
    await expect(commitImport("faltas", csv, "faltas.csv", { allowPartial: false }, target.db)).rejects.toBeInstanceOf(ImportRefused);
    // Mesmo conteúdo com outro byte (nova linha no fim): hash diferente, mas ids existentes são ignorados.
    const outcome = await commitImport("faltas", `${csv}\r\n`, "faltas-2.csv", { allowPartial: false }, target.db);
    expect(outcome.imported).toBe(0);
    expect(await target.db.absenceEvent.count()).toBe(before);
  });
});

describe("pré-visualização e validação por linha", () => {
  const csv = [
    "data,procedimento,categoria,valor_faturado,pagador,seguradora,consultas",
    "03/10/2026,Restauração,Dentisteria,\"70,50\",particular,,03/10/2026 09:30-10:15",
    "31/02/2026,Restauração,Dentisteria,70,PRIVATE,,",
    "04/10/2026,Coroa,Coroa,600,Seguro,,",
    "05/10/2026,Coroa,Coroa,abc,PRIVATE,,05/10/2026 11:00-10:00",
  ].join("\n");

  it("aceita vírgula como separador e decimal com vírgula; mostra erros por linha", async () => {
    const preview = await previewImport("procedimentos", csv, db);
    expect(preview.total).toBe(4);
    expect(preview.valid).toBe(1);
    expect(preview.invalid).toBe(3);
    expect(preview.rows[1]!.errors.join()).toMatch(/Data inválida/);
    expect(preview.rows[2]!.errors.join()).toMatch(/seguradora/);
    expect(preview.rows[3]!.errors.join()).toMatch(/fim antes do início/);
  });

  it("por omissão uma linha inválida bloqueia o lote; importação parcial só se pedida", async () => {
    await expect(commitImport("procedimentos", csv, "x.csv", { allowPartial: false }, db)).rejects.toThrow(/inválida/);
    const outcome = await commitImport("procedimentos", csv, "x.csv", { allowPartial: true }, db);
    expect(outcome).toEqual({ imported: 1, skipped: 0, invalid: 3 });
    const imported = await db.procedure.findFirst({ where: { date: "2026-10-03" }, include: { sessions: true } });
    expect(imported!.billedCents).toBe(7_050);
    expect(imported!.sessions).toHaveLength(1);
  });

  it("colunas em falta são assinaladas", async () => {
    const preview = await previewImport("planos", "case_id;valor_total\nDC-2026-001;100", db);
    expect(preview.missingHeaders).toEqual(["data_apresentacao", "estado"]);
  });

  it("formato das consultas", () => {
    expect(parseSessions("02/09/2026 09:30-11:00|2026-09-09 09:30-10:15")).toEqual([
      { date: "2026-09-02", startMinute: 570, endMinute: 660 },
      { date: "2026-09-09", startMinute: 570, endMinute: 615 },
    ]);
    expect(() => parseSessions("ontem 9h")).toThrow();
  });
});
