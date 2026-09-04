import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Fluxo crítico: carregar um ficheiro, rever a amostra e o mapeamento, validar,
 * confirmar e ver o lote no histórico.
 *
 * Os testes correm em série e partilham a base: o primeiro importa, e os
 * seguintes dependem desse estado (é o que permite testar o duplicado a sério).
 */
const FIXTURES = path.join(process.cwd(), "tests/fixtures");

test.describe.configure({ mode: "serial" });

test("importa um ficheiro válido do início ao fim", async ({ page }) => {
  await page.goto("/imports/new");

  await page.getByTestId("file-input").setInputFiles(path.join(FIXTURES, "agenda-valida.csv"));

  // Pré-visualização: cabeçalhos e amostra do ficheiro real.
  await expect(page.getByRole("columnheader", { name: "id_consulta" })).toBeVisible();
  await expect(page.getByText("SYN-0001").first()).toBeVisible();
  await expect(page.getByText("separador detetado")).toBeVisible();

  // O mapeamento foi sugerido a partir dos cabeçalhos.
  await expect(page.getByTestId("map-occurredAt")).toHaveValue("data_hora");
  await expect(page.getByTestId("map-clinicExternalId")).toHaveValue("id_clinica");

  await page.getByTestId("validate-button").click();

  await expect(page.getByTestId("rows-total")).toContainText("6");
  await expect(page.getByTestId("rows-valid")).toContainText("6");
  await expect(page.getByTestId("rows-invalid")).toContainText("0");

  await page.getByTestId("commit-button").click();

  const result = page.getByTestId("commit-result");
  await expect(result).toHaveAttribute("data-kind", "COMMITTED");
  await expect(page.getByTestId("summary-accepted")).toContainText("6");
  await expect(page.getByTestId("summary-rejected")).toContainText("0");
  await expect(page.getByTestId("summary-ignored")).toContainText("0");
  await expect(page.getByTestId("download-errors")).toBeVisible();

  // O lote aparece no histórico.
  await page.goto("/imports");
  await expect(page.getByRole("link", { name: "agenda-valida.csv" })).toBeVisible();
  await page.getByRole("link", { name: "agenda-valida.csv" }).click();
  await expect(page.getByTestId("rows-committed")).toContainText("6");
  await expect(page.getByText("SYNTHETIC_AGENDA_V1 v1")).toBeVisible();
});

test("avisa e não duplica quando o mesmo ficheiro é reimportado", async ({ page }) => {
  await page.goto("/imports/new");
  await page.getByTestId("file-input").setInputFiles(path.join(FIXTURES, "agenda-valida.csv"));

  // O aviso aparece logo na pré-visualização, antes de o gestor confirmar.
  await expect(page.getByTestId("duplicate-warning")).toBeVisible();

  await page.getByTestId("validate-button").click();
  await page.getByTestId("commit-button").click();

  const result = page.getByTestId("commit-result");
  await expect(result).toHaveAttribute("data-kind", "DUPLICATE");
  await expect(result).toContainText("Nenhum facto foi gravado");
});

test("mostra os erros por linha e exige escolha explícita para gravar parcialmente", async ({
  page,
}) => {
  await page.goto("/imports/new");
  await page.getByTestId("file-input").setInputFiles(path.join(FIXTURES, "agenda-com-erros.csv"));

  await page.getByTestId("validate-button").click();

  await expect(page.getByTestId("rows-invalid")).toContainText("7");
  await expect(page.getByText("Data inexistente no calendário", { exact: false })).toBeVisible();
  await expect(page.getByText("não está mapeado", { exact: false })).toBeVisible();

  // Com linhas inválidas, confirmar está bloqueado até o gestor decidir.
  await expect(page.getByTestId("commit-button")).toBeDisabled();

  await page.getByTestId("allow-partial").check();
  await expect(page.getByTestId("commit-button")).toBeEnabled();

  await page.getByTestId("commit-button").click();
  await expect(page.getByTestId("commit-result")).toHaveAttribute("data-kind", "COMMITTED");
  await expect(page.getByTestId("summary-accepted")).toContainText("1");
  await expect(page.getByTestId("summary-rejected")).toContainText("7");
});

test("descarrega o relatório de erros em CSV", async ({ page }) => {
  await page.goto("/imports/new");

  // Conteúdo próprio, com uma linha válida e uma inválida: a fixture partilhada
  // "agenda-com-erros.csv" já foi importada pelo teste anterior nesta mesma
  // suíte serial, e reenviá-la aqui seria visto como duplicado — o link de
  // download nem chegaria a aparecer. Precisa de pelo menos uma linha válida,
  // senão o botão de confirmar fica desativado independentemente do checkbox.
  const csvComUmErro = Buffer.from(
    "id_consulta;data_hora;id_clinica;id_medico;ref_paciente;estado;duracao_min\n" +
      "SYN-DL-01;20/06/2025 09:00;CLINIC-001;DOCTOR-001;PATIENT-901;Realizada;30\n" +
      "SYN-DL-02;31/02/2025 09:00;CLINIC-001;DOCTOR-001;PATIENT-902;Realizada;30\n",
    "utf8",
  );
  await page.getByTestId("file-input").setInputFiles({
    name: "agenda-para-descarregar-erros.csv",
    mimeType: "text/csv",
    buffer: csvComUmErro,
  });

  await page.getByTestId("validate-button").click();
  await expect(page.getByTestId("rows-valid")).toContainText("1");
  await expect(page.getByTestId("rows-invalid")).toContainText("1");
  await page.getByTestId("allow-partial").check();
  await page.getByTestId("commit-button").click();
  await expect(page.getByTestId("commit-result")).toHaveAttribute("data-kind", "COMMITTED");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("download-errors").click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^erros-.*\.csv$/);
  const content = await (await download.createReadStream())?.toArray();
  const csv = Buffer.concat(content ?? []).toString("utf8");
  expect(csv).toContain("linha;coluna;gravidade;codigo;mensagem");
  expect(csv).toContain("DATE_OUT_OF_RANGE");
});

test("recusa um tipo de ficheiro não suportado", async ({ page }) => {
  await page.goto("/imports/new");

  await page.getByTestId("file-input").setInputFiles({
    name: "relatorio.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 conteúdo sintético"),
  });

  await expect(page.getByTestId("error")).toContainText("Apenas são aceites ficheiros");
});
