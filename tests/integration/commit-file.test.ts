import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/client";
import { commitAppointmentFile } from "@/modules/imports/application/commit-file";
import { inspectFile } from "@/modules/imports/application/inspect-file";
import { SYNTHETIC_APPOINTMENT_MAPPING } from "@/modules/imports/domain/appointment-profile";
import { resetDatabase } from "./helpers";

const FIXTURES = path.join(process.cwd(), "tests/fixtures");
const MAPPING = SYNTHETIC_APPOINTMENT_MAPPING;

const fixture = (name: string): Promise<Buffer> => readFile(path.join(FIXTURES, name));

let organizationId: string;

beforeEach(async () => {
  organizationId = await resetDatabase();
});

async function commit(
  name: string,
  overrides: Partial<Parameters<typeof commitAppointmentFile>[0]> = {},
) {
  return commitAppointmentFile({
    organizationId,
    filename: name,
    content: await fixture(name),
    mapping: MAPPING,
    rowPolicy: "ALL_OR_NOTHING",
    ...overrides,
  });
}

describe("confirmação de um ficheiro válido", () => {
  it("grava os factos e fecha o lote como COMMITTED", async () => {
    const outcome = await commit("agenda-valida.csv");

    expect(outcome.kind).toBe("COMMITTED");
    expect(outcome.kind === "COMMITTED" && outcome.rowsAccepted).toBe(6);

    const facts = await prisma.appointmentFact.findMany({ orderBy: { occurredAt: "asc" } });
    expect(facts).toHaveLength(6);

    const batch = await prisma.importBatch.findFirstOrThrow();
    expect(batch.status).toBe("COMMITTED");
    expect(batch.rowsCommitted).toBe(6);
    expect(batch.committedAt).not.toBeNull();
    expect(batch.fileHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normaliza estados e datas na gravação", async () => {
    await commit("agenda-valida.csv");
    const fact = await prisma.appointmentFact.findFirstOrThrow({
      where: { sourceRecordId: "SYN-0001" },
    });

    expect(fact.status).toBe("COMPLETED");
    expect(fact.sourceStatusLabel).toBe("Realizada");
    expect(fact.occurredAt.toISOString()).toBe("2025-01-06T09:00:00.000Z");

    // 30/03/2025 é o dia da mudança para a hora de verão: 10:30 locais são 09:30 UTC.
    const dstFact = await prisma.appointmentFact.findFirstOrThrow({
      where: { sourceRecordId: "SYN-0006" },
    });
    expect(dstFact.occurredAt.toISOString()).toBe("2025-03-30T09:30:00.000Z");
  });

  it("liga cada facto ao lote e à linha de origem", async () => {
    const outcome = await commit("agenda-valida.csv");
    const fact = await prisma.appointmentFact.findFirstOrThrow({
      where: { sourceRecordId: "SYN-0001" },
    });
    expect(fact.importBatchId).toBe(outcome.batchId);
    expect(fact.sourceRowNumber).toBe(2);
  });

  it("grava o perfil de mapeamento versionado", async () => {
    await commit("agenda-valida.csv");
    const profile = await prisma.importProfile.findFirstOrThrow();
    expect(profile.key).toBe("SYNTHETIC_AGENDA_V1");
    expect(profile.version).toBe(1);
    // O perfil continua marcado como sintético: não vem de uma amostra real.
    expect(profile.isSynthetic).toBe(true);
  });

  it("lê o .xlsx com o mesmo resultado do .csv equivalente", async () => {
    const outcome = await commit("agenda-valida.xlsx");
    expect(outcome.kind === "COMMITTED" && outcome.rowsAccepted).toBe(6);
    expect(await prisma.appointmentFact.count()).toBe(6);
  });
});

describe("deduplicação", () => {
  it("marca como DUPLICATE o mesmo ficheiro e não grava factos novos", async () => {
    await commit("agenda-valida.csv");
    const second = await commit("agenda-valida.csv");

    expect(second.kind).toBe("DUPLICATE");
    expect(await prisma.appointmentFact.count()).toBe(6);

    const duplicateBatch = await prisma.importBatch.findFirstOrThrow({
      where: { status: "DUPLICATE" },
    });
    expect(duplicateBatch.rowsCommitted).toBe(0);
    // O lote duplicado fica registado para auditoria, em vez de desaparecer.
    expect(await prisma.importBatch.count()).toBe(2);
  });

  it("avisa na pré-visualização que o ficheiro já foi importado", async () => {
    await commit("agenda-valida.csv");
    const preview = await inspectFile({
      organizationId,
      filename: "agenda-valida.csv",
      content: await fixture("agenda-valida.csv"),
    });
    expect(preview.alreadyCommitted).not.toBeNull();
  });

  it("não duplica factos quando um ficheiro diferente contém as mesmas consultas", async () => {
    await commit("agenda-valida.csv");

    // Mesmo conteúdo com uma linha extra: hash diferente, logo não é duplicado
    // de ficheiro — mas as consultas repetidas não podem entrar duas vezes.
    const original = (await fixture("agenda-valida.csv")).toString("utf8");
    const extended = Buffer.from(
      `${original.trimEnd()}\nSYN-0007;10/01/2025 09:00;CLINIC-001;DOCTOR-001;PATIENT-007;Agendada;30\n`,
    );

    const outcome = await commitAppointmentFile({
      organizationId,
      filename: "agenda-valida-mais-uma.csv",
      content: extended,
      mapping: MAPPING,
      rowPolicy: "ALL_OR_NOTHING",
    });

    expect(outcome.kind).toBe("COMMITTED");
    // Só a linha nova entrou: as 6 anteriores foram ignoradas pela chave estável.
    expect(outcome.kind === "COMMITTED" && outcome.rowsAccepted).toBe(1);
    // As 6 anteriores já existiam: ignoradas, não rejeitadas.
    expect(outcome.kind === "COMMITTED" && outcome.rowsIgnored).toBe(6);
    expect(await prisma.appointmentFact.count()).toBe(7);
  });

  it("grava uma só vez linhas repetidas dentro do mesmo ficheiro", async () => {
    const outcome = await commit("agenda-com-repetidas.csv");
    expect(outcome.kind === "COMMITTED" && outcome.rowsAccepted).toBe(2);
    // A terceira linha é repetida: ignorada, não rejeitada.
    expect(outcome.kind === "COMMITTED" && outcome.rowsIgnored).toBe(1);
    expect(outcome.kind === "COMMITTED" && outcome.rowsRejected).toBe(0);
    expect(await prisma.appointmentFact.count()).toBe(2);
  });

  it("as três contagens do resumo somam sempre o total de linhas", async () => {
    const outcome = await commit("agenda-com-erros.csv", { rowPolicy: "VALID_ROWS_ONLY" });
    if (outcome.kind !== "COMMITTED") throw new Error("esperava COMMITTED");
    expect(outcome.rowsAccepted + outcome.rowsRejected + outcome.rowsIgnored).toBe(
      outcome.rowsTotal,
    );
  });
});

describe("política de linhas inválidas (D-008)", () => {
  it("por omissão recusa o lote inteiro e não grava nada", async () => {
    const outcome = await commit("agenda-com-erros.csv");

    expect(outcome.kind).toBe("REJECTED");
    expect(await prisma.appointmentFact.count()).toBe(0);

    const batch = await prisma.importBatch.findFirstOrThrow();
    expect(batch.status).toBe("REJECTED");
    expect(batch.rowsCommitted).toBe(0);
    expect(batch.failureReason).toMatch(/inválidas/);
  });

  it("grava apenas as válidas quando o gestor o escolhe explicitamente", async () => {
    const outcome = await commit("agenda-com-erros.csv", { rowPolicy: "VALID_ROWS_ONLY" });

    expect(outcome.kind).toBe("COMMITTED");
    // 8 linhas: 1 aceite, 7 rejeitadas por erro, 0 ignoradas.
    expect(outcome.kind === "COMMITTED" && outcome.rowsAccepted).toBe(1);
    expect(outcome.kind === "COMMITTED" && outcome.rowsRejected).toBe(7);
    expect(outcome.kind === "COMMITTED" && outcome.rowsIgnored).toBe(0);
    expect(await prisma.appointmentFact.count()).toBe(1);
  });

  it("regista os erros por linha, com coluna e código", async () => {
    await commit("agenda-com-erros.csv", { rowPolicy: "VALID_ROWS_ONLY" });
    const errors = await prisma.importRowError.findMany({ orderBy: { sourceRowNumber: "asc" } });

    const codes = errors.map((error) => error.code);
    expect(codes).toContain("DATE_OUT_OF_RANGE");
    expect(codes).toContain("STATUS_UNMAPPED");
    expect(codes).toContain("DATE_MISSING");
    expect(codes).toContain("CLINIC_ID_MISSING");
    expect(codes).toContain("CLINIC_UNKNOWN");
    expect(codes).toContain("PRACTITIONER_UNKNOWN");
    expect(codes).toContain("DURATION_INVALID");

    // O número da linha é o do Excel, para o gestor a encontrar.
    expect(errors.every((error) => error.sourceRowNumber >= 2)).toBe(true);
  });

  it("não regista nomes nem conteúdo de células nas mensagens de linha em falta", async () => {
    await commit("agenda-com-erros.csv", { rowPolicy: "VALID_ROWS_ONLY" });
    const errors = await prisma.importRowError.findMany();
    // As referências de paciente do ficheiro nunca entram nas mensagens.
    expect(errors.some((error) => error.message.includes("PATIENT-"))).toBe(false);
  });
});

describe("integridade transacional", () => {
  it("não deixa lote nem factos se a transação falhar depois das escritas", async () => {
    const content = await fixture("agenda-valida.csv");
    const realTransaction = prisma.$transaction.bind(prisma);

    // Deixamos o lote, os erros e os factos serem escritos e só então rebentamos,
    // ainda dentro da transação. É o pior caso: se o rollback não funcionasse,
    // ficaria um ImportBatch a dizer COMMITTED com factos meio gravados.
    const spy = vi
      .spyOn(prisma, "$transaction")
      .mockImplementationOnce((callback: unknown) =>
        (realTransaction as (cb: unknown) => Promise<unknown>)(async (tx: unknown) => {
          await (callback as (tx: unknown) => Promise<unknown>)(tx);
          throw new Error("falha simulada da base de dados");
        }),
      );

    await expect(
      commitAppointmentFile({
        organizationId,
        filename: "agenda-valida.csv",
        content,
        mapping: MAPPING,
        rowPolicy: "ALL_OR_NOTHING",
      }),
    ).rejects.toThrow("falha simulada");

    spy.mockRestore();

    // Estado coerente: nem factos, nem lote, nem erros a meio caminho.
    expect(await prisma.appointmentFact.count()).toBe(0);
    expect(await prisma.importBatch.count()).toBe(0);
    expect(await prisma.importRowError.count()).toBe(0);
  });

  it("recusa a confirmação quando o ficheiro não é o que foi pré-visualizado", async () => {
    const preview = await inspectFile({
      organizationId,
      filename: "agenda-valida.csv",
      content: await fixture("agenda-valida.csv"),
    });

    await expect(
      commitAppointmentFile({
        organizationId,
        filename: "agenda-com-repetidas.csv",
        content: await fixture("agenda-com-repetidas.csv"),
        mapping: MAPPING,
        rowPolicy: "ALL_OR_NOTHING",
        expectedFileHash: preview.fileHash,
      }),
    ).rejects.toThrow(/não é o mesmo/);

    expect(await prisma.appointmentFact.count()).toBe(0);
  });

  it("recusa o lote quando falta uma coluna obrigatória no mapeamento", async () => {
    const outcome = await commit("agenda-valida.csv", {
      mapping: {
        ...MAPPING,
        columns: { ...MAPPING.columns, occurredAt: null },
      },
    });

    expect(outcome.kind).toBe("REJECTED");
    expect(outcome.kind === "REJECTED" && outcome.reason).toMatch(/occurredAt/);
    expect(await prisma.appointmentFact.count()).toBe(0);
  });
});
