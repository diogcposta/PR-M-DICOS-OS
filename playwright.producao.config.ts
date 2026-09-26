/**
 * E2E do Clinical Production Dashboard. Corre contra uma base SQLite própria
 * (.playwright/producao-e2e.db), preparada no globalSetup — nunca a base local.
 * Não precisa de PostgreSQL.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
// Fora de test-results/ (que o Playwright limpa ao arrancar).
const DB_FILE = path.resolve(".playwright/producao-e2e.db");
mkdirSync(path.dirname(DB_FILE), { recursive: true });
process.env.PRODUCTION_E2E_DB = DB_FILE;

export default defineConfig({
  testDir: "tests/e2e-producao",
  globalSetup: "./tests/e2e-producao/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Usa o Chromium do sistema quando existe (ambientes sem download de browsers).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "iphone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, testMatch: /responsive/ },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    // Sonda sem base de dados: o globalSetup só prepara a base depois de o servidor arrancar.
    url: `http://localhost:${PORT}/favicon.ico`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PRODUCTION_DATABASE_URL: `file:${DB_FILE}` },
  },
});
