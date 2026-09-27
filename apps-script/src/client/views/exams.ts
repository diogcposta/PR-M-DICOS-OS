/**
 * Exames complementares (ortopantomografia, CBCT…): registo rápido e totais do
 * período. Honorários à mesma percentagem dos atos; à parte da produção
 * clínica e do €/hora (D-059).
 */
import { examTotals } from "@/modules/production/domain/exams";
import { euros, percent } from "@/modules/production/domain/format";
import { formatCivilDate } from "@/modules/production/domain/time";

import type { State } from "../state";
import { empty, field, html, link, pageTitle, section, stat, table, type Safe } from "../ui";

import { periodOf, periodPicker, type Ctx, type View } from "./types";

const money = (cents: number) => (cents === 0 ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));

/** Tipos das Definições e os já usados em exames, sem repetidos. */
function examTypeNames(state: State): string[] {
  const names = [...state.examTypes.map((t) => t.name), ...state.exams.map((x) => x.examType)];
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "pt"));
}

/** Valor habitual: o das Definições ou, sem ele, o do último exame desse tipo. */
function usualPrice(state: State, examType: string): number {
  const configured = state.examTypes.find((t) => t.name.toLowerCase() === examType.toLowerCase())?.priceCents ?? 0;
  if (configured > 0) return configured;
  return state.exams.filter((x) => x.examType.toLowerCase() === examType.toLowerCase()).at(-1)?.billedCents ?? 0;
}

function examForm(state: State): Safe {
  const names = examTypeNames(state);
  const first = names[0] ?? "";
  return html`<form class="card pad form" data-op="createExam" data-reset data-exam-form aria-label="Registar exame">
    ${names.length ? html`<div class="chips">${names.map((n) => html`<button type="button" class="chip" data-exam-type="${n}" data-price="${money(usualPrice(state, n))}">${n}</button>`)}</div>` : ""}
    <div class="grid">
      ${field({ label: "Exame", name: "examType", value: first, required: true, list: "dl-exam-types" })}
      ${field({ label: "Data", name: "date", type: "date", value: state.today, required: true })}
      ${field({ label: "Valor do exame (€)", name: "billed", value: money(usualPrice(state, first)), required: true, inputmode: "decimal", hint: `Recebe ${percent(state.profile.feeBps / 10_000, 0)} deste valor.` })}
      ${field({ label: "Case ID (opcional)", name: "caseCode", attrs: 'autocapitalize="characters" placeholder="DC-2026-001"' })}
      ${field({ label: "Observação", name: "note", wide: true, hint: "Sem nomes nem contactos.", attrs: 'maxlength="200"' })}
    </div>
    <datalist id="dl-exam-types">${names.map((n) => html`<option value="${n}"></option>`)}</datalist>
    <div class="form-actions"><button type="submit" class="btn primary">Registar exame</button></div>
  </form>`;
}

/** Escolher um tipo preenche o valor habitual (se o valor não foi escrito à mão). */
function mountExamForm(form: HTMLFormElement, state: State): void {
  const type = form.querySelector<HTMLInputElement>("[name=examType]")!;
  const billed = form.querySelector<HTMLInputElement>("[name=billed]")!;
  let auto = billed.value;
  const fill = (name: string) => {
    if (billed.value !== auto) return;
    auto = money(usualPrice(state, name));
    billed.value = auto;
  };
  type.addEventListener("input", () => fill(type.value.trim()));
  form.querySelectorAll<HTMLButtonElement>("[data-exam-type]").forEach((chip) =>
    chip.addEventListener("click", () => {
      type.value = chip.dataset.examType!;
      auto = billed.value; // escolha explícita: substitui sempre o valor
      fill(type.value);
      billed.focus();
    }),
  );
}

export function exams(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx);
  const t = examTotals(state.exams, period.from, period.to, state.profile.feeBps);
  const list = state.exams.filter((x) => x.date >= period.from && x.date <= period.to).slice().reverse();
  const body = html`
    ${pageTitle("Exames", `${period.label}. Ortopantomografias, CBCT e outros exames dos seus pacientes: recebe ${percent(state.profile.feeBps / 10_000, 0)} do valor. Não entram na produção clínica nem no €/hora.`, periodPicker(period))}
    <section class="cards">
      ${stat({ label: "Exames", value: String(t.count) })}
      ${stat({ label: "Valor dos exames", value: euros(t.billedCents) })}
      ${stat({ label: `Honorários (${percent(state.profile.feeBps / 10_000, 0)})`, value: euros(t.feeCents), id: "exam-fees" })}
    </section>
    ${section("Registar exame", examForm(state), { desc: state.examTypes.some((x) => x.priceCents > 0) ? undefined : "Dica: indique o valor habitual de cada exame nas Definições para não o escrever sempre." })}
    ${t.byType.length > 1 ? section("Por tipo", table(t.byType, [
      { head: "Exame", cell: (r) => r.examType },
      { head: "N.º", cell: (r) => String(r.count), num: true },
      { head: "Valor", cell: (r) => euros(r.billedCents), num: true },
      { head: "Honorários", cell: (r) => euros(r.feeCents), num: true },
    ], "Exames por tipo")) : ""}
    ${section(`Registos · ${period.label}`, list.length === 0 ? empty("Sem exames neste período.") : table(list, [
      { head: "Data", cell: (x) => formatCivilDate(x.date) },
      { head: "Exame", cell: (x) => x.examType },
      { head: "Case ID", cell: (x) => (x.caseCode ? html`<span class="mono">${x.caseCode}</span>` : "—") },
      { head: "Valor", cell: (x) => euros(x.billedCents), num: true },
      { head: "", cell: (x) => html`<button class="btn ghost small" data-op="deleteExam" data-id="${x.id}" data-confirm="Apagar este exame?">Apagar</button>` },
    ], "Exames registados"))}
    <p class="muted small">Valores habituais de cada exame em ${link("/definicoes", "Definições")}.</p>`;
  return {
    title: "Exames",
    body,
    mount: (root) => mountExamForm(root.querySelector<HTMLFormElement>("[data-exam-form]")!, state),
  };
}
