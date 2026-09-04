/**
 * Relatório de erros de um lote, em CSV.
 *
 * O gestor corrige o ficheiro no Excel, por isso o relatório tem de abrir no
 * Excel: `;` como separador e BOM UTF-8, sem o qual o Excel em português
 * estropia os acentos.
 *
 * Só transporta metadados — linha, coluna, código e mensagem. Nunca o valor da
 * célula: o conteúdo do ficheiro não é guardado (D-007) e as mensagens são
 * escritas para não citar dados de paciente.
 */

export interface ErrorReportRow {
  readonly sourceRowNumber: number;
  readonly columnName: string | null;
  readonly code: string;
  readonly message: string;
  readonly severity: string;
}

const HEADERS = ["linha", "coluna", "gravidade", "codigo", "mensagem"] as const;

const SEVERITY_LABELS: Record<string, string> = {
  ERROR: "Erro",
  WARNING: "Aviso",
};

/**
 * Escapa um campo para CSV.
 *
 * O prefixo `'` em valores que começam por `=`, `+`, `-` ou `@` evita que o
 * Excel os interprete como fórmula ao abrir o relatório.
 */
function escapeCsvField(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  const needsQuotes = /[";\n\r]/.test(guarded);
  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function buildErrorReportCsv(rows: readonly ErrorReportRow[]): string {
  const lines = [HEADERS.join(";")];

  for (const row of rows) {
    lines.push(
      [
        String(row.sourceRowNumber),
        escapeCsvField(row.columnName ?? ""),
        escapeCsvField(SEVERITY_LABELS[row.severity] ?? row.severity),
        escapeCsvField(row.code),
        escapeCsvField(row.message),
      ].join(";"),
    );
  }

  // BOM UTF-8: sem ele o Excel abre "não está mapeado" como "nÃ£o estÃ¡...".
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Nome de ficheiro seguro, derivado do ficheiro original. */
export function errorReportFilename(originalFilename: string): string {
  const base = originalFilename.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-");
  return `erros-${base || "importacao"}.csv`;
}
