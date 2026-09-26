/**
 * Executa os ficheiros GERADOS (dist/Codigo.gs + dist/Servidor.gs) num contexto
 * isolado com serviços do Apps Script simulados — o mesmo que o Google carrega.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";

import { FakeSpreadsheet } from "../../apps-script/src/preview/fake-sheets";

const dist = path.resolve("apps-script/dist");

beforeAll(() => {
  execFileSync("node", ["apps-script/build.mjs"], { stdio: "pipe" });
}, 60_000);

function loadScript() {
  const spreadsheet = new FakeSpreadsheet();
  const logs: string[] = [];
  let html: { title?: string; file?: string; meta: Record<string, string> } = { meta: {} };
  let uuid = 0;
  const output = {
    setTitle(t: string) {
      html.title = t;
      return output;
    },
    addMetaTag(name: string, content: string) {
      html.meta[name] = content;
      return output;
    },
  };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ ...proxy(spreadsheet), getUrl: () => "https://docs.google.com/spreadsheets/d/x" }) },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    Utilities: { getUuid: () => `uuid-${++uuid}`, formatDate: () => "2026-09-26" },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => undefined }) },
    HtmlService: {
      createHtmlOutputFromFile: (file: string) => {
        html = { file, meta: {} };
        return output;
      },
    },
    Logger: { log: (m: string) => logs.push(m) },
  });
  // O Apps Script junta todos os ficheiros .gs num único âmbito global.
  vm.runInContext(readFileSync(path.join(dist, "Servidor.gs"), "utf8"), context);
  vm.runInContext(readFileSync(path.join(dist, "Codigo.gs"), "utf8"), context);
  return { context: context as Record<string, (...a: unknown[]) => unknown>, logs, html: () => html };
}

/** Os métodos da folha simulada dependem de `this`: liga-os antes de espalhar. */
function proxy(s: FakeSpreadsheet) {
  return { getSheetByName: s.getSheetByName.bind(s), insertSheet: s.insertSheet.bind(s) };
}

describe("ficheiros gerados para o Apps Script", () => {
  it("configurar, carregar demonstração e ler os dados", () => {
    const { context, logs } = loadScript();
    context.configurar!();
    expect(logs[0]).toMatch(/Separadores criados: Perfil, Horario/);
    context.carregarDemonstracao!();
    expect(logs[1]).toBe("Dados de demonstração carregados.");
    const result = JSON.parse(String(context.api!("getData", [])));
    expect(result.ok).toBe(true);
    expect(result.data.procedures.length).toBeGreaterThan(500);
    expect(result.data.today).toBe("2026-09-26");
  });

  it("a validação Zod funciona dentro do Apps Script", () => {
    const { context } = loadScript();
    context.configurar!();
    const bad = JSON.parse(String(context.api!("createProcedure", [{ date: "2026-02-30", procedureType: "", category: "X", billed: "abc" }])));
    expect(bad.ok).toBe(false);
    expect(bad.errors.date).toBe("Data inválida.");
    const good = JSON.parse(String(context.api!("createProcedure", [{ date: "2026-09-02", procedureType: "Restauração", category: "Dentisteria", billed: "70", plannedVisits: "1" }])));
    expect(good.ok).toBe(true);
  });

  it("doGet serve Index com viewport para iPhone", () => {
    const { context, html } = loadScript();
    context.doGet!({});
    expect(html()).toMatchObject({ file: "Index", title: "Produção clínica" });
    expect(html().meta.viewport).toContain("width=device-width");
  });

  it("Index.html é uma página única, sem recursos externos", () => {
    const page = readFileSync(path.join(dist, "Index.html"), "utf8");
    expect(page).not.toMatch(/<script[^>]+src=/);
    expect(page).not.toMatch(/<link[^>]+stylesheet/);
    expect(page.match(/<\/script>/g)).toHaveLength(1);
  });

  it("dist/ está atualizado (o build é determinístico e foi incluído no commit)", () => {
    const before = readFileSync(path.join(dist, "Servidor.gs"), "utf8");
    execFileSync("node", ["apps-script/build.mjs"], { stdio: "pipe" });
    expect(readFileSync(path.join(dist, "Servidor.gs"), "utf8")).toBe(before);
  });
});
