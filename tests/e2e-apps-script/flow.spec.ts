import { expect, test, type Page } from "@playwright/test";

/** Cada teste usa uma folha simulada própria e "hoje" fixo em 26/09/2026. */
async function open(page: Page, route = "") {
  const db = `e2e-${test.info().testId}-${Date.now()}`;
  page.on("dialog", (d) => void d.accept());
  await page.goto(`/?db=${db}&hoje=2026-09-26#/${route}`);
  await expect(page.locator(".loading")).toHaveCount(0);
}

async function loadDemo(page: Page) {
  await page.goto(page.url().replace(/#.*$/, "#/dados"));
  await page.getByRole("button", { name: "Carregar demonstração" }).click();
  await expect(page.locator("#toast")).toContainText("Dados de demonstração carregados");
}

test("primeira utilização: cria a folha e mostra o dashboard vazio", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Clinical Production Dashboard" })).toBeVisible();
  await expect(page.getByText(/Sem registos em/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Início/ })).toHaveAttribute("aria-current", "page");
});

test("demonstração: números de referência de setembro de 2026", async ({ page }) => {
  await open(page);
  await loadDemo(page);
  await page.getByRole("link", { name: /Início/ }).click();
  await expect(page.getByTestId("card-production-value")).toHaveText("€8.619");
  await expect(page.getByTestId("card-fees-value")).toHaveText("€4.309,50");
  await expect(page.getByTestId("card-hours-value")).toHaveText("130,5 h");
  await expect(page.getByTestId("card-cph-value")).toHaveText("66 €/h");
  await expect(page.getByTestId("goal-gap")).toContainText("+19 €/h");
  await expect(page.getByTestId("score")).toContainText("Não mede qualidade clínica");
  // os dados ficam na folha: recarregar mantém tudo
  await page.reload();
  await expect(page.getByTestId("card-production-value")).toHaveText("€8.619");
});

