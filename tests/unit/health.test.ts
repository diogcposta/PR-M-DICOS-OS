import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Teste de saúde da aplicação: invoca o route handler diretamente, sem servidor
 * e sem base de dados.
 */
describe("GET /api/health", () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    process.env.APP_TIMEZONE = "Europe/Lisbon";
    process.env.AI_PROVIDER = "disabled";
  });

  afterEach(() => {
    process.env = { ...previous };
  });

  it("responde ok com o fuso de negócio e o fornecedor de IA", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      timezone: "Europe/Lisbon",
      aiProvider: "disabled",
    });
  });
});
