import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Fluxo crítico do dashboard: importar, filtrar por período e clínica, e ver os
 * KPIs mudarem em conformidade.
 *
 * As datas usadas são as das fixtures sintéticas (janeiro e março de 2025).
 */
const FIXTURES = path.join(process.cwd(), "tests/fixtures");

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  // Importa a agenda válida uma vez, para haver dados para filtrar.
  const mapping = {
    columns: {
      sourceRecordId: "id_consulta",
      occurredAt: "data_hora",
      clinicExternalId: "id_clinica",
      practitionerExternalId: "id_medico",
      patientExternalRef: "ref_paciente",
      status: "estado",
      durationMinutes: "duracao_min",
    },
    statusLabels: {
      agendada: "SCHEDULED",
      realizada: "COMPLETED",
      faltou: "NO_SHOW",
      cancelada: "CANCELLED",
      remarcada: "RESCHEDULED",
    },
  };

  const response = await request.post("/api/imports/commit", {
    multipart: {
      file: {
        name: "agenda-dashboard.csv",
        mimeType: "text/csv",
        buffer: readFileSync(path.join(FIXTURES, "agenda-dashboard.csv")),
      },
      mapping: JSON.stringify(mapping),
      rowPolicy: "ALL_OR_NOTHING",
    },
  });

  expect(response.status()).toBe(201);
  expect((await response.json()).rowsCommitted).toBe(6);
});

test("filtra o dashboard por período e vê os KPIs recalculados", async ({ page }) => {
  // Janeiro de 2025: 5 consultas — 2 realizadas, 1 falta, 1 cancelada, 1 por realizar.
  await page.goto("/?de=2025-01-01&ate=2025-01-31");

  await expect(page.getByTestId("period-summary")).toContainText("01/01/2025 a 31/01/2025");
  // O período anterior de igual duração é dezembro.
  await expect(page.getByTestId("period-summary")).toContainText("01/12/2024 a 31/12/2024");

  await expect(page.getByTestId("kpi-appointments_scheduled-value")).toHaveText("5");
  await expect(page.getByTestId("kpi-appointments_completed-value")).toHaveText("2");
  await expect(page.getByTestId("kpi-no_show_count-value")).toHaveText("1");

  // Denominador = 2 realizadas + 1 falta + 1 cancelada = 4, logo 50%.
  await expect(page.getByTestId("kpi-completion_rate-value")).toHaveText("50,0 %");
  await expect(page.getByTestId("kpi-no_show_rate-value")).toHaveText("25,0 %");
  await expect(page.getByTestId("kpi-cancellation_rate-value")).toHaveText("25,0 %");
});

test("mostra a fórmula, o numerador e o denominador de cada KPI", async ({ page }) => {
  await page.goto("/?de=2025-01-01&ate=2025-01-31");

  const card = page.getByTestId("kpi-completion_rate");
  await card.getByText("Como é calculado?").click();

  await expect(card).toContainText("realizadas / (realizadas + faltas + canceladas)");
  await expect(card).toContainText("AppointmentFact");
  await expect(card).toContainText("v1");
  // A definição ainda não foi validada com o negócio, e o ecrã diz isso.
  await expect(card).toContainText("Definição provisória");
});

test("filtrar por clínica muda numerador e denominador", async ({ page }) => {
  await page.goto("/?de=2025-01-01&ate=2025-01-31");

  await page.getByTestId("filter-clinic").selectOption({ label: "Unidade A (teste)" });
  await page.getByTestId("apply-filters").click();

  await page.waitForURL(/clinica=/);

  // Só 3 das 5 consultas de janeiro são da clínica A: 2 realizadas e 1 falta.
  await expect(page.getByTestId("kpi-appointments_scheduled-value")).toHaveText("3");
  // O denominador acompanha o filtro: 3 desfechos, 2 realizadas.
  await expect(page.getByTestId("kpi-completion_rate-value")).toHaveText("66,7 %");
});

test("um período sem consultas não inventa zeros", async ({ page }) => {
  await page.goto("/?de=2024-01-01&ate=2024-01-31");

  await expect(page.getByText("Sem consultas no período selecionado")).toBeVisible();
  await expect(page.getByTestId("kpi-completion_rate")).toHaveCount(0);
});

test("um período só com consultas por realizar mostra 'sem dados', não 0%", async ({ page }) => {
  // 10/01 tem uma única consulta, ainda por realizar: não há desfechos, logo o
  // denominador é 0 e não existe taxa a apresentar.
  await page.goto("/?de=2025-01-10&ate=2025-01-10");

  await expect(page.getByTestId("kpi-appointments_scheduled-value")).toHaveText("1");
  await expect(page.getByTestId("kpi-completion_rate-value")).toHaveText("sem dados");
  await expect(page.getByTestId("kpi-completion_rate-value")).not.toHaveText("0,0 %");
});

test("compara com o período anterior de igual duração", async ({ page }) => {
  await page.goto("/?de=2025-01-01&ate=2025-01-31");

  // Dezembro de 2024 tem 1 realizada; janeiro tem 2. Logo +100%.
  await expect(page.getByTestId("kpi-appointments_completed-change")).toHaveText("+100,0 %");
});
