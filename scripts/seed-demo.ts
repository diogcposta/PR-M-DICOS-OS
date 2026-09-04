/**
 * Prepara a demonstração de forma repetível.
 *
 *   npm run demo:seed
 *
 * Regenera as fixtures, garante que a organização sintética existe e importa o
 * conjunto de demonstração pelo mesmo caminho de código que o ecrã usa — o
 * serviço de aplicação `commitAppointmentFile`, com transação, deduplicação e
 * registo de erros por linha. Não escreve factos diretamente na base: se o
 * fizesse, a demonstração deixaria de provar que o importador funciona.
 *
 * É idempotente: correr duas vezes seguidas dá o mesmo estado final, e a
 * segunda importação é recusada como duplicada — o que também é uma
 * demonstração útil.
 */
// O tsx não carrega .env sozinho (ao contrário do CLI do Prisma, que o faz via
// prisma.config.ts). Tem de vir antes de qualquer import que leia o ambiente.
import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/db/client.js";
import { commitAppointmentFile } from "../src/modules/imports/application/commit-file.js";
import { SYNTHETIC_APPOINTMENT_MAPPING } from "../src/modules/imports/domain/appointment-profile.js";
import {
  SYNTHETIC_CLINICS,
  SYNTHETIC_DOCTORS,
} from "../src/modules/imports/domain/synthetic-dataset.js";

const FIXTURES = path.join(process.cwd(), "tests/fixtures");

/**
 * Garante a organização, as clínicas e os médicos de demonstração.
 *
 * O importador recusa clínicas e médicos desconhecidos em vez de os criar
 * (D-018), por isso têm de existir antes da importação.
 */
async function ensureDemoOrganization(): Promise<string> {
  const organization = await prisma.organization.upsert({
    where: { slug: "clinica-demo" },
    update: {},
    create: {
      name: "Organização de demonstração (dados sintéticos)",
      slug: "clinica-demo",
      timezone: "Europe/Lisbon",
    },
  });

  for (const externalId of SYNTHETIC_CLINICS) {
    await prisma.clinic.upsert({
      where: {
        organizationId_externalId: { organizationId: organization.id, externalId },
      },
      update: {},
      create: {
        organizationId: organization.id,
        externalId,
        name: `${externalId} (sintética)`,
      },
    });
  }

  for (const externalId of SYNTHETIC_DOCTORS) {
    await prisma.practitioner.upsert({
      where: {
        organizationId_externalId: { organizationId: organization.id, externalId },
      },
      update: {},
      create: {
        organizationId: organization.id,
        externalId,
        displayName: `${externalId} (sintético)`,
      },
    });
  }

  return organization.id;
}

async function importFixture(
  organizationId: string,
  filename: string,
): Promise<void> {
  const content = await readFile(path.join(FIXTURES, filename));

  const outcome = await commitAppointmentFile({
    organizationId,
    filename,
    content,
    mapping: SYNTHETIC_APPOINTMENT_MAPPING,
    // O conjunto traz linhas inválidas de propósito. Gravar só as válidas é uma
    // escolha explícita (D-008) — aqui fazemo-la em nome do utilizador porque o
    // objetivo é precisamente demonstrar o relatório de erros.
    rowPolicy: "VALID_ROWS_ONLY",
  });

  if (outcome.kind === "COMMITTED") {
    console.log(
      `  ${filename}: ${outcome.rowsAccepted} aceites, ${outcome.rowsRejected} rejeitadas, ${outcome.rowsIgnored} ignoradas (de ${outcome.rowsTotal})`,
    );
  } else if (outcome.kind === "DUPLICATE") {
    console.log(`  ${filename}: já tinha sido importado; nenhum facto gravado`);
  } else {
    console.log(`  ${filename}: recusado — ${outcome.reason}`);
  }
}

async function main(): Promise<void> {
  console.log("A preparar a demonstração com dados sintéticos…");

  const organizationId = await ensureDemoOrganization();
  await importFixture(organizationId, "demo-agenda.csv");

  const [facts, batches, errors, range] = await Promise.all([
    prisma.appointmentFact.count({ where: { organizationId } }),
    prisma.importBatch.count({ where: { organizationId } }),
    prisma.importRowError.count(),
    prisma.appointmentFact.aggregate({
      where: { organizationId },
      _min: { occurredAt: true },
      _max: { occurredAt: true },
    }),
  ]);

  console.log("\nDemonstração pronta:", {
    consultas: facts,
    lotes: batches,
    errosRegistados: errors,
    de: range._min.occurredAt?.toISOString().slice(0, 10) ?? "—",
    ate: range._max.occurredAt?.toISOString().slice(0, 10) ?? "—",
  });
  console.log("\nAbra http://localhost:3000 depois de `npm run dev`.");
}

main()
  .catch((error: unknown) => {
    console.error("A preparação da demonstração falhou:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
