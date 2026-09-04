/**
 * Validação tipada das variáveis de ambiente do servidor.
 *
 * Falhar aqui, no arranque, com uma mensagem legível é preferível a falhar mais
 * tarde numa consulta à base de dados com um erro de driver.
 */
import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL é obrigatório.")
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL tem de ser uma ligação PostgreSQL (postgresql://…).",
    ),
  APP_TIMEZONE: z.string().min(1).default("Europe/Lisbon"),
  AI_PROVIDER: z.enum(["disabled"]).default("disabled"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  constructor(issues: readonly string[]) {
    super(
      [
        "Configuração de ambiente inválida:",
        ...issues.map((issue) => `  - ${issue}`),
        "Copie .env.example para .env e preencha os valores em falta.",
      ].join("\n"),
    );
    this.name = "EnvValidationError";
  }
}

/** Valida um conjunto de variáveis. Exportada para ser testável sem process.env. */
export function parseServerEnv(source: NodeJS.ProcessEnv | Record<string, unknown>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Ambiente validado do servidor. Nunca chamar a partir de código de cliente. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
