/**
 * Cliente Prisma partilhado.
 *
 * Singleton em desenvolvimento para o hot reload do Next.js não abrir uma nova
 * pool de ligações a cada recompilação.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { serverEnv } from "@/lib/env/server";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const env = serverEnv();
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    // Sem `query` em produção: os parâmetros podem conter identificadores.
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
