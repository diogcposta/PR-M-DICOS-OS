import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_KPI_KEYS,
  KPI_CATALOG,
  activeKpiDefinitions,
  findKpiDefinition,
} from "@/modules/kpis/domain/catalog";

describe("catálogo de KPIs", () => {
  it("não tem chaves duplicadas", () => {
    const keys = KPI_CATALOG.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("dá a cada KPI fórmula, unidade, fontes e versão", () => {
    for (const definition of KPI_CATALOG) {
      expect(definition.formula.length).toBeGreaterThan(0);
      expect(definition.sources.length).toBeGreaterThan(0);
      expect(definition.supportedFilters.length).toBeGreaterThan(0);
      expect(definition.definitionVersion).toBeGreaterThan(0);
    }
  });

  it("ativa exatamente os KPIs de agenda e mais nenhum", () => {
    // Guarda intencional: ativar um KPI é uma decisão de negócio e tem de partir
    // este teste, para não passar despercebida em code review.
    expect(activeKpiDefinitions().map((d) => d.key).sort()).toEqual([...APPOINTMENT_KPI_KEYS].sort());
  });

  it("mantém bloqueados os KPIs financeiros e de pacientes", () => {
    // Não há fixtures nem contratos validados para estes: calculá-los seria
    // inventar a definição.
    for (const key of [
      "new_patients",
      "active_patients",
      "reactivated_patients",
      "lost_patients",
      "production_amount",
      "invoiced_amount",
      "budget_amount",
      "outstanding_balance",
    ] as const) {
      expect(findKpiDefinition(key)?.status).toBe("PENDING_DEFINITION");
    }
  });

  it("nenhuma definição está aprovada pelo negócio, e todas dizem o que falta", () => {
    // As fórmulas estão fixadas e testadas, mas fomos nós que as decidimos.
    // Enquanto isto for verdade, o ecrã tem de marcar a definição como provisória.
    for (const definition of KPI_CATALOG) {
      expect(definition.definitionApproved).toBe(false);
      expect(definition.openQuestion.length).toBeGreaterThan(0);
    }
  });

  it("encontra uma definição pela chave", () => {
    expect(findKpiDefinition("no_show_rate")?.name).toBe("Taxa de faltas");
  });
});
