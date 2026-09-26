/**
 * Ponto de entrada do servidor no Google Apps Script (compilado para `Servidor.gs`).
 * Liga a API aos serviços do Google: SpreadsheetApp, LockService e Utilities.
 */
import { Api, dispatch, type Env } from "./api";
import type { SpreadsheetLike } from "./sheets";

/* eslint-disable @typescript-eslint/no-explicit-any -- serviços globais do Apps Script, sem tipos no bundle */
declare const SpreadsheetApp: any;
declare const LockService: any;
declare const Utilities: any;
declare const PropertiesService: any;
declare const HtmlService: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const TIME_ZONE = "Europe/Lisbon";

/**
 * A folha de dados: a do próprio ficheiro (script criado a partir do Google
 * Sheets, recomendado) ou, num script independente, uma folha criada na
 * primeira execução e guardada nas propriedades do script.
 */
function spreadsheet() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  const created = SpreadsheetApp.create("Produção clínica — dados");
  props.setProperty("SPREADSHEET_ID", created.getId());
  return created;
}

function env(): Env {
  const sheet = spreadsheet();
  return {
    spreadsheet: sheet as SpreadsheetLike,
    spreadsheetUrl: () => String(sheet.getUrl()),
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

export function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Produção clínica")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover")
    .addMetaTag("apple-mobile-web-app-capable", "yes")
    .addMetaTag("mobile-web-app-capable", "yes");
}
