import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/observability/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("regista apenas campos da allowlist", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("lote processado", {
      importBatchId: "batch-1",
      rowsValid: 10,
      // Campo fora da allowlist: tem de ser descartado.
      patientName: "Nome Real",
    } as never);

    const line = spy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;

    expect(parsed.importBatchId).toBe("batch-1");
    expect(parsed.rowsValid).toBe(10);
    expect(parsed).not.toHaveProperty("patientName");
    expect(line).not.toContain("Nome Real");
  });
});
