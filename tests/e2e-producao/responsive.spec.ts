import { expect, test } from "@playwright/test";

const PAGES = ["/producao", "/producao/procedimentos/novo", "/producao/rentabilidade", "/producao/planos", "/producao/agenda", "/producao/simulador", "/producao/tendencias", "/producao/relatorio"];

for (const path of PAGES) {
  test(`sem scroll horizontal nem erros em ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test("tema escuro persiste depois de recarregar", async ({ page }) => {
  await page.goto("/producao");
  const toggle = page.getByRole("button", { name: /Tema/ });
  await toggle.click(); // Auto → Claro
  await toggle.click(); // Claro → Escuro
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
