/**
 * Acesso às tabelas no Google Sheets.
 *
 * Depende só de um subconjunto mínimo da API do SpreadsheetApp (interfaces
 * abaixo), para poder ser testado em Node e pré-visualizado no browser com uma
 * folha simulada. Cada pedido lê cada separador no máximo uma vez (cache por
 * execução) e escreve em lote.
 */
import { formatTime, isValidTime, parseTime } from "@/modules/production/domain/time";

import { TABLES, type Column, type Row, type TableKey } from "./tables";

export interface RangeLike {
  getValues(): unknown[][];
  setValues(values: unknown[][]): RangeLike;
  setNumberFormats(formats: string[][]): RangeLike;
}

export interface SheetLike {
  getLastRow(): number;
  getRange(row: number, column: number, numRows: number, numColumns: number): RangeLike;
  deleteRow(rowPosition: number): SheetLike;
  setFrozenRows(rows: number): void;
  clearContents(): SheetLike;
}

export interface SpreadsheetLike {
  getSheetByName(name: string): SheetLike | null;
  insertSheet(name: string): SheetLike;
}

const TEXT_FORMAT = "@";
const NUMBER_FORMAT = "0";
const FLOAT_FORMAT = "0.0#";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Valor de célula → valor de domínio (tolerante a edições manuais na folha). */
export function decodeCell(value: unknown, column: Column): string | number | boolean | null {
  const empty = value === "" || value === null || value === undefined;
  switch (column.type) {
    case "text":
      return empty ? (column.nullable ? null : "") : String(value);
    case "date": {
      if (empty) return column.nullable ? null : "";
      if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
      const text = String(value).trim();
      const pt = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
      return pt ? `${pt[3]}-${pt[2]}-${pt[1]}` : text;
    }
    case "time": {
      if (empty) return 0;
      if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
      if (typeof value === "number") return Math.round(value < 1 ? value * 24 * 60 : value);
      const text = String(value).trim();
      return isValidTime(text) ? parseTime(text) : Number(text) || 0;
    }
    case "int":
      if (empty) return column.nullable ? null : 0;
      return Math.round(Number(String(value).replace(",", "."))) || 0;
    case "float":
      if (empty) return column.nullable ? null : 0;
      return Number(String(value).replace(",", ".")) || 0;
    case "bool":
      return value === true || /^(true|verdadeiro|sim|1)$/i.test(String(value).trim());
  }
}

/** Valor de domínio → valor de célula. */
export function encodeCell(value: unknown, column: Column): string | number {
  if (value === null || value === undefined) return "";
  switch (column.type) {
    case "time":
      return formatTime(Number(value));
    case "bool":
      // Texto "sim"/"não": legível na folha e imune a formatações automáticas.
      return value ? "sim" : "não";
    case "int":
      return Math.round(Number(value));
    case "float":
      return Number(value);
    default:
      return String(value);
  }
}

function formatOf(column: Column): string {
  return column.type === "int" ? NUMBER_FORMAT : column.type === "float" ? FLOAT_FORMAT : TEXT_FORMAT;
}

export class SheetDb {
  private readonly cache = new Map<TableKey, Row[]>();

  constructor(private readonly spreadsheet: SpreadsheetLike) {}

  /** Cria os separadores em falta, com cabeçalho e formatos. Idempotente. */
  ensureTables(): string[] {
    const created: string[] = [];
    for (const key of Object.keys(TABLES) as TableKey[]) {
      const def = TABLES[key];
      if (this.spreadsheet.getSheetByName(def.name)) continue;
      const sheet = this.spreadsheet.insertSheet(def.name);
      const headerRange = sheet.getRange(1, 1, 1, def.columns.length);
      headerRange.setNumberFormats([def.columns.map(() => TEXT_FORMAT)]);
      headerRange.setValues([def.columns.map((col) => col.header)]);
      sheet.setFrozenRows(1);
      created.push(def.name);
    }
    return created;
  }

  private sheet(key: TableKey): SheetLike {
    const sheet = this.spreadsheet.getSheetByName(TABLES[key].name);
    if (!sheet) throw new Error(`Falta o separador "${TABLES[key].name}". Execute a função "configurar" no editor do Apps Script.`);
    return sheet;
  }

