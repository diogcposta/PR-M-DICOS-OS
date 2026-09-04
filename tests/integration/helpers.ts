import { prisma } from "@/lib/db/client";

export const CLINIC_A = "DEMO-CL-001";
export const CLINIC_B = "DEMO-CL-002";
export const DOCTOR_A = "DEMO-DR-001";
export const DOCTOR_B = "DEMO-DR-002";

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
      { organizationId: organization.id, externalId: CLINIC_A, name: "Unidade A (teste)" },
      { organizationId: organization.id, externalId: CLINIC_B, name: "Unidade B (teste)" },
    ],
  });

  await prisma.practitioner.createMany({
    data: [
      { organizationId: organization.id, externalId: DOCTOR_A, displayName: "Dr. Teste Um" },
      { organizationId: organization.id, externalId: DOCTOR_B, displayName: "Dra. Teste Dois" },
    ],
  });

  return organization.id;
}
