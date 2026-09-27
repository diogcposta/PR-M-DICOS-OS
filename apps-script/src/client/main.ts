/**
 * Aplicação cliente (Google Apps Script HtmlService).
 *
 * Router por hash (`#/planos?mes=2026-09`), navegação inferior no iPhone,
 * ações genéricas por atributos `data-op` e cálculos locais sobre o estado.
 */
import type { AppData, Operation } from "../server/api";

import { buildState, type State } from "./state";
import { call } from "./transport";
import { esc } from "./ui";
import { insurance, profitability, report, simulator, trends } from "./views/analysis";
import { dashboard } from "./views/dashboard";
import { data, more, planDetail, plans, settings } from "./views/manage";
import { absences, agenda, days, formValues, procedureDetail, procedures, register, registerHooks, showErrors } from "./views/records";
import type { Ctx, View } from "./views/types";

const ROUTES: Record<string, (ctx: Ctx) => View> = {
  "": dashboard,
  registar: register,
  procedimentos: procedures,
  procedimento: procedureDetail,
  dias: days,
  agenda,
  faltas: absences,
  planos: plans,
  plano: planDetail,
  rentabilidade: profitability,
  seguros: insurance,
  simulador: simulator,
  tendencias: trends,
  relatorio: report,
  definicoes: settings,
  dados: data,
  mais: () => more(),
};

/** Separadores da barra inferior (iPhone) e do topo (ecrãs largos). */
const TABS: Array<[string, string, string]> = [
  ["", "Início", "◧"],
  ["registar", "Registar", "＋"],
  ["agenda", "Agenda", "▦"],
  ["planos", "Planos", "✓"],
  ["mais", "Mais", "☰"],
];
const MORE = new Set(["procedimentos", "procedimento", "dias", "faltas", "rentabilidade", "seguros", "simulador", "tendencias", "relatorio", "definicoes", "dados", "mais", "plano"]);

let state: State | null = null;

const main = () => document.getElementById("app")!;

function toast(message: string, ok: boolean): void {
  const el = document.getElementById("toast")!;
  el.textContent = `${ok ? "✓" : "⚠"} ${message}`;
  el.className = `toast show ${ok ? "ok" : "err"}`;
  window.clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(window.setTimeout(() => (el.className = "toast"), ok ? 2500 : 6000));
}

function applyData(next: AppData): void {
  state = buildState(next);
}

function parseHash(): { path: string; segments: string[]; params: URLSearchParams } {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path = "", query = ""] = raw.split("?");
  const segments = path.split("/").filter(Boolean);
  return { path, segments, params: new URLSearchParams(query) };
}

function go(route: string): void {
  const target = `#${route.startsWith("/") ? route : `/${route}`}`;
  if (location.hash === target) render();
  else location.hash = target;
}

function renderNav(active: string): void {
  const current = MORE.has(active) ? "mais" : active;
  document.getElementById("tabs")!.innerHTML = TABS.map(
    ([route, label, icon]) =>
      `<a href="#/${route}" class="tab${current === route ? " on" : ""}" ${current === route ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span>${esc(label)}</a>`,
  ).join("");
}

function render(): void {
  if (!state) return;
  const { path, segments, params } = parseHash();
  const key = segments[0] ?? "";
  const factory = ROUTES[key] ?? dashboard;
  const ctx: Ctx = { state, path, segments, params, go, rerender: render };
  let view: View;
  try {
    view = factory(ctx);
  } catch (error) {
    main().innerHTML = `<div class="card pad"><p>Não foi possível mostrar esta página.</p><p class="muted small">${esc((error as Error).message)}</p></div>`;
    return;
  }
  document.title = `${view.title} · Produção clínica`;
  main().innerHTML = view.body.html;
  renderNav(key);
  view.mount?.(main(), ctx);
}

async function runOp(op: Operation, args: unknown[], el: HTMLElement): Promise<boolean> {
  el.setAttribute("aria-busy", "true");
  (el as HTMLButtonElement).disabled = true;
  document.body.classList.add("busy");
  const result = await call(op, ...args);
  document.body.classList.remove("busy");
  el.removeAttribute("aria-busy");
  (el as HTMLButtonElement).disabled = false;
  toast(result.message, result.ok);
  if (result.ok && result.data) applyData(result.data);
  if (el instanceof HTMLFormElement) showErrors(el, result.ok ? {} : result.errors);
  return result.ok;
}

document.addEventListener("submit", async (e) => {
  const form = e.target as HTMLFormElement;
  if (form.matches("[data-period], [data-agenda]")) {
    e.preventDefault();
    return;
  }
  if (form.hasAttribute("data-custom") || !form.dataset.op) return;
  e.preventDefault();
  const args = form.dataset.id ? [form.dataset.id, formValues(form)] : [formValues(form)];
  const ok = await runOp(form.dataset.op as Operation, args, form);
  if (ok) {
    if (form.dataset.next) go(form.dataset.next);
    else render();
  }
});

document.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const hint = target.closest<HTMLElement>("[data-hint]");
  if (hint) {
    toast(hint.dataset.hint ?? "", true);
    return;
  }
  const button = target.closest<HTMLElement>("button[data-op]");
  if (!button || button.closest("form[data-op]")) return;
  e.preventDefault();
  if (button.dataset.confirm && !window.confirm(button.dataset.confirm)) return;
  const args = button.dataset.id ? [button.dataset.id] : [];
  const ok = await runOp(button.dataset.op as Operation, args, button);
  if (ok) {
    if (button.dataset.next) go(button.dataset.next);
    else render();
  }
});

/** Seletores de mês/período e agenda: mudam só o URL. */
document.addEventListener("change", (e) => {
  const form = (e.target as HTMLElement).closest<HTMLFormElement>("form[data-period], form[data-agenda]");
  if (!form) return;
  const { segments, params } = parseHash();
  new FormData(form).forEach((v, k) => params.set(k, String(v)));
  go(`/${segments.join("/")}?${params.toString()}`);
});

window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});

async function start(): Promise<void> {
  registerHooks(applyData, toast);
  const result = await call("getData");
  if (!result.ok || !result.data) {
    main().innerHTML = `<div class="card pad"><h1>Não foi possível carregar os dados</h1><p>${esc(result.message)}</p><p class="muted small">Se é a primeira utilização, execute a função <code>configurar</code> no editor do Apps Script.</p><button class="btn primary" onclick="location.reload()">Tentar de novo</button></div>`;
    return;
  }
  applyData(result.data);
  render();
}

void start();
