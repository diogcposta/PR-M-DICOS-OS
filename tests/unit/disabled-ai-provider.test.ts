import { describe, expect, it, vi } from "vitest";

import { createAIAnalysisProvider } from "@/modules/ai";
import { analysisResultSchema } from "@/modules/ai/domain/AIAnalysisProvider";

const INPUT = {
  period: { fromDate: "2025-01-01", toDate: "2025-01-31", timeZone: "Europe/Lisbon" },
  previousPeriod: { fromDate: "2024-12-01", toDate: "2024-12-31" },
  filters: { clinicIds: [], practitionerIds: [] },
  metrics: [],
};

describe("fornecedor de IA desativado", () => {
  it("é o fornecedor escolhido por configuração no MVP", () => {
    const provider = createAIAnalysisProvider("disabled");
    expect(provider.id).toBe("disabled");
    expect(provider.isEnabled).toBe(false);
  });

  it("devolve um resultado estruturado válido em vez de falhar", async () => {
    const result = await createAIAnalysisProvider("disabled").analyze(INPUT);
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
    expect(result.status).toBe("DISABLED");
    expect(result.observations).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("não faz qualquer chamada de rede", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await createAIAnalysisProvider("disabled").analyze(INPUT);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
