import { describe, expect, it } from "vitest";

import {
  SYNTHETIC_APPOINTMENT_MAPPING,
  suggestAppointmentMapping,
} from "@/modules/imports/domain/appointment-profile";
import {
  buildStableRowKey,
  findUnmappedRequiredFields,
  validateAppointmentRows,
  type RawRow,
} from "@/modules/imports/domain/validate-appointments";

const MAPPING = SYNTHETIC_APPOINTMENT_MAPPING;

function row(overrides: Partial<Record<string, unknown>> = {}): RawRow {
  return {
    id_consulta: "SYN-0001",
    data_hora: "06/01/2025 09:00",
    id_clinica: "CLINIC-001",
    id_medico: "DOCTOR-001",
    ref_paciente: "PATIENT-001",
    estado: "Realizada",
    duracao_min: "30",
    ...overrides,
  };
}

describe("mapeamento sugerido", () => {
  it("reconhece os cabeçalhos sintéticos", () => {
    const mapping = suggestAppointmentMapping([
      "id_consulta",
      "data_hora",
      "id_clinica",
      "id_medico",
      "ref_paciente",
      "estado",
      "duracao_min",
    ]);
    expect(mapping.columns.occurredAt).toBe("data_hora");
    expect(mapping.columns.clinicExternalId).toBe("id_clinica");
  });

  it("deixa por mapear o que não reconhece, em vez de adivinhar", () => {
    const mapping = suggestAppointmentMapping(["coluna_a", "coluna_b"]);
    expect(mapping.columns.occurredAt).toBeNull();
    expect(findUnmappedRequiredFields(mapping)).toContain("occurredAt");
  });
});

describe("validação de linhas de agenda", () => {
  it("aceita linhas completas e normaliza os valores", () => {
    const report = validateAppointmentRows([row()], MAPPING);
    expect(report.rowsValid).toBe(1);
    expect(report.rowsInvalid).toBe(0);

    const validated = report.validRows[0];
    expect(validated?.status).toBe("COMPLETED");
    expect(validated?.sourceStatusLabel).toBe("Realizada");
    expect(validated?.durationMinutes).toBe(30);
    // Linha 2 do ficheiro: a 1 é o cabeçalho.
    expect(validated?.sourceRowNumber).toBe(2);
  });

  it("mapeia estados com acentos e maiúsculas diferentes", () => {
    const report = validateAppointmentRows(
      [row({ estado: "FALTOU" }), row({ id_consulta: "X", estado: " Cancelada " })],
      MAPPING,
    );
    expect(report.validRows.map((r) => r.status)).toEqual(["NO_SHOW", "CANCELLED"]);
  });

  it("recusa um estado por mapear em vez de o converter em UNKNOWN", () => {
    const report = validateAppointmentRows([row({ estado: "Em análise" })], MAPPING);
    expect(report.rowsValid).toBe(0);
    expect(report.issues[0]?.code).toBe("STATUS_UNMAPPED");
    expect(report.issues[0]?.severity).toBe("ERROR");
  });

  it("assinala campos obrigatórios em falta com a coluna respetiva", () => {
    const report = validateAppointmentRows(
      [row({ data_hora: "" }), row({ id_clinica: "" })],
      MAPPING,
    );
    expect(report.rowsInvalid).toBe(2);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "DATE_MISSING",
      "CLINIC_ID_MISSING",
    ]);
    expect(report.issues[0]?.columnName).toBe("data_hora");
  });

  it("acumula vários erros da mesma linha", () => {
    const report = validateAppointmentRows([row({ data_hora: "31/02/2025", estado: "" })], MAPPING);
    expect(report.rowsInvalid).toBe(1);
    expect(report.issues).toHaveLength(2);
    expect(report.issues.every((issue) => issue.sourceRowNumber === 2)).toBe(true);
  });

  it("conta uma linha inválida uma só vez, mesmo com vários erros", () => {
    const report = validateAppointmentRows(
      [row({ data_hora: "xx", estado: "yy", duracao_min: "zz" })],
      MAPPING,
    );
    expect(report.rowsInvalid).toBe(1);
    expect(report.rowsTotal).toBe(1);
  });

  it("deteta linhas repetidas dentro do próprio ficheiro", () => {
    const report = validateAppointmentRows([row(), row(), row({ id_consulta: "SYN-0002" })], MAPPING);
    expect(report.rowsValid).toBe(2);
    expect(report.duplicateRowsInFile).toBe(1);
    const duplicate = report.issues.find((issue) => issue.code === "ROW_DUPLICATE_IN_FILE");
    // É um aviso, não um erro: a linha não se perde, apenas não se repete.
    expect(duplicate?.severity).toBe("WARNING");
    expect(report.rowsInvalid).toBe(0);
  });
});

describe("chave estável", () => {
  it("usa o identificador da origem quando existe", () => {
    const key = buildStableRowKey({
      sourceRecordId: "SYN-0001",
      clinicExternalId: "CLINIC-001",
      occurredAt: new Date("2025-01-06T09:00:00.000Z"),
      patientExternalRef: "PATIENT-001",
      practitionerExternalId: "DOCTOR-001",
    });
    expect(key).toBe("APPOINTMENTS:id:SYN-0001");
  });

  it("deriva uma chave estável e determinística quando não há identificador", () => {
    const input = {
      sourceRecordId: null,
      clinicExternalId: "CLINIC-001",
      occurredAt: new Date("2025-01-06T09:00:00.000Z"),
      patientExternalRef: "PATIENT-001",
      practitionerExternalId: "DOCTOR-001",
    };
    const first = buildStableRowKey(input);
    expect(buildStableRowKey(input)).toBe(first);
    expect(first).toMatch(/^APPOINTMENTS:derived:[0-9a-f]{32}$/);
  });

  it("distingue consultas diferentes", () => {
    const base = {
      sourceRecordId: null,
      clinicExternalId: "CLINIC-001",
      occurredAt: new Date("2025-01-06T09:00:00.000Z"),
      patientExternalRef: "PATIENT-001",
      practitionerExternalId: null,
    };
    expect(buildStableRowKey(base)).not.toBe(
      buildStableRowKey({ ...base, occurredAt: new Date("2025-01-06T10:00:00.000Z") }),
    );
    expect(buildStableRowKey(base)).not.toBe(
      buildStableRowKey({ ...base, patientExternalRef: "PATIENT-002" }),
    );
  });
});
