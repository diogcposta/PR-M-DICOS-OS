import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("dashboard mostra os números de referência de setembro de 2026", async ({ page }) => {
  await page.goto("/producao?mes=2026-09");
  await expect(page.getByTestId("card-production-value")).toHaveText("€8.619");
  await expect(page.getByTestId("card-fees-value")).toHaveText("€4.309,50");
  await expect(page.getByTestId("card-hours-value")).toHaveText("130,5 h");
  await expect(page.getByTestId("card-cph-value")).toHaveText("66 €/h");
  await expect(page.getByTestId("goal-gap")).toContainText("+19 €/h");
  await expect(page.getByTestId("insights")).toContainText("faltas");
  await expect(page.getByTestId("score")).toContainText("Não mede qualidade clínica");
});

test("registo rápido: sugestão pelo histórico, gravação e cálculo", async ({ page }) => {
  await page.goto("/producao/procedimentos/novo?data=2026-10-05");
  const type = page.getByLabel("Procedimento", { exact: true });
  await type.fill("Restauração a compósito");
  await expect(page.getByText(/Sugestão com base em \d+ registos/)).toBeVisible();
  await expect(page.getByLabel("Categoria")).toHaveValue("Dentisteria");
  await page.getByLabel("Hora de início").fill("09:30");
  await page.getByLabel("Hora de fim").fill("10:15");
  await page.getByLabel("Valor faturado (€)").fill("70");
  await page.getByLabel("Valor faturado (€)").press("Control+Enter");
  await expect(page.getByRole("status").filter({ hasText: "Procedimento registado" })).toBeVisible();
  // Próximo registo começa onde o anterior acabou.
  await expect(page.getByLabel("Hora de início")).toHaveValue("10:15");

  // Consulta sobreposta é recusada com mensagem clara.
  await page.getByLabel("Procedimento", { exact: true }).fill("Urgência");
  await page.getByLabel("Categoria").selectOption("Urgência");
  await page.getByLabel("Hora de início").fill("10:00");
  await page.getByLabel("Hora de fim").fill("10:30");
  await page.getByLabel("Valor faturado (€)").fill("45");
  await page.getByRole("button", { name: "Gravar e novo" }).click();
  await expect(page.getByText(/Sobrepõe-se a outra consulta/).first()).toBeVisible();

  await page.goto("/producao/agenda?data=2026-10-05&slot=45");
  await expect(page.getByRole("link", { name: "Restauração a compósito" })).toBeVisible();
});

test("tratamento em várias consultas: uma receita, tempo somado", async ({ page }) => {
  await page.goto("/producao/procedimentos/novo?data=2026-10-06");
  await page.getByRole("button", { name: "★ Coroa cerâmica" }).click();
  await page.getByLabel("Hora de início").fill("09:30");
  await page.getByLabel("Hora de fim").fill("11:00");
  await page.getByRole("button", { name: "Gerar novo Case ID" }).click();
  await page.getByRole("button", { name: "Gravar e novo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Procedimento registado" })).toBeVisible();

  await page.goto("/producao/procedimentos?mes=2026-10");
  await page.getByRole("link", { name: "Coroa cerâmica" }).first().click();
  await page.getByLabel("Data").first().fill("2026-10-13");
  await page.getByLabel("Início").fill("09:30");
  await page.getByLabel("Fim").fill("10:15");
  await page.getByRole("button", { name: "Adicionar consulta" }).click();
  await expect(page.getByText("Consulta 2")).toBeVisible();
  await page.getByLabel("Data").first().fill("2026-10-20");
  await page.getByLabel("Início").fill("09:30");
  await page.getByLabel("Fim").fill("10:15");
  await page.getByRole("button", { name: "Adicionar consulta" }).click();
  await expect(page.getByText("Consulta 3")).toBeVisible();
  await expect(page.getByText("200 €/h").first()).toBeVisible(); // €600 / 3 h
});

test("simulador: 146 h × 100 €/h = €14.600", async ({ page }) => {
  await page.goto("/producao/simulador");
  await page.getByRole("spinbutton", { name: "Horas clínicas / mês" }).fill("146");
  await page.getByRole("spinbutton", { name: "Produção por hora" }).fill("100");
  await expect(page.getByTestId("sim-monthly")).toContainText("€14.600");
  await expect(page.getByTestId("sim-fee")).toContainText("€7.300");
});

test("follow-up e funil nos planos", async ({ page }) => {
  await page.goto("/producao/planos");
  await expect(page.getByTestId("follow-up-list")).toBeVisible();
  await expect(page.getByLabel("Funil de tratamento")).toContainText("Plano aceite");
});

test("persistência: dados gravados sobrevivem a um novo carregamento", async ({ page }) => {
  await page.goto("/producao/procedimentos?mes=2026-10");
  await expect(page.getByRole("link", { name: "Restauração a compósito" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Restauração a compósito" })).toBeVisible();
});
