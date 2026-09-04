import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL não está definido. Veja a secção de testes no README.md.");
}

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // O e2e corre contra a base de testes, nunca contra a de desenvolvimento.
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: testDatabaseUrl },
  },
});
