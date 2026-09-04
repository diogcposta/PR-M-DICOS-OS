/**
 * Prepara a base de testes antes do fluxo e2e: aplica migrações e deixa apenas
 * a organização sintética, sem lotes nem factos.
 */
import { execFileSync } from "node:child_process";

export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL não está definido.");
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  process.env.DATABASE_URL = databaseUrl;
  const { resetDatabase } = await import("../integration/helpers");
  await resetDatabase();
}
