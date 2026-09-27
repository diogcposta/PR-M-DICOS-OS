/**
 * Google Sheets simulado (memória, opcionalmente persistido em localStorage).
 * Implementa só o subconjunto usado por `SheetDb`; serve os testes em Node e a
 * pré-visualização local da app Apps Script no browser.
 */
import type { RangeLike, SheetLike, SpreadsheetLike } from "../server/sheets";

type Cell = string | number | boolean | Date | null;

export class FakeSheet implements SheetLike {
  rows: Cell[][] = [];
  frozen = 0;

  constructor(readonly name: string, private readonly onChange: () => void = () => undefined) {}

  getLastRow(): number {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i]!.some((c) => c !== "" && c !== null && c !== undefined)) return i + 1;
    }
    return 0;
  }

  getRange(row: number, column: number, numRows: number, numColumns: number): RangeLike {
    if (row < 1 || column < 1 || numRows < 1 || numColumns < 1) throw new Error("Intervalo inválido.");
    const range: RangeLike = {
      getValues: () => {
        return Array.from({ length: numRows }, (_, r) =>
          Array.from({ length: numColumns }, (_, c) => this.rows[row - 1 + r]?.[column - 1 + c] ?? ""),
        );
      },
      setValues: (values: unknown[][]) => {
        if (values.length !== numRows || values.some((v) => v.length !== numColumns)) {
          throw new Error("As dimensões dos dados não correspondem ao intervalo.");
        }
        values.forEach((line, r) => {
          const target = (this.rows[row - 1 + r] ??= []);
          line.forEach((v, c) => (target[column - 1 + c] = v as Cell));
        });
        for (let i = 0; i < this.rows.length; i++) this.rows[i] ??= [];
        this.onChange();
        return range;
      },
      setNumberFormats: () => {
        return range;
      },
    };
    return range;
  }

  deleteRow(rowPosition: number): SheetLike {
    this.rows.splice(rowPosition - 1, 1);
    this.onChange();
    return this;
  }

  setFrozenRows(rows: number): void {
    this.frozen = rows;
  }

  clearContents(): SheetLike {
    this.rows = [];
    this.onChange();
    return this;
  }
}

export class FakeSpreadsheet implements SpreadsheetLike {
  readonly sheets = new Map<string, FakeSheet>();

  constructor(private readonly storageKey?: string, private readonly storage?: Pick<Storage, "getItem" | "setItem">) {
    const saved = storageKey && storage ? storage.getItem(storageKey) : null;
    if (saved) {
      const data = JSON.parse(saved) as Record<string, Cell[][]>;
      for (const [name, rows] of Object.entries(data)) {
        const sheet = new FakeSheet(name, () => this.persist());
        sheet.rows = rows;
        this.sheets.set(name, sheet);
      }
    }
  }

  private persist(): void {
    if (!this.storageKey || !this.storage) return;
    const data: Record<string, Cell[][]> = {};
    for (const [name, sheet] of this.sheets) data[name] = sheet.rows;
    this.storage.setItem(this.storageKey, JSON.stringify(data));
  }

  getSheetByName(name: string): FakeSheet | null {
    return this.sheets.get(name) ?? null;
  }

  insertSheet(name: string): FakeSheet {
    if (this.sheets.has(name)) throw new Error(`Já existe um separador "${name}".`);
    const sheet = new FakeSheet(name, () => this.persist());
    this.sheets.set(name, sheet);
    this.persist();
    return sheet;
  }
}
