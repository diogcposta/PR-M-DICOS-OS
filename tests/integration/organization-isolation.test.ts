/**
 * Isolamento entre organizações.
 *
 * `organizationId` está em todas as tabelas de negócio (CLAUDE.md) precisamente
 * para que os dados de uma clínica nunca apareçam nos números, nas listas ou
 * nos detalhes de outra. Estes testes usam duas organizações com os mesmos
 * identificadores externos de clínica e médico — de propósito, para provar que
 * o isolamento vem da chave composta `(organizationId, externalId)` e não de
 * identificadores que por acaso não colidem.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { commitAppointmentFile } from "@/modules/imports/application/commit-file";
import { getDataQualityReport } from "@/modules/imports/application/get-data-quality";
import { getImportBatch } from "@/modules/imports/application/get-import-batch";
import { listImportBatches } from "@/modules/imports/application/list-import-batches";
import { SYNTHETIC_APPOINTMENT_MAPPING } from "@/modules/imports/domain/appointment-profile";
import { getAppointmentDashboard } from "@/modules/kpis/application/get-appointment-dashboard";

import { createSecondOrganization, resetDatabase } from "./helpers";

const FIXTURES = path.join(process.cwd(), "tests/fixtures");
const MAPPING = SYNTHETIC_APPOINTMENT_MAPPING;

let organizationA: string;
let organizationB: string;

beforeEach(async () => {
  organizationA = await resetDatabase();
  organizationB = await createSecondOrganization();
});

async function commitInto(organizationId: string) {
  return commitAppointmentFile({
    organizationId,
    filename: "agenda-valida.csv",
    content: await readFile(path.join(FIXTURES, "agenda-valida.csv")),
    mapping: MAPPING,
    rowPolicy: "ALL_OR_NOTHING",
  });
}

describe("importação isolada por organização", () => {
  it("o mesmo ficheiro é aceite em duas organizações, sem ser visto como duplicado", async () => {
    const outcomeA = await commitInto(organizationA);
    const outcomeB = await commitInto(organizationB);

    expect(outcomeA.kind).toBe("COMMITTED");
    expect(outcomeB.kind).toBe("COMMITTED");

    expect(await prisma.appointmentFact.count({ where: { organizationId: organizationA } })).toBe(
      6,
    );
    expect(await prisma.appointmentFact.count({ where: { organizationId: organizationB } })).toBe(
      6,
    );
  });

  it("os factos de uma organização não contam para a outra", async () => {
    await commitInto(organizationA);
    // Organização B não importou nada.
    expect(await prisma.appointmentFact.count({ where: { organizationId: organizationB } })).toBe(
      0,
    );
    expect(await prisma.appointmentFact.count({ where: { organizationId: organizationA } })).toBe(
      6,
    );
  });

  it("cada organização usa a sua própria clínica, apesar do externalId igual", async () => {
    await commitInto(organizationA);
    await commitInto(organizationB);

    const factsA = await prisma.appointmentFact.findMany({
      where: { organizationId: organizationA },
      select: { clinicId: true },
    });
    const factsB = await prisma.appointmentFact.findMany({
      where: { organizationId: organizationB },
      select: { clinicId: true },
    });

    const clinicIdsA = new Set(factsA.map((fact) => fact.clinicId));
    const clinicIdsB = new Set(factsB.map((fact) => fact.clinicId));

    // Mesmo externalId ("CLINIC-001"), mas são linhas diferentes na base.
    for (const id of clinicIdsA) {
      expect(clinicIdsB.has(id)).toBe(false);
    }
  });
});

describe("histórico de lotes isolado", () => {
  it("uma organização não vê os lotes da outra", async () => {
    const outcomeA = await commitInto(organizationA);
    expect(outcomeA.kind).toBe("COMMITTED");

    const batchesA = await listImportBatches(organizationA);
    const batchesB = await listImportBatches(organizationB);

    expect(batchesA).toHaveLength(1);
    expect(batchesB).toHaveLength(0);
  });

  it("o detalhe de um lote não é acessível através de outra organização", async () => {
    const outcomeA = await commitInto(organizationA);
    if (outcomeA.kind !== "COMMITTED") throw new Error("esperava COMMITTED");

    // O mesmo ID de lote, pedido com o organizationId errado, não existe.
    const detailFromOwner = await getImportBatch(organizationA, outcomeA.batchId);
    const detailFromOther = await getImportBatch(organizationB, outcomeA.batchId);

    expect(detailFromOwner).not.toBeNull();
    expect(detailFromOther).toBeNull();
  });
});

describe("dashboard de KPIs isolado", () => {
  it("os indicadores de uma organização não incluem factos da outra", async () => {
    await commitInto(organizationA);
    await commitInto(organizationB);

    // Duplicar as consultas de A não pode duplicar as de B.
    const dashboardA = await getAppointmentDashboard({
      organizationId: organizationA,
      fromDate: "2025-01-01",
      toDate: "2025-01-31",
    });
    const dashboardB = await getAppointmentDashboard({
      organizationId: organizationB,
      fromDate: "2025-01-01",
      toDate: "2025-01-31",
    });

    expect(dashboardA.kpis.appointments_scheduled.current.value).toBe(5);
    expect(dashboardB.kpis.appointments_scheduled.current.value).toBe(5);

    // Cada dashboard só cita os lotes da sua própria organização.
    expect(dashboardA.batches.every((batch) => batch.id !== dashboardB.batches[0]?.id)).toBe(
      true,
    );
  });

  it("os filtros de clínica de uma organização não devolvem opções da outra", async () => {
    const dashboardA = await getAppointmentDashboard({
      organizationId: organizationA,
      fromDate: "2025-01-01",
      toDate: "2025-01-31",
    });

    // As duas organizações têm 2 clínicas cada, com o mesmo externalId — mas
    // são linhas diferentes.
    expect(dashboardA.clinics).toHaveLength(2);
  });
});

describe("qualidade dos dados isolada", () => {
  it("o relatório de uma organização não conta lotes nem factos da outra", async () => {
    await commitInto(organizationA);
    await commitInto(organizationB);
    // Um segundo envio para A gera um lote duplicado, que só deve contar em A.
    await commitInto(organizationA);

    const reportA = await getDataQualityReport(organizationA, "Europe/Lisbon");
    const reportB = await getDataQualityReport(organizationB, "Europe/Lisbon");

    expect(reportA.batches).toHaveLength(2);
    expect(reportB.batches).toHaveLength(1);
    expect(reportA.totalFacts).toBe(6);
    expect(reportB.totalFacts).toBe(6);
    expect(reportA.duplicateBatches).toBe(1);
    expect(reportB.duplicateBatches).toBe(0);
  });
});