  read(key: TableKey): Row[] {
    const cached = this.cache.get(key);
    if (cached) return cached;
    const def = TABLES[key];
    const sheet = this.sheet(key);
    const last = sheet.getLastRow();
    if (last < 1) {
      this.cache.set(key, []);
      return [];
    }
    const width = def.columns.length;
    const values = sheet.getRange(1, 1, last, width).getValues();
    const headers = (values[0] ?? []).map((h) => String(h).trim());
    const index = def.columns.map((col) => headers.indexOf(col.header));
    const missing = def.columns.filter((_, i) => index[i] === -1).map((col) => col.header);
    if (missing.length) {
      throw new Error(`O separador "${def.name}" não tem as colunas: ${missing.join(", ")}. Não altere os cabeçalhos.`);
    }
    const rows: Row[] = [];
    for (let r = 1; r < values.length; r++) {
      const raw = values[r]!;
      if (raw.every((v) => v === "" || v === null)) continue;
      const row: Row = {};
      def.columns.forEach((col, i) => {
        row[col.field] = decodeCell(raw[index[i]!], col);
      });
      rows.push(row);
    }
    this.cache.set(key, rows);
    return rows;
  }

  private encodeRow(key: TableKey, row: Row): unknown[] {
    return TABLES[key].columns.map((col) => encodeCell(row[col.field], col));
  }

  private formats(key: TableKey, count: number): string[][] {
    const line = TABLES[key].columns.map(formatOf);
    return Array.from({ length: count }, () => line);
  }

  /** Posição (1-based) da linha com o `id`, contando o cabeçalho e linhas vazias. */
  private rowPosition(key: TableKey, id: string): number {
    const sheet = this.sheet(key);
    const last = sheet.getLastRow();
    if (last < 2) return -1;
    const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
    const offset = ids.findIndex((r) => String(r[0]) === id);
    return offset === -1 ? -1 : offset + 2;
  }

  insert(key: TableKey, row: Row): void {
    const sheet = this.sheet(key);
    const position = sheet.getLastRow() + 1;
    const range = sheet.getRange(position, 1, 1, TABLES[key].columns.length);
    range.setNumberFormats(this.formats(key, 1));
    range.setValues([this.encodeRow(key, row)]);
    this.cache.get(key)?.push(row);
  }

  insertMany(key: TableKey, rows: readonly Row[]): void {
    if (rows.length === 0) return;
    const sheet = this.sheet(key);
    const position = sheet.getLastRow() + 1;
    const range = sheet.getRange(position, 1, rows.length, TABLES[key].columns.length);
    range.setNumberFormats(this.formats(key, rows.length));
    range.setValues(rows.map((r) => this.encodeRow(key, r)));
    this.cache.get(key)?.push(...rows);
  }

  update(key: TableKey, id: string, row: Row): void {
    const position = this.rowPosition(key, id);
    if (position === -1) throw new Error("Registo não encontrado.");
    const range = this.sheet(key).getRange(position, 1, 1, TABLES[key].columns.length);
    range.setNumberFormats(this.formats(key, 1));
    range.setValues([this.encodeRow(key, row)]);
    const cached = this.cache.get(key);
    if (cached) {
      const i = cached.findIndex((r) => r.id === id);
      if (i >= 0) cached[i] = row;
    }
  }

  remove(key: TableKey, id: string): boolean {
    const position = this.rowPosition(key, id);
    if (position === -1) return false;
    this.sheet(key).deleteRow(position);
    const cached = this.cache.get(key);
    if (cached) this.cache.set(key, cached.filter((r) => r.id !== id));
    return true;
  }

  /** Substitui todo o conteúdo (usado ao carregar a demonstração). */
  replaceAll(key: TableKey, rows: readonly Row[]): void {
    const def = TABLES[key];
    const sheet = this.sheet(key);
    sheet.clearContents();
    const header = sheet.getRange(1, 1, 1, def.columns.length);
    header.setNumberFormats([def.columns.map(() => TEXT_FORMAT)]);
    header.setValues([def.columns.map((col) => col.header)]);
    this.cache.set(key, []);
    this.insertMany(key, rows);
  }
}
