import { describe, expect, it } from "vitest";

import {
  buildErrorReportCsv,
  errorReportFilename,
} from "@/modules/imports/domain/error-report";

const ROWS = [
  {
    sourceRowNumber: 4,
    columnName: "data_hora",
    code: "DATE_OUT_OF_RANGE",
    message: 'Data inexistente no calendário: "31/02/2025".',
    severity: "ERROR",
  },
  {
    sourceRowNumber: 9,
    columnName: null,
    code: "ROW_DUPLICATE_IN_FILE",
    message: "Linha repetida dentro do próprio ficheiro; será gravada uma só vez.",
    severity: "WARNING",
  },
];

describe("relatório de erros em CSV", () => {
  it("abre corretamente no Excel português", () => {
    const csv = buildErrorReportCsv(ROWS);
    // BOM UTF-8, sem o qual o Excel estropia os acentos.
    expect(csv.startsWith("﻿")).toBe(true);
    // Separador `;` e fim de linha CRLF.
    expect(csv).toContain("linha;coluna;gravidade;codigo;mensagem");
    expect(csv).toContain("\r\n");
  });

  it("traduz a gravidade e mantém linha e coluna", () => {
    const csv = buildErrorReportCsv(ROWS);
    expect(csv).toContain("4;data_hora;Erro;DATE_OUT_OF_RANGE;");
    expect(csv).toContain("9;;Aviso;ROW_DUPLICATE_IN_FILE;");
  });

  it("escapa aspas e separadores dentro da mensagem", () => {
    const csv = buildErrorReportCsv([
      { ...ROWS[0]!, message: 'Valor "x"; inesperado' },
    ]);
    expect(csv).toContain('"Valor ""x""; inesperado"');
  });

  it("neutraliza fórmulas para o Excel não as executar", () => {
    const csv = buildErrorReportCsv([{ ...ROWS[0]!, message: "=1+1" }]);
    expect(csv).toContain("'=1+1");
  });

  it("gera um nome de ficheiro seguro", () => {
    expect(errorReportFilename("demo-agenda.csv")).toBe("erros-demo-agenda.csv");
    expect(errorReportFilename("Agenda 2025/01.xlsx")).toBe("erros-Agenda-2025-01.csv");
  });

  it("produz apenas o cabeçalho quando não há erros", () => {
    const csv = buildErrorReportCsv([]);
    // Sem .trim(): o JS trata o BOM como espaço e removê-lo-ia da comparação.
    expect(csv).toBe("\ufefflinha;coluna;gravidade;codigo;mensagem\r\n");
  });
});
