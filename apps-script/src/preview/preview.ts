/**
 * Pré-visualização local da app Apps Script (`npm run gas:preview`).
 *
 * Substitui `google.script.run` por uma chamada direta ao mesmo código de
 * servidor, sobre uma folha simulada guardada no localStorage do browser.
 * Serve para testar no iPhone/iPad/computador sem publicar no Google.
 */
import { dispatch, type Env } from "../server/api";

import { FakeSpreadsheet } from "./fake-sheets";

const params = new URLSearchParams(location.search);
const storageKey = params.get("db") ?? "producao-preview";
const today = params.get("hoje") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const spreadsheet = new FakeSpreadsheet(storageKey, window.localStorage);
let counter = 0;
const env: Env = {
  spreadsheet,
  spreadsheetUrl: () => "https://docs.google.com/spreadsheets/ (simulada na pré-visualização)",
  newId: () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  today: () => today,
  nowIso: () => new Date().toISOString(),
  withLock: (fn) => fn(),
};

interface Runner {
  withSuccessHandler(fn: (v: string) => void): Runner;
  withFailureHandler(fn: (e: Error) => void): Runner;
  api(name: string, args: unknown[]): void;
}

function runner(success: (v: string) => void = () => undefined, failure: (e: Error) => void = () => undefined): Runner {
  return {
    withSuccessHandler: (fn) => runner(fn, failure),
    withFailureHandler: (fn) => runner(success, fn),
    api: (name, args) => {
      // Assíncrono e serializado, como no Apps Script.
      const payload = JSON.parse(JSON.stringify(args ?? []));
      window.setTimeout(() => {
        try {
          success(dispatch(env, name, payload));
        } catch (error) {
          failure(error as Error);
        }
      }, 60);
    },
  };
}

(window as unknown as { google: unknown }).google = {
  script: {
    get run() {
      return runner();
    },
  },
};
