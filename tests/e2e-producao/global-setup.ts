import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

/** Base E2E limpa: migrações do Prisma + dados de demonstração. */
export default function globalSetup() {
  const file = process.env.PRODUCTION_E2E_DB ?? path.resolve(".playwright/producao-e2e.db");
  mkdirSync(path.dirname(file), { recursive: true });
  rmSync(file, { force: true });
  const env = { ...process.env, PRODUCTION_DATABASE_URL: `file:${file}` };
  execSync("npx prisma migrate deploy --config prisma.production.config.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/producao/setup-db.ts", { env, stdio: "inherit" });
}
