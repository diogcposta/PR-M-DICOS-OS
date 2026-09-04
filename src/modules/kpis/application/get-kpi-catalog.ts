/**
 * Serviço de aplicação: catálogo de KPIs para apresentação.
 *
 * A página só recebe dados já preparados; a decisão sobre o que é apresentável
 * pertence a esta camada.
 */
import { KPI_CATALOG, type KpiDefinition } from "@/modules/kpis/domain/catalog";

export interface KpiCatalogView {
  readonly definitions: readonly KpiDefinition[];
  readonly activeCount: number;
  readonly pendingCount: number;
}

export function getKpiCatalog(): KpiCatalogView {
  const definitions = KPI_CATALOG;
  return {
    definitions,
    activeCount: definitions.filter((d) => d.status === "ACTIVE").length,
    pendingCount: definitions.filter((d) => d.status === "PENDING_DEFINITION").length,
  };
}
