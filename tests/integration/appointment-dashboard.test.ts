import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { getAppointmentDashboard } from "@/modules/kpis/application/get-appointment-dashboard";
import { CLINIC_A, CLINIC_B, DOCTOR_A, DOCTOR_B, resetDatabase } from "./helpers";

let organizationId: string;
let clinicA: string;
let clinicB: string;
let doctorA: string;
let doctorB: string;
let batchId: string;

type Status = "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELLED" | "RESCHEDULED";

let rowCounter = 0;

/** Cria um facto de agenda num instante UTC exato. */
async function fact(input: {
  occurredAt: string;
  status: Status;
  clinicId?: string;
  practitionerId?: string | null;
}): Promise<void> {
  rowCounter += 1;
  await prisma.appointmentFact.create({
    data: {
      organizationId,
      clinicId: input.clinicId ?? clinicA,
      practitionerId: input.practitionerId === undefined ? doctorA : input.practitionerId,
      stableRowKey: `TEST:${rowCounter}`,
      occurredAt: new Date(input.occurredAt),
      status: input.status,
      importBatchId: batchId,
      sourceRowNumber: rowCounter + 1,
    },
  });
}

beforeEach(async () => {
  organizationId = await resetDatabase();
  rowCounter = 0;

  const [a, b] = await Promise.all([
    prisma.clinic.findFirstOrThrow({ where: { externalId: CLINIC_A } }),
    prisma.clinic.findFirstOrThrow({ where: { externalId: CLINIC_B } }),
  ]);
  clinicA = a.id;
  clinicB = b.id;

  const [dA, dB] = await Promise.all([
    prisma.practitioner.findFirstOrThrow({ where: { externalId: DOCTOR_A } }),
    prisma.practitioner.findFirstOrThrow({ where: { externalId: DOCTOR_B } }),
  ]);
  doctorA = dA.id;
  doctorB = dB.id;

  const batch = await prisma.importBatch.create({
    data: {
      organizationId,
      originalFilename: "teste.csv",
      fileHash: "0".repeat(64),
      fileSizeBytes: 10,
      sourceType: "APPOINTMENTS",
      status: "COMMITTED",
      rowsTotal: 0,
      rowsValid: 0,
      rowsInvalid: 0,
      rowsCommitted: 0,
    },
  });
  batchId = batch.id;
});

const query = (overrides: Partial<Parameters<typeof getAppointmentDashboard>[0]> = {}) =>
  getAppointmentDashboard({
    organizationId,
    fromDate: "2025-01-01",
    toDate: "2025-01-31",
    ...overrides,
  });

describe("fronteiras do período", () => {
  it("inclui o primeiro instante e exclui o primeiro instante do dia seguinte", async () => {
    // Janeiro: Lisboa = UTC.
    await fact({ occurredAt: "2024-12-31T23:59:59.999Z", status: "COMPLETED" });
    await fact({ occurredAt: "2025-01-01T00:00:00.000Z", status: "COMPLETED" });
    await fact({ occurredAt: "2025-01-31T23:59:59.999Z", status: "COMPLETED" });
    await fact({ occurredAt: "2025-02-01T00:00:00.000Z", status: "COMPLETED" });

    const dashboard = await query();
    // Só os dois do meio pertencem a janeiro.
    expect(dashboard.counts.COMPLETED).toBe(2);
  });

  it("usa a meia-noite de Lisboa, não a de UTC, no verão", async () => {
    // 30/06 às 23:30 UTC já é 1 de julho em Lisboa (UTC+1).
    await fact({ occurredAt: "2025-06-30T23:30:00.000Z", status: "COMPLETED" });

    const junho = await query({ fromDate: "2025-06-01", toDate: "2025-06-30" });
    const julho = await query({ fromDate: "2025-07-01", toDate: "2025-07-31" });

    expect(junho.counts.COMPLETED).toBe(0);
    expect(julho.counts.COMPLETED).toBe(1);
  });

  it("conta corretamente no dia da mudança para a hora de verão", async () => {
    // 30/03/2025 tem 23 horas em Lisboa.
    await fact({ occurredAt: "2025-03-30T09:30:00.000Z", status: "COMPLETED" });
    const dashboard = await query({ fromDate: "2025-03-30", toDate: "2025-03-30" });
    expect(dashboard.counts.COMPLETED).toBe(1);
  });
});

