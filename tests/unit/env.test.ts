import { describe, expect, it } from "vitest";

import { EnvValidationError, parseServerEnv } from "@/lib/env/server";

const VALID_URL = "postgresql://user:pass@localhost:5432/db";

describe("validação de ambiente", () => {
  it("aplica os valores por omissão", () => {
    const env = parseServerEnv({ DATABASE_URL: VALID_URL });
    expect(env.APP_TIMEZONE).toBe("Europe/Lisbon");
    expect(env.AI_PROVIDER).toBe("disabled");
    expect(env.NODE_ENV).toBe("development");
  });

  it("falha com mensagem legível quando falta a base de dados", () => {
    expect(() => parseServerEnv({})).toThrow(EnvValidationError);
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
  });

  it("recusa uma ligação que não seja PostgreSQL", () => {
    expect(() => parseServerEnv({ DATABASE_URL: "mysql://user@localhost/db" })).toThrow(
      /PostgreSQL/,
    );
  });

  it("recusa um fornecedor de IA não suportado no MVP", () => {
    expect(() => parseServerEnv({ DATABASE_URL: VALID_URL, AI_PROVIDER: "openai" })).toThrow(
      EnvValidationError,
    );
  });
});
