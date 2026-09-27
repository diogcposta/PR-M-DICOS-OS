/**
 * Último passo de `npm run producao:setup` (depois de `prisma migrate deploy`):
 * se a base local estiver vazia, carrega os dados de demonstração. Idempotente.
 * Com `--reset`, apaga os registos e recarrega a demonstração (definições mantêm-se).
 */
import "dotenv/config";


import { createProductionClient, DEFAULT_PRODUCTION_DATABASE_URL, resolveSqlitePath } from "../../src/lib/db/production";
import { seedDemoData } from "../../src/modules/production/demo/seed";

async function main() {
  const url = process.env.PRODUCTION_DATABASE_URL ?? DEFAULT_PRODUCTION_DATABASE_URL;
  const file = resolveSqlitePath(url);
  const db = createProductionClient(url);
  try {
    const empty = (await db.procedure.count()) === 0 && (await db.clinicalDay.count()) === 0;
    if (empty || process.argv.includes("--reset")) {
      const counts = await seedDemoData(db);
      console.log(`Dados de demonstração carregados (${counts.procedures} procedimentos, ${counts.days} dias).`);
    } else {
      console.log("A base já tem dados: nada foi alterado (use --reset para recarregar a demonstração).");
    }
    console.log(`Base: ${file}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Falha ao preparar a base:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
