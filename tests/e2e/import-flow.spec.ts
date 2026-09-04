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
  await expect(result).toContainText("6 consultas gravadas");

  // O lote aparece no histórico.
  await page.goto("/imports");
  await expect(page.getByRole("link", { name: "agenda-valida.csv" })).toBeVisible();
  await page.getByRole("link", { name: "agenda-valida.csv" }).click();
  await expect(page.getByTestId("rows-committed")).toContainText("6");
  await expect(page.getByText("agenda-sintetica v1")).toBeVisible();
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
  await expect(page.getByTestId("commit-result")).toContainText("1 consultas gravadas");
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
