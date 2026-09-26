/**
 * Cliente Prisma da base local do módulo "Produção clínica" (SQLite, D-033).
 *
 * Base separada da PostgreSQL do PR Médicos OS: funciona sem servidor nem
 * serviços pagos. Para migrar para PostgreSQL/Supabase basta trocar o `provider`
 * do esquema e este adaptador — o domínio não conhece a base (docs/PRODUCAO.md).
 */
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/production/client";

export const DEFAULT_PRODUCTION_DATABASE_URL = "file:./data/producao.db";

/** Caminho absoluto do ficheiro SQLite a partir de uma URL `file:`. */
export function resolveSqlitePath(url: string, cwd: string = process.cwd()): string {
  if (url === ":memory:") return url;
  const withoutScheme = url.replace(/^file:/, "");
  return path.isAbsolute(withoutScheme) ? withoutScheme : path.resolve(cwd, withoutScheme);
}

export function createProductionClient(url?: string): PrismaClient {
  const databaseUrl = url ?? process.env.PRODUCTION_DATABASE_URL ?? DEFAULT_PRODUCTION_DATABASE_URL;
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: resolveSqlitePath(databaseUrl) }),
    log: ["error"],
  });
}

const globalForProduction = globalThis as unknown as { productionDb?: PrismaClient };

export const productionDb: PrismaClient = globalForProduction.productionDb ?? createProductionClient();

if (process.env.NODE_ENV !== "production") {
  globalForProduction.productionDb = productionDb;
}

export type ProductionDb = PrismaClient;
