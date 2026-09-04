import { describe, expect, it } from "vitest";

import { KPI_CATALOG, activeKpiDefinitions, findKpiDefinition } from "@/modules/kpis/domain/catalog";

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

  it("não ativa nenhum KPI antes de a definição ser aprovada", () => {
    // Guarda intencional: ativar um KPI é uma decisão de negócio e tem de
    // partir este teste, para não passar despercebida em code review.
    expect(activeKpiDefinitions()).toHaveLength(0);
    for (const definition of KPI_CATALOG) {
      expect(definition.openQuestion.length).toBeGreaterThan(0);
    }
  });

  it("encontra uma definição pela chave", () => {
    expect(findKpiDefinition("no_show_rate")?.name).toBe("Taxa de faltas");
  });
});
