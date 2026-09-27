import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { createProductionClient, type ProductionDb } from "@/lib/db/production";

/** Base SQLite temporária com as migrações aplicadas (sem tocar na base local). */
export function createTestDb(): { db: ProductionDb; file: string; cleanup: () => Promise<void> } {
  const dir = mkdtempSync(path.join(tmpdir(), "producao-test-"));
  const file = path.join(dir, "test.db");
  const sqlite = new Database(file);
  const migrationsDir = path.resolve("prisma/production/migrations");
  for (const name of readdirSync(migrationsDir).filter((n) => /^\d/.test(n)).sort()) {
    sqlite.exec(readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"));
  }
  sqlite.close();
  const db = createProductionClient(`file:${file}`);
  return {
    db,
    file,
    cleanup: async () => {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