describe("filtros", () => {
  beforeEach(async () => {
    await fact({ occurredAt: "2025-01-10T09:00:00.000Z", status: "COMPLETED", clinicId: clinicA, practitionerId: doctorA });
    await fact({ occurredAt: "2025-01-11T09:00:00.000Z", status: "COMPLETED", clinicId: clinicA, practitionerId: doctorB });
    await fact({ occurredAt: "2025-01-12T09:00:00.000Z", status: "NO_SHOW", clinicId: clinicB, practitionerId: doctorA });
    await fact({ occurredAt: "2025-01-13T09:00:00.000Z", status: "CANCELLED", clinicId: clinicB, practitionerId: doctorB });
  });

  it("sem filtros conta tudo", async () => {
    const dashboard = await query();
    expect(dashboard.kpis.appointments_scheduled.current.value).toBe(4);
  });

  it("filtra por clínica", async () => {
    const dashboard = await query({ clinicId: clinicA });
    expect(dashboard.kpis.appointments_scheduled.current.value).toBe(2);
    expect(dashboard.counts.COMPLETED).toBe(2);
  });

  it("filtra por médico", async () => {
    const dashboard = await query({ practitionerId: doctorA });
    expect(dashboard.kpis.appointments_scheduled.current.value).toBe(2);
    expect(dashboard.counts.NO_SHOW).toBe(1);
  });

  it("combina clínica e médico", async () => {
    const dashboard = await query({ clinicId: clinicB, practitionerId: doctorB });
    expect(dashboard.kpis.appointments_scheduled.current.value).toBe(1);
    expect(dashboard.counts.CANCELLED).toBe(1);
  });

  it("o filtro muda o denominador, não só o numerador", async () => {
    const todas = await query();
    const soClinicaA = await query({ clinicId: clinicA });

    expect(todas.kpis.completion_rate.current.denominator).toBe(4);
    expect(todas.kpis.completion_rate.current.value).toBe(50);
    expect(soClinicaA.kpis.completion_rate.current.denominator).toBe(2);
    expect(soClinicaA.kpis.completion_rate.current.value).toBe(100);
  });

  it("devolve vazio quando o filtro não tem consultas", async () => {
    const dashboard = await query({ fromDate: "2024-01-01", toDate: "2024-01-31" });
    expect(dashboard.isEmpty).toBe(true);
    expect(dashboard.kpis.completion_rate.current.value).toBeNull();
  });

  it("lista as clínicas e médicos disponíveis para filtrar", async () => {
    const dashboard = await query();
    expect(dashboard.clinics).toHaveLength(2);
    expect(dashboard.practitioners).toHaveLength(2);
  });
});

describe("comparação com o período anterior", () => {
  it("compara com um período contíguo de igual duração", async () => {
    // Janeiro: 3 realizadas. Dezembro (período anterior de 31 dias): 2.
    await fact({ occurredAt: "2025-01-05T09:00:00.000Z", status: "COMPLETED" });
    await fact({ occurredAt: "2025-01-06T09:00:00.000Z", status: "COMPLETED" });
    await fact({ occurredAt: "2025-01-07T09:00:00.000Z", status: "COMPLETED" });
    await fact({ occurredAt: "2024-12-10T09:00:00.000Z", status: "COMPLETED" });
    await fact({ occurredAt: "2024-12-11T09:00:00.000Z", status: "COMPLETED" });

    const dashboard = await query();

    expect(dashboard.comparisonPeriod.fromDate).toBe("2024-12-01");
    expect(dashboard.comparisonPeriod.toDate).toBe("2024-12-31");
    expect(dashboard.previousCounts.COMPLETED).toBe(2);
    expect(dashboard.kpis.appointments_completed.change).toBeCloseTo(0.5);
  });

  it("não compara quando o período anterior está vazio", async () => {
    await fact({ occurredAt: "2025-01-05T09:00:00.000Z", status: "COMPLETED" });
    const dashboard = await query();
    expect(dashboard.previousCounts.COMPLETED).toBe(0);
    expect(dashboard.kpis.appointments_completed.change).toBeNull();
  });

  it("aplica os mesmos filtros aos dois períodos", async () => {
    await fact({ occurredAt: "2025-01-05T09:00:00.000Z", status: "COMPLETED", clinicId: clinicA });
    await fact({ occurredAt: "2024-12-05T09:00:00.000Z", status: "COMPLETED", clinicId: clinicB });

    const dashboard = await query({ clinicId: clinicA });
    // A consulta de dezembro é da clínica B: não pode entrar na comparação.
    expect(dashboard.previousCounts.COMPLETED).toBe(0);
  });
});

describe("série mensal", () => {
  it("agrupa por mês civil de Lisboa", async () => {
    await fact({ occurredAt: "2025-01-15T09:00:00.000Z", status: "COMPLETED" });
    await fact({ occurredAt: "2025-02-10T09:00:00.000Z", status: "NO_SHOW" });
    await fact({ occurredAt: "2025-02-11T09:00:00.000Z", status: "COMPLETED" });

    const dashboard = await query({ fromDate: "2025-01-01", toDate: "2025-03-31" });

    expect(dashboard.monthly.map((point) => point.month)).toEqual(["2025-01", "2025-02"]);
    expect(dashboard.monthly[0]?.counts.COMPLETED).toBe(1);
    expect(dashboard.monthly[1]?.counts.NO_SHOW).toBe(1);
    expect(dashboard.monthly[1]?.counts.COMPLETED).toBe(1);
  });

  it("põe no mês certo uma consulta na fronteira, apesar do fuso", async () => {
    // 31/07 às 23:30 UTC é 1 de agosto às 00:30 em Lisboa.
    await fact({ occurredAt: "2025-07-31T23:30:00.000Z", status: "COMPLETED" });

    const dashboard = await query({ fromDate: "2025-07-01", toDate: "2025-08-31" });
    // Agrupar em UTC poria isto em julho, que é o mês errado.
    expect(dashboard.monthly).toHaveLength(1);
    expect(dashboard.monthly[0]?.month).toBe("2025-08");
  });

  it("respeita os filtros", async () => {
    await fact({ occurredAt: "2025-01-15T09:00:00.000Z", status: "COMPLETED", clinicId: clinicA });
    await fact({ occurredAt: "2025-01-16T09:00:00.000Z", status: "COMPLETED", clinicId: clinicB });

    const dashboard = await query({ clinicId: clinicA });
    expect(dashboard.monthly[0]?.counts.COMPLETED).toBe(1);
  });
});

describe("proveniência", () => {
  it("identifica os lotes que originaram os factos do período", async () => {
    await fact({ occurredAt: "2025-01-05T09:00:00.000Z", status: "COMPLETED" });
    const dashboard = await query();
    expect(dashboard.sourceBatchIds).toEqual([batchId]);
  });
});
