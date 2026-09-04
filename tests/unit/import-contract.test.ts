import { describe, expect, it } from "vitest";

import {
  canTransition,
  canonicalRowSchema,
  isTerminalStatus,
} from "@/modules/imports/domain/contract";

describe("contrato de importação", () => {
  it("segue a sequência UPLOADED -> PARSED -> MAPPED -> VALIDATED -> COMMITTED", () => {
    expect(canTransition("UPLOADED", "PARSED")).toBe(true);
    expect(canTransition("PARSED", "MAPPED")).toBe(true);
    expect(canTransition("MAPPED", "VALIDATED")).toBe(true);
    expect(canTransition("VALIDATED", "COMMITTED")).toBe(true);
  });

  it("não deixa saltar fases nem voltar atrás", () => {
    expect(canTransition("UPLOADED", "COMMITTED")).toBe(false);
    expect(canTransition("MAPPED", "PARSED")).toBe(false);
  });

  it("trata os estados terminais como definitivos", () => {
    expect(isTerminalStatus("COMMITTED")).toBe(true);
    expect(isTerminalStatus("DUPLICATE")).toBe(true);
    expect(isTerminalStatus("REJECTED")).toBe(true);
    expect(isTerminalStatus("UPLOADED")).toBe(false);
    expect(canTransition("COMMITTED", "REJECTED")).toBe(false);
  });

  it("exige chave estável e clínica em cada linha canónica", () => {
    const valid = canonicalRowSchema.safeParse({
      sourceType: "APPOINTMENTS",
      stableRowKey: "chave-estavel-1",
      clinicExternalId: "DEMO-CL-001",
      occurredAt: new Date("2025-01-15T09:00:00.000Z"),
      sourceRowNumber: 2,
      importProfileKey: "agenda-sintetica",
      importProfileVersion: 1,
    });
    expect(valid.success).toBe(true);

    const missingKey = canonicalRowSchema.safeParse({
      sourceType: "APPOINTMENTS",
      clinicExternalId: "DEMO-CL-001",
      occurredAt: new Date(),
      sourceRowNumber: 2,
      importProfileKey: "agenda-sintetica",
      importProfileVersion: 1,
    });
    expect(missingKey.success).toBe(false);
  });
});
