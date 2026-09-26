/**
 * CSV do módulo de produção: escrita para Excel português (`;`, BOM UTF-8, CRLF,
 * vírgula decimal) e leitura tolerante (separador detetado, BOM removido).
 */
import { createHash } from "node:crypto";

import Papa from "papaparse";

/** Neutraliza fórmulas (`=`, `+`, `-`, `@`) e escapa aspas/separadores. */
export function escapeCsvField(value: string): string {
  const guarded = /^[=+\-@]/.test(value) && !/^-?\d+([.,]\d+)?$/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | null>>): string {
  const lines = [headers.join(";")];
  for (const row of rows) lines.push(row.map((v) => escapeCsvField(v === null ? "" : String(v))).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export interface ParsedCsv {
  readonly headers: string[];
  readonly rows: Array<Record<string, string>>;
  readonly delimiter: string;
}

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, "");
  const result = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [";", ",", "\t", "|"],
    transformHeader: (h) => h.trim().toLowerCase(),
    transform: (v) => v.trim(),
  });
  return {
    headers: (result.meta.fields ?? []).filter(Boolean),
    rows: result.data,
    delimiter: result.meta.delimiter,
  };
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
