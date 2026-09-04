/**
 * Escreve as fixtures de demonstração a partir do gerador determinístico.
 *
 *   npx tsx scripts/generate-synthetic-data.ts
 *
 * Correr duas vezes produz ficheiros byte a byte iguais — o SHA-256 não muda,
 * e a demonstração do bloqueio de reimportação continua a funcionar.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  SYNTHETIC_HEADERS,
  buildSyntheticDataset,
  toCsv,
} from "../src/modules/imports/domain/synthetic-dataset.js";
import { normalizeZipTimestamps } from "./normalize-zip-timestamps.js";

const OUTPUT_DIR = path.join(process.cwd(), "tests/fixtures");

async function writeXlsx(
  rows: readonly Record<string, string>[],
  target: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  // Metadados fixos: sem isto o ficheiro mudava a cada execução e o hash com ele.
  workbook.created = new Date(0);
  workbook.modified = new Date(0);

  const sheet = workbook.addWorksheet("Agenda");
  sheet.addRow([...SYNTHETIC_HEADERS]);
  for (const row of rows) {
    sheet.addRow(SYNTHETIC_HEADERS.map((header) => row[header] ?? ""));
  }

  const notes = workbook.addWorksheet("Notas");
  notes.addRow(["observacao"]);
  notes.addRow(["Dados sintéticos. Não correspondem a nenhuma exportação real."]);

  await workbook.xlsx.writeFile(target);
  // O conteúdo do ExcelJS é determinístico, mas o contentor ZIP grava a hora de
  // escrita. Sem isto, cada geração produzia um hash diferente.
  await normalizeZipTimestamps(target);
}

async function main(): Promise<void> {
  const dataset = buildSyntheticDataset();

  const csvPath = path.join(OUTPUT_DIR, "demo-agenda.csv");
  await writeFile(csvPath, toCsv(dataset), "utf8");

  // O XLSX leva só as linhas válidas: serve para demonstrar o caminho feliz em
  // Excel, sem repetir os erros que o CSV já cobre.
  const validRows = dataset.rows.slice(0, dataset.validRowCount);
  await writeXlsx(validRows, path.join(OUTPUT_DIR, "demo-agenda.xlsx"));

  console.log("Conjunto sintético gerado:", {
    linhasTotais: dataset.rows.length,
    linhasValidas: dataset.validRowCount,
    linhasInvalidas: dataset.invalidRowCount,
    idsDuplicados: dataset.duplicateRowCount,
    mesesSemDados: dataset.emptyMonths,
    csv: path.relative(process.cwd(), csvPath),
    xlsx: "tests/fixtures/demo-agenda.xlsx",
  });
}

void main();
