/**
 * Gera a fixture Excel a partir do CSV válido, para os dois ficheiros terem
 * exatamente o mesmo conteúdo. Correr com: npx tsx tests/fixtures/generate-xlsx.ts
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

import ExcelJS from "exceljs";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Agenda");
  sheet.addRow(["id_consulta", "data_hora", "id_clinica", "id_medico", "ref_paciente", "estado", "duracao_min"]);
  const rows: (string | number)[][] = [
    ["SYN-0001", "06/01/2025 09:00", "CLINIC-001", "DOCTOR-001", "PATIENT-001", "Realizada", 30],
    ["SYN-0002", "06/01/2025 09:30", "CLINIC-001", "DOCTOR-001", "PATIENT-002", "Faltou", 30],
    ["SYN-0003", "07/01/2025 14:15", "CLINIC-001", "DOCTOR-002", "PATIENT-003", "Agendada", 45],
    ["SYN-0004", "07/01/2025 15:00", "CLINIC-002", "DOCTOR-002", "PATIENT-004", "Cancelada", 30],
    ["SYN-0005", "08/01/2025 10:00", "CLINIC-002", "DOCTOR-001", "PATIENT-005", "Realizada", 60],
    ["SYN-0006", "30/03/2025 10:30", "CLINIC-001", "DOCTOR-001", "PATIENT-006", "Realizada", 30],
  ];
  for (const row of rows) {
    sheet.addRow(row);
  }

  // Segunda folha, para exercitar a escolha de folha no ecrã.
  const notes = workbook.addWorksheet("Notas");
  notes.addRow(["observacao"]);
  notes.addRow(["Folha sem dados de agenda, propositadamente."]);

  await workbook.xlsx.writeFile(path.join(here, "agenda-valida.xlsx"));
  console.log("agenda-valida.xlsx gerado");
}

void main();
