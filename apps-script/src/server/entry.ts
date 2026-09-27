/**
 * Ponto de entrada do servidor no Google Apps Script (compilado para `Servidor.gs`).
 * Liga a API aos serviços do Google: SpreadsheetApp, Sheets (serviço avançado),
 * LockService e Utilities.
 */
import { Api, dispatch, type ApiResult, type Env } from "./api";
import type { SheetLike, SpreadsheetLike } from "./sheets";

/* eslint-disable @typescript-eslint/no-explicit-any -- serviços globais do Apps Script, sem tipos no bundle */
declare const SpreadsheetApp: any;
declare const Sheets: any;
declare const LockService: any;
declare const Utilities: any;
declare const PropertiesService: any;
declare const HtmlService: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const TIME_ZONE = "Europe/Lisbon";

/**
 * A folha de dados: a do próprio ficheiro (script criado a partir do Google
 * Sheets, recomendado) ou, num script independente, a indicada na propriedade
 * `SPREADSHEET_ID` — criada na primeira execução se não existir.
 */
function spreadsheetId(): string {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return String(active.getId());
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SPREADSHEET_ID");
  if (id) return String(id);
  const created = SpreadsheetApp.create("Produção clínica — dados");
  props.setProperty("SPREADSHEET_ID", created.getId());
  return String(created.getId());
}

/**
 * Abrir a folha com o SpreadsheetApp é lento: só acontece quando é preciso
 * escrever. As leituras usam o serviço avançado Sheets (uma chamada para todos
 * os separadores), se estiver ativo no projeto (ver appsscript.json).
 */
class GoogleSpreadsheet implements SpreadsheetLike {
  private opened: SpreadsheetLike | null = null;
  readonly readTables?: (names: readonly string[]) => unknown[][][];

  constructor(readonly id: string) {
    if (typeof Sheets !== "undefined") {
      this.readTables = (names) => {
        const response = Sheets.Spreadsheets.Values.batchGet(id, {
          // Separador inteiro; os nomes não têm plicas.
          ranges: names.map((name) => `'${name}'`),
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "FORMATTED_STRING",
        });
        return (response.valueRanges ?? []).map((range: { values?: unknown[][] }) => range.values ?? []);
      };
    }
  }

  private get sheet(): SpreadsheetLike {
    return (this.opened ??= SpreadsheetApp.openById(this.id) as SpreadsheetLike);
  }

  getSheetByName(name: string): SheetLike | null {
    return this.sheet.getSheetByName(name);
  }

  insertSheet(name: string): SheetLike {
    return this.sheet.insertSheet(name);
  }
}

function env(): Env {
  const sheet = new GoogleSpreadsheet(spreadsheetId());
  return {
    spreadsheet: sheet,
    spreadsheetUrl: () => `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
    newId: () => String(Utilities.getUuid()),
    today: () => String(Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd")),
    nowIso: () => new Date().toISOString(),
    withLock: <T,>(fn: () => T): T => {
      const lock = LockService.getScriptLock();
      lock.waitLock(20_000);
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    },
  };
}

/** Chamado pelo cliente via `google.script.run.api(nome, argumentos)`. */
export function api(name: string, args: unknown[]): string {
  return dispatch(env(), name, Array.isArray(args) ? args : []);
}

export function setup(): string {
  const e = env();
  const created = new Api(e).setup();
  return created.length
    ? `Separadores criados: ${created.join(", ")}. Folha: ${e.spreadsheetUrl()}`
    : `Já estava configurado. Folha: ${e.spreadsheetUrl()}`;
}

export function loadDemo(): string {
  return new Api(env()).loadDemo().message;
}

/**
 * Os dados vão já dentro da página: o iPhone faz um só pedido ao abrir a app.
 * Se a leitura falhar, a página pede-os depois e mostra o erro.
 */
function bootScript(): string {
  let result: ApiResult;
  try {
    result = { ok: true, message: "", errors: {}, data: new Api(env()).getData() };
  } catch {
    return "";
  }
  // `<` escapado: o JSON não pode fechar o elemento <script>.
  return `<script>window.__BOOT__=${JSON.stringify(result).replace(/</g, "\\u003c")}</script>`;
}

export function doGet() {
  const page = String(HtmlService.createHtmlOutputFromFile("Index").getContent());
  const boot = bootScript();
  return HtmlService.createHtmlOutput(page.replace("</head>", () => `${boot}</head>`))
    .setTitle("Produção clínica")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover")
    .addMetaTag("apple-mobile-web-app-capable", "yes")
    .addMetaTag("mobile-web-app-capable", "yes");
}
