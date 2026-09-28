import { expect, test } from "@playwright/test";

const ROUTES = ["", "registar", "agenda", "planos", "mais", "procedimentos", "dias", "faltas", "exames", "fecho", "rentabilidade", "seguros", "simulador", "tendencias", "relatorio", "definicoes", "dados"];

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

test("Início no iPhone: mês e «+ Registar» na mesma linha, com a mesma altura", async ({ page, isMobile }) => {
  test.skip(!isMobile, "só no tamanho iPhone");
  await page.goto(`/?db=header-${Date.now()}&hoje=2026-09-26#/`);
  const month = await page.locator(".page-title input[type=month]").boundingBox();
  const button = await page.locator(".page-title a.btn.primary", { hasText: "Registar" }).boundingBox();
  const actions = await page.locator(".page-title .actions").boundingBox();
  expect(month && button && actions).toBeTruthy();
  expect(Math.abs(month!.y - button!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(month!.height - button!.height)).toBeLessThanOrEqual(1);
  expect(button!.x + button!.width).toBeCloseTo(actions!.x + actions!.width, 0); // ocupa a largura toda
});

test("tabelas: colunas numéricas normais (o círculo numerado é só das 3 ações)", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto(`/?db=num-${Date.now()}&hoje=2026-09-26#/dados`);
  await page.getByRole("button", { name: "Carregar demonstração" }).click();
  await expect(page.locator("#toast")).toContainText("Dados de demonstração carregados");
  await page.evaluate(() => (location.hash = "#/faltas"));
  const cell = page.locator(".t td.num").first();
  await expect(cell).toBeVisible();
  expect(await cell.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("0px");
  await page.evaluate(() => (location.hash = "#/"));
  const badge = page.locator(".actions-list .num").first();
  await expect(badge).toBeVisible();
  expect(await badge.evaluate((el) => getComputedStyle(el).borderRadius)).not.toBe("0px");
});
