/**
 * Serviço de aplicação: estado do dashboard.
 *
 * Na Fase 1 não existe cálculo de KPIs — existe apenas a resposta honesta à
 * pergunta "há dados para mostrar?". O dashboard consulta os factos reais; se
 * não houver nenhum, diz que não há, em vez de mostrar zeros.
 */
import { prisma } from "@/lib/db/client";
import { KPI_CATALOG } from "@/modules/kpis/domain/catalog";

export interface DashboardSummary {
  readonly hasImportedData: boolean;
  readonly committedBatches: number;
  readonly appointmentFacts: number;
  readonly financialFacts: number;
  readonly clinics: number;
  readonly practitioners: number;
  /** KPIs prontos a calcular. Zero enquanto as definições não forem aprovadas. */
  readonly readyKpiCount: number;
  readonly catalogueSize: number;
}

export async function getDashboardSummary(organizationId: string): Promise<DashboardSummary> {
  const [committedBatches, appointmentFacts, financialFacts, clinics, practitioners] =
    await Promise.all([
      prisma.importBatch.count({ where: { organizationId, status: "COMMITTED" } }),
      prisma.appointmentFact.count({ where: { organizationId } }),
      prisma.financialFact.count({ where: { organizationId } }),
      prisma.clinic.count({ where: { organizationId } }),
      prisma.practitioner.count({ where: { organizationId } }),
    ]);

  return {
    hasImportedData: appointmentFacts + financialFacts > 0,
    committedBatches,
    appointmentFacts,
    financialFacts,
    clinics,
    practitioners,
    readyKpiCount: KPI_CATALOG.filter((d) => d.status === "ACTIVE").length,
    catalogueSize: KPI_CATALOG.length,
  };
}
