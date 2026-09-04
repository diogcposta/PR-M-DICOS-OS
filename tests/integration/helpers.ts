import { prisma } from "@/lib/db/client";

export const CLINIC_A = "CLINIC-001";
export const CLINIC_B = "CLINIC-002";
export const DOCTOR_A = "DOCTOR-001";
export const DOCTOR_B = "DOCTOR-002";

/** Base limpa com a organização sintética mínima. Devolve o organizationId. */
export async function resetDatabase(): Promise<string> {
  // A ordem respeita as chaves estrangeiras.
  await prisma.appointmentFact.deleteMany();
  await prisma.financialFact.deleteMany();
  await prisma.budgetFact.deleteMany();
  await prisma.patientStatusSnapshot.deleteMany();
  await prisma.importRowError.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.importProfile.deleteMany();
  await prisma.practitioner.deleteMany();
  await prisma.clinic.deleteMany();
  await prisma.organization.deleteMany();

  const organization = await prisma.organization.create({
    data: { name: "Organização de teste", slug: "teste", timezone: "Europe/Lisbon" },
  });

  await prisma.clinic.createMany({
    data: [
      { organizationId: organization.id, externalId: CLINIC_A, name: "CLINIC-001 (teste)" },
      { organizationId: organization.id, externalId: CLINIC_B, name: "CLINIC-002 (teste)" },
    ],
  });

  await prisma.practitioner.createMany({
    data: [
      { organizationId: organization.id, externalId: DOCTOR_A, displayName: "DOCTOR-001 (teste)" },
      { organizationId: organization.id, externalId: DOCTOR_B, displayName: "DOCTOR-002 (teste)" },
    ],
  });

  return organization.id;
}

/**
 * Cria uma segunda organização, com os mesmos identificadores externos de
 * clínica e médico da primeira.
 *
 * Usar os mesmos `externalId` é deliberado: prova que o isolamento vem da
 * chave composta `(organizationId, externalId)`, e não de identificadores por
 * acaso distintos entre as duas organizações.
 */
export async function createSecondOrganization(): Promise<string> {
  const organization = await prisma.organization.create({
    data: { name: "Outra organização de teste", slug: "outra-teste", timezone: "Europe/Lisbon" },
  });

  await prisma.clinic.createMany({
    data: [
      { organizationId: organization.id, externalId: CLINIC_A, name: "CLINIC-001 (outra org)" },
      { organizationId: organization.id, externalId: CLINIC_B, name: "CLINIC-002 (outra org)" },
    ],
  });

  await prisma.practitioner.createMany({
    data: [
      { organizationId: organization.id, externalId: DOCTOR_A, displayName: "DOCTOR-001 (outra org)" },
      { organizationId: organization.id, externalId: DOCTOR_B, displayName: "DOCTOR-002 (outra org)" },
    ],
  });

  return organization.id;
}
