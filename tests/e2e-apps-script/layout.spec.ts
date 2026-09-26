import { expect, test } from "@playwright/test";

const ROUTES = ["", "registar", "agenda", "planos", "mais", "procedimentos", "dias", "faltas", "rentabilidade", "seguros", "simulador", "tendencias", "relatorio", "definicoes", "dados"];

test("todas as páginas: sem scroll horizontal nem erros, com a demonstração", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => void d.accept());
  await page.goto(`/?db=layout-${Date.now()}&hoje=2026-09-26#/dados`);
  await page.getByRole("button", { name: "Carregar demonstração" }).click();
  await expect(page.locator("#toast")).toContainText("Dados de demonstração carregados");
  for (const route of ROUTES) {
    await page.evaluate((r) => (location.hash = `#/${r}`), route);
    await expect(page.locator("main h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `scroll horizontal em #/${route}`).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});
