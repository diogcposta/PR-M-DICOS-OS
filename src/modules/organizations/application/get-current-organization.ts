/**
 * Organização em contexto.
 *
 * O MVP não tem autenticação (D-006 continua pendente) e não vamos inventar uma
 * sessão falsa. Até haver autenticação, o contexto é a única organização
 * existente na base — e a ausência dela é um erro explícito, não um silêncio.
 */
import { prisma } from "@/lib/db/client";

export interface OrganizationContext {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
}

export async function getCurrentOrganization(): Promise<OrganizationContext | null> {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, timezone: true },
  });
  return organization;
}
