/**
 * Seed de desenvolvimento — exclusivamente dados sintéticos.
 *
 * Cria uma organização, duas clínicas e dois médicos fictícios, mais um perfil
 * de mapeamento de agenda marcado como sintético.
 *
 * Não cria factos de propósito: na Fase 1 o dashboard tem de mostrar estados
 * vazios honestos. Números inventados dariam a ideia falsa de que já existem
 * dados importados.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { ImportSourceType, PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não está definido. Copie .env.example para .env.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { slug: "clinica-demo" },
    update: {},
    create: {
      name: "Organização de demonstração (dados sintéticos)",
      slug: "clinica-demo",
      timezone: "Europe/Lisbon",
    },
  });

  const clinics = [
    { externalId: "CLINIC-001", name: "CLINIC-001 — Unidade Norte (sintética)" },
    { externalId: "CLINIC-002", name: "CLINIC-002 — Unidade Sul (sintética)" },
  ];

  for (const clinic of clinics) {
    await prisma.clinic.upsert({
      where: {
        organizationId_externalId: {
          organizationId: organization.id,
          externalId: clinic.externalId,
        },
      },
      update: { name: clinic.name },
      create: { ...clinic, organizationId: organization.id },
    });
  }

  const practitioners = [
    { externalId: "DOCTOR-001", displayName: "DOCTOR-001 (sintético)", specialty: "Medicina dentária" },
    { externalId: "DOCTOR-002", displayName: "DOCTOR-002 (sintético)", specialty: "Ortodontia" },
  ];

  for (const practitioner of practitioners) {
    await prisma.practitioner.upsert({
      where: {
        organizationId_externalId: {
          organizationId: organization.id,
          externalId: practitioner.externalId,
        },
      },
      update: { displayName: practitioner.displayName },
      create: { ...practitioner, organizationId: organization.id },
    });
  }

  // Perfil propositadamente sintético. Não conhecemos os cabeçalhos reais do
  // Newsoft e não os vamos inventar (ver CLAUDE.md): o perfil real será um
  // registo novo, com chave própria, quando houver uma amostra anonimizada.
  await prisma.importProfile.upsert({
    where: {
      organizationId_key_version: {
        organizationId: organization.id,
        key: "SYNTHETIC_AGENDA_V1",
        version: 1,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      key: "SYNTHETIC_AGENDA_V1",
      version: 1,
      sourceType: ImportSourceType.APPOINTMENTS,
      name: "Agenda sintética v1 (perfil de demonstração; não corresponde a nenhuma exportação real)",
      isSynthetic: true,
      mapping: {
        note: "Perfil de demonstração. Substituído por um perfil real quando existir uma exportação anonimizada; ver README.",
        columns: {},
      },
    },
  });

  const counts = {
    organizations: await prisma.organization.count(),
    clinics: await prisma.clinic.count(),
    practitioners: await prisma.practitioner.count(),
    importProfiles: await prisma.importProfile.count(),
    facts: await prisma.appointmentFact.count(),
  };

  console.log("Seed sintético concluído:", counts);
}

main()
  .catch((error: unknown) => {
    console.error("Seed falhou:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
