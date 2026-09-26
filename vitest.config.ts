// Carrega .env para que os testes de integração encontrem TEST_DATABASE_URL.
import "dotenv/config";

import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        // Domínio e infraestrutura sem I/O: rápidos e sem PostgreSQL.
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
        },
      },
      {
        // Módulo "Produção clínica": aplicação contra SQLite temporário (sem servidor).
        test: {
          name: "production",
          environment: "node",
          include: ["tests/production/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
      {
        // Correm contra TEST_DATABASE_URL, numa base separada da de desenvolvimento.
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // A base é partilhada: os ficheiros não podem correr em paralelo.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
