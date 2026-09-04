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
      name: "Clínica Demo (dados sintéticos)",
      slug: "clinica-demo",
      timezone: "Europe/Lisbon",
    },
  });

  const clinics = [
    { externalId: "DEMO-CL-001", name: "Unidade Norte (demo)" },
    { externalId: "DEMO-CL-002", name: "Unidade Sul (demo)" },
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
    { externalId: "DEMO-DR-001", displayName: "Dr. Exemplo Um", specialty: "Medicina dentária" },
    { externalId: "DEMO-DR-002", displayName: "Dra. Exemplo Dois", specialty: "Ortodontia" },
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

  // Perfil de mapeamento propositadamente sintético: não conhecemos ainda os
  // cabeçalhos reais do Newsoft e não os vamos inventar (ver CLAUDE.md).
  await prisma.importProfile.upsert({
    where: {
      organizationId_key_version: {
        organizationId: organization.id,
        key: "agenda-sintetica",
        version: 1,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      key: "agenda-sintetica",
      version: 1,
      sourceType: ImportSourceType.APPOINTMENTS,
      name: "Agenda — perfil sintético (por confirmar com exportação real)",
      isSynthetic: true,
      mapping: {
        note: "Placeholder da Fase 1. O mapeamento real é definido na Fase 2, a partir de uma exportação anonimizada.",
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
