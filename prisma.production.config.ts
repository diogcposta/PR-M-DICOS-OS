// Configuração Prisma do módulo "Produção clínica" (SQLite local, D-033).
// Usar com `--config prisma.production.config.ts`; ver scripts `producao:*` no package.json.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/production/schema.prisma",
  migrations: {
    path: "prisma/production/migrations",
  },
  datasource: {
    url: process.env.PRODUCTION_DATABASE_URL ?? "file:./data/producao.db",
  },
});
