/**
 * E2E da versão Google Apps Script, sobre a pré-visualização local (mesmo
 * Index.html e mesmo código de servidor, com uma folha simulada no browser).
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 3400;

export default defineConfig({
  testDir: "tests/e2e-apps-script",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "iphone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }, testMatch: /layout/ },
  ],
  webServer: {
    command: `node apps-script/build.mjs --preview && node apps-script/serve-preview.mjs`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT) },
  },
});