test("registo rápido no iPhone: sugestão, gravação, sobreposição recusada", async ({ page }) => {
  await open(page);
  await loadDemo(page);
  await page.goto(page.url().replace(/#.*$/, "#/registar?data=2026-10-05"));
  await page.getByLabel("Procedimento", { exact: true }).fill("Restauração a compósito");
  await expect(page.getByText(/Sugestão com base em \d+ registos/)).toBeVisible();
  await expect(page.getByLabel("Categoria")).toHaveValue("Dentisteria");
  await page.getByLabel("Hora de início").fill("09:30");
  await page.getByLabel("Hora de fim").fill("10:15");
  await page.getByRole("button", { name: "Gravar e novo" }).click();
  await expect(page.locator("#toast")).toContainText("Procedimento registado");
  await expect(page.getByLabel("Hora de início")).toHaveValue("10:15");

  await page.getByLabel("Procedimento", { exact: true }).fill("Urgência");
  await page.getByLabel("Categoria").selectOption("Urgência");
  await page.getByLabel("Hora de início").fill("10:00");
  await page.getByLabel("Hora de fim").fill("10:30");
  await page.getByLabel("Valor faturado (€)").fill("45");
  await page.getByRole("button", { name: "Gravar e novo" }).click();
  await expect(page.getByText(/Sobrepõe-se a outra consulta/).first()).toBeVisible();
});

test("tratamento em várias consultas e agenda do dia", async ({ page }) => {
  await open(page, "registar?data=2026-10-06");
  await page.getByRole("button", { name: "★ Coroa cerâmica" }).click();
  await page.getByLabel("Hora de início").fill("09:30");
  await page.getByLabel("Hora de fim").fill("11:00");
  await page.getByRole("button", { name: "Gerar novo Case ID" }).click();
  await expect(page.locator("#caseCode-in")).toHaveValue("DC-2026-001");
  await page.getByRole("button", { name: "Gravar e novo" }).click();
  await expect(page.locator("#toast")).toContainText("Procedimento registado");

  await page.goto(page.url().replace(/#.*$/, "#/procedimentos?mes=2026-10"));
  await page.getByRole("link", { name: /Coroa cerâmica/ }).click();
  for (const date of ["2026-10-13", "2026-10-20"]) {
    const form = page.getByRole("form", { name: "Adicionar consulta" });
    await form.getByLabel("Data").fill(date);
    await form.getByLabel("Início").fill("09:30");
    await form.getByLabel("Fim").fill("10:15");
    await form.getByRole("button", { name: "Adicionar consulta" }).click();
    await expect(page.locator("#toast")).toContainText("Consulta adicionada");
  }
  await expect(page.getByText("Consulta 3")).toBeVisible();
  await expect(page.getByTestId("proc-cph-value")).toHaveText("200 €/h");

  await page.getByRole("link", { name: /Agenda/ }).click();
  await page.goto(page.url().replace(/#.*$/, "#/agenda?data=2026-10-06&slot=45"));
  // 90 min em slots de 45: a mesma consulta aparece nos dois slots.
  await expect(page.getByRole("link", { name: "Coroa cerâmica" })).toHaveCount(2);
});

test("planos, follow-up e simulador", async ({ page }) => {
  await open(page);
  await loadDemo(page);
  await page.getByRole("link", { name: /Planos/ }).click();
  await expect(page.getByTestId("follow-up-list")).toBeVisible();
  await page.getByTestId("follow-up-list").getByRole("button", { name: "Contactado hoje" }).first().click();
  await expect(page.locator("#toast")).toContainText("Contacto registado");

  await page.goto(page.url().replace(/#.*$/, "#/simulador"));
  await page.locator("#sim-hours").fill("146");
  await page.locator("#sim-cph").fill("100");
  await expect(page.getByTestId("sim-monthly")).toContainText("€14.600");
  await expect(page.getByTestId("sim-fee")).toContainText("€7.300");
});

test("definições: erro compreensível e gravação", async ({ page }) => {
  await open(page, "definicoes");
  await page.getByLabel("Percentagem recebida (%)").fill("150");
  await page.getByRole("button", { name: "Gravar definições" }).click();
  await expect(page.getByText("A percentagem não pode ser superior a 100%.").first()).toBeVisible();
  await expect(page.getByLabel("Percentagem recebida (%)")).toHaveValue("150");
  await page.getByLabel("Percentagem recebida (%)").fill("45");
  await page.getByRole("button", { name: "Gravar definições" }).click();
  await expect(page.locator("#toast")).toContainText("Definições gravadas");
  await page.getByRole("link", { name: /Início/ }).click();
  await expect(page.getByText("Honorários (45%)")).toBeVisible();
});

test("exames no iPhone: valor habitual, honorários à parte da produção e total a receber", async ({ page }) => {
  await open(page);
  await loadDemo(page);
  // valor habitual do CBCT nas Definições
  await page.goto(page.url().replace(/#.*$/, "#/definicoes"));
  const typeForm = page.getByRole("form", { name: "Tipo de exame" });
  await typeForm.getByLabel("Exame").fill("CBCT");
  await typeForm.getByLabel("Valor habitual (€)").fill("80");
  await typeForm.getByRole("button", { name: "Gravar exame" }).click();
  await expect(page.locator("#toast")).toContainText("Tipo de exame gravado");

  await page.goto(page.url().replace(/#.*$/, "#/exames?mes=2026-09"));
  const form = page.getByRole("form", { name: "Registar exame" });
  await form.getByRole("button", { name: "CBCT" }).click();
  await expect(form.getByLabel("Valor do exame (€)")).toHaveValue("80");
  await form.getByLabel("Data").fill("2026-09-15");
  await form.getByRole("button", { name: "Registar exame" }).click();
  await expect(page.locator("#toast")).toContainText("Exame registado");
  await expect(page.getByTestId("exam-fees-value")).toHaveText("€40");

  // sem valor habitual: escreve-se o valor
  await page.getByRole("form", { name: "Registar exame" }).getByRole("button", { name: "Ortopantomografia" }).click();
  await page.getByRole("form", { name: "Registar exame" }).getByLabel("Valor do exame (€)").fill("30");
  await page.getByRole("form", { name: "Registar exame" }).getByLabel("Data").fill("2026-09-16");
  await page.getByRole("form", { name: "Registar exame" }).getByRole("button", { name: "Registar exame" }).click();
  await expect(page.getByTestId("exam-fees-value")).toHaveText("€55");

  await page.getByRole("link", { name: /Início/ }).click();
  await expect(page.getByTestId("card-production-value")).toHaveText("€8.619"); // produção não muda
  await expect(page.getByTestId("card-cph-value")).toHaveText("66 €/h");
  await expect(page.getByTestId("card-exams-value")).toHaveText("€55");
  await expect(page.getByTestId("card-total-fees-value")).toHaveText("€4.364,50");
});
