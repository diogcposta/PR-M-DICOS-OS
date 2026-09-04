import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SYNTHETIC_APPOINTMENT_MAPPING } from "@/modules/imports/domain/appointment-profile";
import {
  SYNTHETIC_CLINICS,
  SYNTHETIC_DOCTORS,
  SYNTHETIC_HEADERS,
  buildSyntheticDataset,
  toCsv,
} from "@/modules/imports/domain/synthetic-dataset";
import { validateAppointmentRows } from "@/modules/imports/domain/validate-appointments";
import { parseImportFile } from "@/modules/imports/infrastructure/file-parser";

const FIXTURES = path.join(process.cwd(), "tests/fixtures");

describe("determinismo do gerador", () => {
  it("produz exatamente o mesmo conjunto com a mesma semente", () => {
    const first = toCsv(buildSyntheticDataset());
    const second = toCsv(buildSyntheticDataset());
    expect(createHash("sha256").update(first).digest("hex")).toBe(
      createHash("sha256").update(second).digest("hex"),
    );
  });

  it("sementes diferentes produzem conjuntos diferentes", () => {
    const a = toCsv(buildSyntheticDataset({ seed: 1 }));
    const b = toCsv(buildSyntheticDataset({ seed: 2 }));
    expect(a).not.toBe(b);
  });
});

describe("cobertura do conjunto sintético", () => {
  const dataset = buildSyntheticDataset();
  const rows = dataset.rows;

  it("usa duas clínicas e vários médicos", () => {
    const clinics = new Set(rows.map((row) => row.id_clinica));
    const doctors = new Set(rows.map((row) => row.id_medico));
    for (const clinic of SYNTHETIC_CLINICS) {
      expect(clinics.has(clinic)).toBe(true);
    }
    // Todos os médicos aparecem, e há mais de dois.
    for (const doctor of SYNTHETIC_DOCTORS) {
      expect(doctors.has(doctor)).toBe(true);
    }
    expect(SYNTHETIC_DOCTORS.length).toBeGreaterThan(2);
  });

  it("cobre pelo menos seis meses", () => {
    const months = new Set(
      rows
        .map((row) => row.data_hora)
        .filter((value) => /^\d{2}\/\d{2}\/\d{4}/.test(value))
        .map((value) => `${value.slice(6, 10)}-${value.slice(3, 5)}`),
    );
    expect(months.size).toBeGreaterThanOrEqual(6);
  });

  it("deixa pelo menos um mês sem consultas", () => {
    expect(dataset.emptyMonths.length).toBeGreaterThan(0);
    const months = new Set(
      rows.map((row) => `${row.data_hora.slice(6, 10)}-${row.data_hora.slice(3, 5)}`),
    );
    for (const empty of dataset.emptyMonths) {
      expect(months.has(empty)).toBe(false);
    }
  });

  it("inclui consultas realizadas, canceladas, faltas e futuras", () => {
    const labels = new Set(rows.map((row) => row.estado));
    expect(labels).toContain("Realizada");
    expect(labels).toContain("Cancelada");
    expect(labels).toContain("Faltou");
    expect(labels).toContain("Agendada");
  });

  it("inclui datas nos limites dos meses", () => {
    // Primeiro instante do dia 1 e o último meio-dia do mês.
    expect(rows.some((row) => /^01\/\d{2}\/\d{4} 00:00$/.test(row.data_hora))).toBe(true);
    expect(rows.some((row) => /^(28|29|30|31)\/\d{2}\/\d{4} 23:30$/.test(row.data_hora))).toBe(true);
  });

  it("inclui linhas inválidas e IDs duplicados", () => {
    expect(dataset.invalidRowCount).toBeGreaterThan(0);
    expect(dataset.duplicateRowCount).toBeGreaterThan(0);

    const ids = rows.map((row) => row.id_consulta);
    expect(new Set(ids).size).toBeLessThan(ids.length);
  });

  it("não contém nomes, contactos nem dados pessoais realistas", () => {
    const everything = JSON.stringify(rows);
    // Referências de paciente são sempre identificadores sequenciais.
    for (const row of rows) {
      expect(row.ref_paciente).toMatch(/^PATIENT-\d{3}$/);
      expect(row.id_clinica).toMatch(/^(CLINIC-\d{3})?$/);
      expect(row.id_medico).toMatch(/^DOCTOR-\d{3}$/);
    }
    // Sem emails, telefones portugueses ou NIF.
    expect(everything).not.toMatch(/[\w.]+@[\w.]+\.\w+/);
    expect(everything).not.toMatch(/\b9[1236]\d{7}\b/);
    expect(everything).not.toMatch(/\bNIF\b/i);
  });
});

describe("o conjunto passa pelo validador real", () => {
  const dataset = buildSyntheticDataset();

  it("valida a maioria das linhas e assinala exatamente as problemáticas", () => {
    const report = validateAppointmentRows(dataset.rows, SYNTHETIC_APPOINTMENT_MAPPING);

    expect(report.rowsTotal).toBe(dataset.rows.length);
    expect(report.rowsValid).toBeGreaterThan(100);

    // As 9 linhas inválidas do gerador que o domínio consegue apanhar sozinho.
    // CLINIC-404 e DOCTOR-404 só são detetados contra a base de dados, por isso
    // aqui contam como válidas — é o teste de integração que os apanha.
    expect(report.rowsInvalid).toBe(dataset.invalidRowCount - 2);
    expect(report.duplicateRowsInFile).toBe(dataset.duplicateRowCount);
  });
});

describe("fixtures geradas em disco", () => {
  it("o CSV tem os cabeçalhos do perfil sintético", async () => {
    const content = await readFile(path.join(FIXTURES, "demo-agenda.csv"));
    const parsed = await parseImportFile("csv", content);
    expect(parsed.sheets[0]?.headers).toEqual([...SYNTHETIC_HEADERS]);
    expect(parsed.detectedDelimiter).toBe(";");
  });

  it("o XLSX continua legível depois de normalizarmos os carimbos do ZIP", async () => {
    const content = await readFile(path.join(FIXTURES, "demo-agenda.xlsx"));
    const parsed = await parseImportFile("xlsx", content);

    expect(parsed.sheets.map((sheet) => sheet.name)).toEqual(["Agenda", "Notas"]);
    expect(parsed.sheets[0]?.headers).toEqual([...SYNTHETIC_HEADERS]);
    expect(parsed.sheets[0]?.rows.length).toBeGreaterThan(100);
    expect(parsed.sheets[0]?.rows[0]?.["id_clinica"]).toMatch(/^CLINIC-\d{3}$/);
  });

  it("o CSV em disco corresponde ao que o gerador produz agora", async () => {
    // Se falhar, alguém alterou o gerador sem voltar a correr o script.
    const onDisk = await readFile(path.join(FIXTURES, "demo-agenda.csv"), "utf8");
    expect(onDisk).toBe(toCsv(buildSyntheticDataset()));
  });
});
