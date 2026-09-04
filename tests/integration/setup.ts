/**
 * Preparação da base de testes.
 *
 * Corre as migrações contra TEST_DATABASE_URL e limpa as tabelas antes de cada
 * ficheiro. A base de testes é distinta da de desenvolvimento — os testes nunca
 * tocam nos dados com que se está a trabalhar.
 */
import { execFileSync } from "node:child_process";

import { beforeAll } from "vitest";

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL não está definido. Veja a secção de testes no README.md.",
  );
}

// O cliente Prisma e as migrações têm de apontar para a base de testes.
process.env.DATABASE_URL = testUrl;

beforeAll(() => {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
});
