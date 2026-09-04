/**
 * Leitura de ficheiros .csv e .xlsx.
 *
 * O ficheiro é processado em memória e descartado: não guardamos o conteúdo
 * (D-007). O que fica na base é o hash, o mapeamento e os erros por linha.
 */
import { createHash } from "node:crypto";

import ExcelJS from "exceljs";
import Papa from "papaparse";

import {
  ACCEPTED_FILE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
} from "@/modules/imports/domain/contract";
import type { RawRow } from "@/modules/imports/domain/validate-appointments";

export type FileKind = "csv" | "xlsx";

export interface ParsedSheet {
  readonly name: string;
  readonly headers: readonly string[];
  readonly rows: readonly RawRow[];
}

export interface ParsedFile {
  readonly kind: FileKind;
  readonly sheets: readonly ParsedSheet[];
  /** Separador detetado, apenas para CSV. Mostrado ao utilizador. */
  readonly detectedDelimiter?: string;
}

export class FileRejectedError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FileRejectedError";
    this.code = code;
  }
}

/** SHA-256 do conteúdo, em hexadecimal. */
export function hashFileContent(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Rejeita por extensão e tamanho **antes** de qualquer parsing — um ficheiro
 * inaceitável não deve chegar a ser interpretado.
 */
export function assertAcceptableFile(filename: string, sizeBytes: number): FileKind {
  const lower = filename.toLowerCase();
  const extension = ACCEPTED_FILE_EXTENSIONS.find((candidate) => lower.endsWith(candidate));

  if (extension === undefined) {
    throw new FileRejectedError(
      "FILE_TYPE_UNSUPPORTED",
      `Apenas são aceites ficheiros ${ACCEPTED_FILE_EXTENSIONS.join(" e ")}.`,
    );
  }

  if (sizeBytes <= 0) {
    throw new FileRejectedError("FILE_EMPTY", "O ficheiro está vazio.");
  }

  if (sizeBytes > MAX_UPLOAD_BYTES) {
    const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    throw new FileRejectedError(
      "FILE_TOO_LARGE",
      `O ficheiro excede o limite de ${limitMb} MB.`,
    );
  }

  return extension === ".csv" ? "csv" : "xlsx";
}

function cleanHeaders(headers: readonly unknown[]): string[] {
  return headers.map((header, index) => {
    const text = header === null || header === undefined ? "" : String(header).trim();
    // Uma coluna sem nome continua a existir; damos-lhe um rótulo posicional
    // para poder ser mapeada em vez de desaparecer.
    return text.length === 0 ? `coluna_${index + 1}` : text;
  });
}

function parseCsv(content: Buffer): ParsedFile {
  // Papaparse deteta o separador (`,`, `;`, tab) — as exportações portuguesas
  // usam quase sempre `;` porque a vírgula é o separador decimal.
  const text = content.toString("utf8").replace(/^﻿/, "");
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string, index: number) => {
      const trimmed = header.trim();
      return trimmed.length === 0 ? `coluna_${index + 1}` : trimmed;
    },
  });

  const structuralError = result.errors.find((error) => error.type === "Delimiter");
  if (structuralError) {
    throw new FileRejectedError(
      "CSV_STRUCTURE_INVALID",
      "Não foi possível detetar o separador de colunas do CSV.",
    );
  }

  const headers = cleanHeaders(result.meta.fields ?? []);
  if (headers.length === 0) {
    throw new FileRejectedError("CSV_NO_HEADER", "O CSV não tem linha de cabeçalho.");
  }

  return {
    kind: "csv",
    detectedDelimiter: result.meta.delimiter,
    sheets: [{ name: "CSV", headers, rows: result.data }],
  };
}

async function parseXlsx(content: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();
  try {
    // O tipo do ExcelJS pede ArrayBuffer; um Buffer é aceite em runtime.
    await workbook.xlsx.load(content as unknown as ArrayBuffer);
  } catch {
    throw new FileRejectedError(
      "XLSX_STRUCTURE_INVALID",
      "Não foi possível ler o ficheiro Excel. Confirme que não está corrompido nem protegido por palavra-passe.",
    );
  }

  const sheets: ParsedSheet[] = [];

  for (const worksheet of workbook.worksheets) {
    const headerRow = worksheet.getRow(1);
    const rawHeaders: unknown[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      rawHeaders.push(cell.value);
    });

    const headers = cleanHeaders(rawHeaders);
    if (headers.length === 0) {
      continue;
    }

    const rows: RawRow[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const record: Record<string, unknown> = {};
      let hasValue = false;

      headers.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        let value: unknown = cell.value;

        // O ExcelJS devolve fórmulas e hiperligações como objetos; queremos o
        // valor apresentado, não a estrutura interna.
        if (value !== null && typeof value === "object") {
          if ("result" in value) {
            value = (value as { result: unknown }).result;
          } else if ("text" in value) {
            value = (value as { text: unknown }).text;
          } else if ("richText" in value) {
            value = (value as { richText: { text: string }[] }).richText
              .map((part) => part.text)
              .join("");
          }
        }

        if (value !== null && value !== undefined && String(value).trim() !== "") {
          hasValue = true;
        }
        record[header] = value ?? null;
      });

      if (hasValue) {
        rows.push(record);
      }
    });

    sheets.push({ name: worksheet.name, headers, rows });
  }

  if (sheets.length === 0) {
    throw new FileRejectedError("XLSX_NO_SHEETS", "O ficheiro Excel não tem folhas legíveis.");
  }

  return { kind: "xlsx", sheets };
}

export async function parseImportFile(kind: FileKind, content: Buffer): Promise<ParsedFile> {
  return kind === "csv" ? parseCsv(content) : parseXlsx(content);
}
