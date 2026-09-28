import { buildSlots, fillSlots, type AgendaEvent } from "@/modules/production/domain/agenda";
import {
  ABSENCE_KINDS,
  ABSENCE_LABELS,
  PAYER_LABELS,
  PAYER_TYPES,
  PROCEDURE_CATEGORIES,
  SLOT_OPTIONS,
  type AbsenceKind,
  type PayerType,
} from "@/modules/production/domain/constants";
import { duration, euros, eurosPerHour, hours, percent } from "@/modules/production/domain/format";
import { procedureMetrics } from "@/modules/production/domain/metrics";
import { agendaEfficiency, dayAvailableMinutes } from "@/modules/production/domain/monthly";
import {
  addDays,
  addMonths,
  formatCivilDate,
  formatMonthShort,
  formatTime,
  isValidCivilDate,
  isValidTime,
  isoWeekday,
  monthOf,
  monthRange,
  parseTime,
  weekdayName,
} from "@/modules/production/domain/time";
import { buildSuggestions, feeSettingsOf, monthlySeries, type ProcedureSuggestion } from "@/modules/production/domain/views";

import { stackedBars } from "../charts";

import { call } from "../transport";
import type { ProcedureFull, State, Template } from "../state";
import { badge, checkbox, empty, esc, field, html, link, pageTitle, raw, section, stat, table, type Safe } from "../ui";

import { periodOf, periodPicker, type Ctx, type View } from "./types";

const money = (cents: number) => (cents === 0 ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));
const payerOptions = PAYER_TYPES.map((p) => ({ value: p, label: PAYER_LABELS[p] }));
const categoryOptions = [{ value: "", label: "—" }, ...PROCEDURE_CATEGORIES.map((c) => ({ value: c, label: c }))];

export function nextCaseCode(state: State, year: number): string {
  const prefix = `DC-${year}-`;
  let max = 0;
  for (const code of [...state.procedures.map((p) => p.caseCode), ...state.plans.map((p) => p.caseCode)]) {
    if (code?.startsWith(prefix)) max = Math.max(max, Number(code.slice(prefix.length)) || 0);
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function firstScheduleStart(state: State, date: string): number {
  return state.schedule.find((b) => b.weekday === isoWeekday(date))?.startMinute ?? 9 * 60 + 30;
}

function lastSessionEnd(state: State, date: string): number | null {
  const same = state.sessions.filter((s) => s.date === date).sort((a, b) => a.endMinute - b.endMinute);
  return same.at(-1)?.endMinute ?? null;
}

// ---------------------------------------------------------------------------
// Registo rápido de procedimento
// ---------------------------------------------------------------------------

interface Draft {
  date: string;
  procedureType: string;
  category: string;
  start: string;
  end: string;
  billed: string;
  listPrice: string;
  payerType: string;
  payerName: string;
  caseCode: string;
  plannedVisits: string;
  labCost: string;
  otherCost: string;
  note: string;
  completed: boolean;
}

function draftFrom(p: ProcedureFull): Draft {
  return {
    date: p.date,
    procedureType: p.procedureType,
    category: p.category,
    start: p.sessions[0] ? formatTime(p.sessions[0].startMinute) : "",
    end: p.sessions[0] ? formatTime(p.sessions[0].endMinute) : "",
    billed: p.billedCents === 0 ? "0" : money(p.billedCents),
    listPrice: money(p.listPriceCents),
    payerType: p.payerType,
    payerName: p.payerName ?? "",
    caseCode: p.caseCode ?? "",
    plannedVisits: String(p.plannedVisits),
    labCost: money(p.labCostCents),
    otherCost: money(p.otherCostCents),
    note: p.note ?? "",
    completed: p.completed,
  };
}

function procedureFields(state: State, d: Draft, mode: "create" | "edit"): Safe {
  const types = [...new Set([...state.procedures.map((p) => p.procedureType), ...state.templates.map((t) => t.name)])].sort((a, b) => a.localeCompare(b, "pt"));
  const payers = [...new Set(state.procedures.flatMap((p) => (p.payerName ? [p.payerName] : [])))].sort();
  const cases = [...new Set(state.procedures.flatMap((p) => (p.caseCode ? [p.caseCode] : [])))].sort().reverse().slice(0, 200);
  return html`
    <div class="grid">
      ${field({ label: "Data", name: "date", type: "date", value: d.date, required: true })}
      ${field({ label: "Procedimento", name: "procedureType", value: d.procedureType, required: true, list: "dl-types", wide: true, hint: "Escreva ou escolha; os valores habituais preenchem-se sozinhos.", attrs: 'placeholder="ex.: Coroa cerâmica" data-type-input' })}
      ${field({ label: "Categoria", name: "category", value: d.category, required: true, options: categoryOptions })}
    </div>
    <datalist id="dl-types">${types.map((t) => html`<option value="${t}"></option>`)}</datalist>
    <p class="suggestion" data-suggestion role="status"></p>
    <div class="grid">
      ${mode === "create" ? field({ label: "Hora de início", name: "start", type: "time", value: d.start }) : ""}
      ${mode === "create" ? field({ label: "Hora de fim", name: "end", type: "time", value: d.end, hint: "Opcional; sem horas o €/h fica sem dados.", attrs: "data-end" }) : ""}
      ${mode === "create" ? html`<div class="field"><button type="button" class="btn small" data-clear-times>Sem horas</button><p class="hint-text">Limpa as horas (no iPhone não se consegue apagar uma hora). Para totais sem detalhe.</p></div>` : ""}
      ${field({ label: "Valor pago pelo paciente (€)", name: "billed", value: d.billed, required: true, inputmode: "decimal", attrs: 'placeholder="600"', hint: "O recebido acerta-se no fecho do mês." })}
      ${field({ label: "Valor tabelado (€)", name: "listPrice", value: d.listPrice, inputmode: "decimal", hint: "Vazio = igual ao faturado." })}
      ${field({ label: "Pagador", name: "payerType", value: d.payerType, options: payerOptions })}
      ${field({ label: "Seguradora / convenção", name: "payerName", value: d.payerName, list: "dl-payers" })}
      <div class="field">
        <label for="caseCode-in">Case ID (opcional)</label>
        <div class="inline"><input id="caseCode-in" name="caseCode" value="${d.caseCode}" list="dl-cases" autocomplete="off" placeholder="DC-2026-001" autocapitalize="characters" /><button type="button" class="btn" data-new-case aria-label="Gerar novo Case ID">Novo</button></div>
        <p class="err" data-err="caseCode" role="alert"></p><p class="hint-text">Agrupa consultas e atos do mesmo tratamento. Nunca nomes.</p>
      </div>
      ${field({ label: "Consultas necessárias", name: "plannedVisits", type: "number", value: d.plannedVisits, attrs: 'min="1" max="30"' })}
    </div>
    <datalist id="dl-payers">${payers.map((t) => html`<option value="${t}"></option>`)}</datalist>
    <datalist id="dl-cases">${cases.map((t) => html`<option value="${t}"></option>`)}</datalist>
    <details class="more" ${mode === "edit" ? raw("open") : ""}><summary>Custos, observação e estado</summary>
      <div class="grid">
        ${field({ label: "Custo de laboratório (€)", name: "labCost", value: d.labCost, inputmode: "decimal" })}
        ${field({ label: "Outros custos diretos (€)", name: "otherCost", value: d.otherCost, inputmode: "decimal" })}
        ${field({ label: "Observação operacional", name: "note", value: d.note, wide: true, hint: "Sem nomes, contactos ou dados clínicos.", attrs: 'maxlength="200"' })}
        ${checkbox("completed", "Procedimento concluído", d.completed)}
      </div>
    </details>`;
}

function mountProcedureForm(form: HTMLFormElement, ctx: Ctx, suggestions: readonly ProcedureSuggestion[], mode: "create" | "edit"): void {
  const { state } = ctx;
  const q = <T extends Element>(sel: string) => form.querySelector<T>(sel)!;
  const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  const set = (name: string, value: string) => {
    const el = input(name);
    if (el) el.value = value;
  };
  const note = q<HTMLElement>("[data-suggestion]");
  const syncPayer = () => {
    const payerName = input("payerName") as HTMLInputElement | null;
    if (payerName) payerName.disabled = input("payerType")?.value === "PRIVATE";
  };
  const endFor = (minutes: number | null) => {
    const start = input("start")?.value ?? "";
    if (minutes && isValidTime(start)) set("end", formatTime(Math.min(parseTime(start) + minutes, 23 * 60 + 59)));
  };
  const showDuration = () => {
    const hint = form.querySelector<HTMLElement>("[data-end]")?.closest(".field")?.querySelector(".hint-text");
    const s = input("start")?.value ?? "";
    const e = input("end")?.value ?? "";
    if (hint) hint.textContent = isValidTime(s) && isValidTime(e) && parseTime(e) > parseTime(s) ? `Duração: ${parseTime(e) - parseTime(s)} min` : "Opcional; sem horas o €/h fica sem dados.";
  };
  const applyTemplate = (t: Template) => {
    set("procedureType", t.name);
    set("category", t.category);
    set("billed", money(t.priceCents));
    set("listPrice", money(t.priceCents));
    set("payerType", t.payerType);
    set("plannedVisits", String(t.plannedVisits));
    set("labCost", money(t.labCostCents));
    endFor(t.durationMinutes);
    syncPayer();
    showDuration();
    note.textContent = `💡 Template "${t.name}": ${t.durationMinutes} min, ${euros(t.priceCents)}.`;
  };

  q<HTMLInputElement>("[data-type-input]").addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value.trim().toLowerCase();
    const s = suggestions.find((x) => x.procedureType.toLowerCase() === value);
    if (s) {
      set("category", s.category);
      set("billed", money(s.usualPriceCents));
      set("listPrice", money(s.usualListPriceCents));
      set("payerType", s.usualPayerType);
      set("payerName", s.usualPayerName ?? "");
      set("plannedVisits", String(s.usualVisits));
      set("labCost", money(s.usualLabCostCents));
      endFor(s.usualDurationMinutes);
      syncPayer();
      showDuration();
      note.textContent = `💡 Sugestão com base em ${s.count} registos: ${s.usualDurationMinutes ?? "?"} min, ${euros(s.usualPriceCents)}, ${PAYER_LABELS[s.usualPayerType as PayerType] ?? s.usualPayerType}${s.usualPayerName ? ` (${s.usualPayerName})` : ""}.`;
      return;
    }
    const t = state.templates.find((x) => x.name.toLowerCase() === value);
    if (t) applyTemplate(t);
  });
  form.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = state.templates.find((x) => x.id === b.dataset.template);
      if (t) applyTemplate(t);
    }),
  );
  form.querySelector<HTMLButtonElement>("[data-copy-last]")?.addEventListener("click", () => {
    const last = [...state.procedures].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
    if (!last) return;
    const d = draftFrom(last);
    for (const key of ["procedureType", "category", "billed", "listPrice", "payerType", "payerName", "plannedVisits", "labCost", "otherCost"] as const) set(key, d[key]);
    const minutes = isValidTime(d.start) && isValidTime(d.end) ? parseTime(d.end) - parseTime(d.start) : null;
    endFor(minutes);
    syncPayer();
    showDuration();
    note.textContent = "💡 Copiado do último procedimento (Case ID e observação limpos).";
  });
  q<HTMLButtonElement>("[data-new-case]").addEventListener("click", () => {
    const date = input("date")?.value ?? state.today;
    set("caseCode", nextCaseCode(state, Number(date.slice(0, 4)) || Number(state.today.slice(0, 4))));
  });
  input("payerType")?.addEventListener("change", syncPayer);
  input("start")?.addEventListener("change", showDuration);
  input("end")?.addEventListener("change", showDuration);
  form.querySelector<HTMLButtonElement>("[data-clear-times]")?.addEventListener("click", () => {
    set("start", "");
    set("end", "");
    showDuration();
  });
  syncPayer();

  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    button.disabled = true;
    const values = formValues(form);
    const id = form.dataset.id;
    const result = id ? await call("updateProcedure", id, values) : await call("createProcedure", values);
    button.disabled = false;
    showErrors(form, result.ok ? {} : result.errors);
    toast(result.message, result.ok);
    if (!result.ok || !result.data) return;
    applyData(result.data);
    if (mode === "edit") {
      ctx.rerender();
      return;
    }
    // Próximo registo: mesma data, começa onde este acabou.
    const nextStart = values.end || values.start || "";
    form.reset();
    set("date", values.date ?? state.today);
    set("start", nextStart);
    set("end", "");
    set("plannedVisits", "1");
    note.textContent = "";
    syncPayer();
    showDuration();
    q<HTMLInputElement>("[data-type-input]").focus();
  });
}

export function register(ctx: Ctx): View {
  const { state } = ctx;
  const date = isValidCivilDate(ctx.params.get("data") ?? "") ? ctx.params.get("data")! : state.today;
  const start = lastSessionEnd(state, date) ?? firstScheduleStart(state, date);
  const since = monthRange(addMonths(monthOf(date), -12)).from;
  const suggestions = buildSuggestions(state.procedures.filter((p) => p.date >= since));
  const draft: Draft = { date, procedureType: "", category: "", start: formatTime(start), end: "", billed: "", listPrice: "", payerType: "PRIVATE", payerName: "", caseCode: "", plannedVisits: "1", labCost: "", otherCost: "", note: "", completed: true };
  const body = html`
    ${pageTitle("Registar procedimento", "Uma receita por procedimento. Tratamentos em várias consultas: registe uma vez e acrescente as consultas na página do procedimento.")}
    <form class="card pad form" data-custom data-procedure-form aria-label="Registar procedimento">
      <div class="chips"><span class="muted">Favoritos:</span>${state.templates.filter((t) => t.favorite).map((t) => html`<button type="button" class="chip" data-template="${t.id}">★ ${t.name}</button>`)}<button type="button" class="chip ghost" data-copy-last>⧉ Copiar último</button></div>
      ${procedureFields(state, draft, "create")}
      <div class="form-actions"><button type="submit" class="btn primary">Gravar e novo</button><span class="muted small">⌘/Ctrl + Enter</span></div>
    </form>
    <p class="muted small">Exames (ortopantomografia, CBCT…)? ${link("/exames", "Registar exame")} — contam à parte dos procedimentos.</p>
    <p class="muted small">Privacidade: não registe nomes, números de utente, telefones ou dados clínicos identificáveis.</p>`;
  return {
    title: "Registar",
    body,
    mount: (root) => mountProcedureForm(root.querySelector("[data-procedure-form]")!, ctx, suggestions, "create"),
  };
}

// ---------------------------------------------------------------------------
// Lista e detalhe de procedimentos
// ---------------------------------------------------------------------------

export function procedures(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx);
  const fees = feeSettingsOf(state.profile);
  const lowest = state.goals.length ? Math.min(...state.goals.map((g) => g.centsPerHour)) : null;
  const rows = state.procedures
    .filter((p) => p.date >= period.from && p.date <= period.to)
    .map((p) => ({ p, m: procedureMetrics(p, fees, lowest) }))
    .reverse();
  const body = html`
    ${pageTitle("Procedimentos", `${period.label} · ${rows.length} procedimentos. €/h = faturado ÷ horas de cadeira de todas as consultas.`, periodPicker(period))}
    ${rows.length === 0
      ? empty("Sem procedimentos neste período.")
      : html`<ul class="list">${rows.map(
          ({ p, m }) => html`<li><a href="#/procedimento/${p.id}">
            <div class="row"><strong>${p.procedureType}</strong><strong>${euros(p.billedCents)}</strong></div>
            <div class="row muted small"><span>${formatCivilDate(p.date)}${p.caseCode ? ` · ${p.caseCode}` : ""} · ${PAYER_LABELS[p.payerType as PayerType] ?? p.payerType}${p.payerName ? ` (${p.payerName})` : ""}</span><span>${m.chairMinutes ? duration(m.chairMinutes) : "sem tempo"} · ${eurosPerHour(m.centsPerHour)}</span></div>
            ${m.lowProductivity || m.provisional ? html`<div>${m.lowProductivity ? badge("Baixa produtividade", "warn") : ""} ${m.provisional ? badge("Em curso") : ""}</div>` : ""}
          </a></li>`,
        )}</ul>`}`;
  return { title: "Procedimentos", body };
}

export function procedureDetail(ctx: Ctx): View {
  const { state } = ctx;
  const p = state.procedures.find((x) => x.id === ctx.segments[1]);
  if (!p) return { title: "Procedimento", body: html`${empty("Procedimento não encontrado.")} ${link("/procedimentos", "← Procedimentos")}` };
  const lowest = state.goals.length ? Math.min(...state.goals.map((g) => g.centsPerHour)) : null;
  const m = procedureMetrics(p, feeSettingsOf(state.profile), lowest);
  const last = p.sessions.at(-1);
  const since = monthRange(addMonths(monthOf(p.date), -12)).from;
  const suggestions = buildSuggestions(state.procedures.filter((x) => x.date >= since));
  const body = html`
    ${pageTitle(p.procedureType, `${p.category} · ${formatCivilDate(p.date)}${p.caseCode ? ` · ${p.caseCode}` : ""}`, html`<button class="btn danger" data-op="deleteProcedure" data-id="${p.id}" data-confirm="Apagar este procedimento e todas as suas consultas?" data-next="/procedimentos">Apagar</button>`)}
    <section class="cards">
      ${stat({ label: "Pago pelo paciente", value: euros(p.billedCents), sub: p.listPriceCents !== p.billedCents ? `tabela ${euros(p.listPriceCents)}` : null })}
      ${stat({ label: "Tempo de cadeira", value: m.chairMinutes ? duration(m.chairMinutes) : "sem dados", sub: `${m.sessionCount} de ${p.plannedVisits} consultas` })}
      ${stat({ label: "Produção por hora", value: eurosPerHour(m.centsPerHour), tone: m.lowProductivity ? "warn" : "neutral", delta: m.lowProductivity ? "abaixo do objetivo mínimo" : null, id: "proc-cph" })}
      ${stat({ label: "Produção líquida", value: euros(m.netCents), sub: "faturado − laboratório − outros" })}
      ${stat({ label: "Honorários", value: euros(m.feeCents) })}
      ${stat({ label: "Honorários por hora", value: eurosPerHour(m.feeCentsPerHour) })}
    </section>
    ${m.provisional || m.missingSessions > 0 ? html`<p class="muted">${badge("Em curso")} ${m.missingSessions > 0 ? `Faltam ${m.missingSessions} consulta(s) previstas. ` : ""}O €/h é provisório até estar concluído.</p>` : ""}
    ${section("Consultas deste procedimento", html`
      <ul class="card list">${p.sessions.length === 0 ? html`<li class="muted">Sem consultas registadas — o €/h fica sem dados.</li>` : ""}${p.sessions.map(
        (s, i) => html`<li class="row"><span><strong>Consulta ${i + 1}</strong> · ${formatCivilDate(s.date)} · ${formatTime(s.startMinute)}–${formatTime(s.endMinute)} <span class="muted">(${duration(s.endMinute - s.startMinute)})</span></span><button class="btn ghost small" data-op="deleteSession" data-id="${s.id}" data-confirm="Apagar esta consulta?">Remover</button></li>`,
      )}</ul>
      <form class="card pad form" data-op="addSession" data-id="${p.id}" aria-label="Adicionar consulta">
        <div class="grid">
          ${field({ label: "Data", name: "date", type: "date", value: state.today, required: true })}
          ${field({ label: "Início", name: "start", type: "time", value: last ? formatTime(last.startMinute) : "09:30", required: true })}
          ${field({ label: "Fim", name: "end", type: "time", value: last ? formatTime(last.startMinute + 45) : "10:15", required: true })}
        </div>
        <div class="form-actions"><button type="submit" class="btn primary">Adicionar consulta</button></div>
      </form>`, { desc: "A receita é uma só; o tempo de todas as consultas soma-se." })}
    ${section("Editar dados do procedimento", html`<form class="card pad form" data-custom data-procedure-form data-id="${p.id}" aria-label="Editar procedimento">${procedureFields(state, draftFrom(p), "edit")}<div class="form-actions"><button type="submit" class="btn primary">Gravar alterações</button></div></form>`)}
    ${link("/procedimentos", "← Procedimentos")}`;
  return { title: p.procedureType, body, mount: (root) => mountProcedureForm(root.querySelector("[data-procedure-form]")!, ctx, suggestions, "edit") };
}

// ---------------------------------------------------------------------------
// Dias clínicos
// ---------------------------------------------------------------------------

export function days(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx);
  const blocks = state.schedule.filter((b) => b.weekday === isoWeekday(state.today));
  const first = blocks[0];
  const lastBlock = blocks.at(-1);
  const scheduled = blocks.reduce((s, b) => s + b.endMinute - b.startMinute, 0);
  const span = first && lastBlock ? lastBlock.endMinute - first.startMinute : 0;
  const production = new Map<string, number>();
  for (const p of state.procedures) production.set(p.date, (production.get(p.date) ?? 0) + p.billedCents);
  const sessions = new Map<string, number>();
  for (const s of state.sessions) sessions.set(s.date, (sessions.get(s.date) ?? 0) + 1);
  const list = state.days.filter((d) => d.date >= period.from && d.date <= period.to).sort((a, b) => b.date.localeCompare(a.date));
  const worked = list.filter((d) => d.status === "WORKED");
  const totalMinutes = worked.reduce((s, d) => s + dayAvailableMinutes(d), 0);
  const totalProduction = worked.reduce((s, d) => s + (production.get(d.date) ?? 0), 0);

  const body = html`
    ${pageTitle("Dias clínicos", "Cada dia define as horas clínicas disponíveis.", periodPicker(period))}
    ${section("Registar dia clínico", html`<form class="card pad form" data-op="saveDay" aria-label="Registar dia clínico">
      <div class="grid">
        ${field({ label: "Data", name: "date", type: "date", value: state.today, required: true })}
        ${field({ label: "Hora de início", name: "start", type: "time", value: first ? formatTime(first.startMinute) : "09:30", required: true })}
        ${field({ label: "Hora de fim", name: "end", type: "time", value: lastBlock ? formatTime(lastBlock.endMinute) : "19:00", required: true })}
        ${field({ label: "Pausa (min)", name: "breakMinutes", type: "number", value: String(first ? span - scheduled : 120), attrs: 'min="0" max="600" step="5"' })}
        ${field({ label: "Estado", name: "status", value: "WORKED", options: [{ value: "WORKED", label: "Realizado" }, { value: "PLANNED", label: "Previsto" }] })}
      </div>
      <p class="muted small">Horas disponíveis = fim − início − pausa. Dias previstos só entram na projeção. Gravar uma data existente atualiza-a.</p>
      <div class="form-actions"><button type="submit" class="btn primary">Gravar dia</button></div>
    </form>`, { desc: `Horário de ${weekdayName(isoWeekday(state.today))} pré-preenchido.` })}
    ${section(`Dias · ${period.label}`, list.length === 0 ? empty("Sem dias registados neste período.") : html`<ul class="card list">${list.map((d) => {
      const minutes = dayAvailableMinutes(d);
      const prod = production.get(d.date) ?? 0;
      return html`<li><div class="row"><a href="#/agenda?data=${d.date}"><strong>${formatCivilDate(d.date)}</strong> <span class="muted">${weekdayName(isoWeekday(d.date))}</span></a>${d.status === "PLANNED" ? badge("Previsto") : html`<strong>${euros(prod, { round: true })}</strong>`}</div>
        <div class="row muted small"><span>${formatTime(d.startMinute)}–${formatTime(d.endMinute)} · pausa ${d.breakMinutes} min · ${hours(minutes)} · ${sessions.get(d.date) ?? 0} consultas</span><span>${d.status === "WORKED" && minutes ? eurosPerHour((prod * 60) / minutes) : ""} <button class="btn ghost small" data-op="deleteDay" data-id="${d.id}" data-confirm="Apagar este dia clínico? Os procedimentos mantêm-se.">Apagar</button></span></div></li>`;
    })}</ul>`, { desc: `${worked.length} dias realizados · ${hours(totalMinutes)} · ${euros(totalProduction, { round: true })} · ${eurosPerHour(totalMinutes ? (totalProduction * 60) / totalMinutes : null)}` })}`;
  return { title: "Dias clínicos", body };
}

// ---------------------------------------------------------------------------
// Agenda do dia
// ---------------------------------------------------------------------------

export function agenda(ctx: Ctx): View {
  const { state } = ctx;
  const date = isValidCivilDate(ctx.params.get("data") ?? "") ? ctx.params.get("data")! : state.today;
  const slot = SLOT_OPTIONS.find((s) => String(s) === ctx.params.get("slot")) ?? state.profile.standardSlotMinutes;
  const weekday = isoWeekday(date);
  const day = state.days.find((d) => d.date === date) ?? null;
  const scheduleBlocks = state.schedule.filter((b) => b.weekday === weekday);
  const blocks = scheduleBlocks.length ? scheduleBlocks : day ? [{ startMinute: day.startMinute, endMinute: day.endMinute }] : [];
  const daySessions = state.sessions.filter((s) => s.date === date);
  const dayAbsences = state.absences.filter((a) => a.date === date);
  const byId = new Map(state.procedures.map((p) => [p.id, p]));
  const events: AgendaEvent[] = [
    ...daySessions.map((s) => ({ kind: "session" as const, startMinute: s.startMinute, endMinute: s.endMinute, label: byId.get(s.procedureId)?.procedureType ?? "Consulta", detail: byId.get(s.procedureId)?.caseCode ?? undefined, href: `#/procedimento/${s.procedureId}` })),
    ...dayAbsences.map((a) => ({ kind: "absence" as const, startMinute: a.startMinute, endMinute: a.startMinute + a.durationMinutes, label: ABSENCE_LABELS[a.kind as AbsenceKind] ?? a.kind, detail: a.plannedProcedure ?? undefined })),
  ];
  const slots = fillSlots(buildSlots(blocks, slot), events);
  const eff = agendaEfficiency(day ? [day] : [], daySessions, dayAbsences);
  const production = state.procedures.filter((p) => p.date === date).reduce((s, p) => s + p.billedCents, 0);
  const available = day ? dayAvailableMinutes(day) : 0;
  const LABEL = { free: "Livre", worked: "Ocupado", absence: "Falta", mixed: "Falta + recuperado" } as const;

  const body = html`
    ${pageTitle(`Agenda · ${weekdayName(weekday)}, ${formatCivilDate(date)}`, "Slots a partir do horário; ocupação a partir das consultas e faltas registadas.")}
    <div class="toolbar">
      <a class="btn" href="#/agenda?data=${addDays(date, -1)}&slot=${slot}" aria-label="Dia anterior">←</a>
      <form class="period" data-agenda><input type="date" name="data" value="${date}" aria-label="Data" /><select name="slot" aria-label="Duração do slot">${SLOT_OPTIONS.map((s) => html`<option value="${s}" ${s === slot ? raw("selected") : ""}>${s} min</option>`)}</select></form>
      <a class="btn" href="#/agenda?data=${addDays(date, 1)}&slot=${slot}" aria-label="Dia seguinte">→</a>
      <a class="btn primary" href="#/registar?data=${date}">+ Procedimento</a>
    </div>
    <section class="cards">
      ${stat({ label: "Horas disponíveis", value: day ? hours(available) : "sem registo", sub: day ? `${formatTime(day.startMinute)}–${formatTime(day.endMinute)} · pausa ${day.breakMinutes} min` : "registe o dia clínico" })}
      ${stat({ label: "Horas trabalhadas", value: hours(eff.workedMinutes) })}
      ${stat({ label: "Perdidas por faltas", value: hours(eff.lostMinutes) })}
      ${stat({ label: "Ocupação teórica → real", value: `${percent(eff.theoreticalOccupancy, 0)} → ${percent(eff.realOccupancy, 0)}` })}
      ${stat({ label: "Produção do dia", value: euros(production, { round: true }) })}
      ${stat({ label: "€/hora do dia", value: eurosPerHour(available ? (production * 60) / available : null) })}
    </section>
    ${!day ? html`<p class="warn-text">⚠ Sem registo de dia clínico: as consultas não entram nas horas disponíveis. ${link("/dias", "Registar dia")}</p>` : ""}
    ${blocks.length === 0 ? empty("Sem horário para este dia.") : html`<ol class="slots" aria-label="Slots de ${slot} minutos">${slots.map(
      (s) => html`<li class="slot ${s.state}"><div class="row"><strong class="mono">${formatTime(s.startMinute)}</strong><span class="small">${LABEL[s.state]} · ${s.endMinute - s.startMinute} min</span></div>${s.events.map(
        (ev) => html`<p class="small ev">${ev.href ? html`<a href="${ev.href}">${ev.label}</a>` : ev.label} <span class="muted">· ${formatTime(ev.startMinute)}–${formatTime(ev.endMinute)}${ev.detail ? ` · ${ev.detail}` : ""}</span></p>`,
      )}</li>`,
    )}</ol>`}
    <p class="muted small">Compare slots de 30, 45, 60 ou 90 min para ver onde a agenda rígida de 45 min deixa tempo por usar.</p>`;
  return { title: "Agenda", body };
}

// ---------------------------------------------------------------------------
// Faltas
// ---------------------------------------------------------------------------

export function absences(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx);
  const summaries = monthlySeries(state.records, state.profile, period.month, 12);
  const current = summaries.at(-1)!;
  const a = current.absences;
  const summaryStats = html`<section class="cards">
    ${stat({ label: "Faltas + canc. tardios", value: String(a.missedCount), sub: `${a.earlyCancelCount} canc. antecipados` })}
    ${stat({ label: "Taxa de faltas", value: percent(a.missedRate), hint: "Faltas ÷ (consultas realizadas + faltas)." })}
    ${stat({ label: "Horas perdidas", value: hours(a.lostMinutes), hint: "Faltas cuja vaga não foi recuperada." })}
    ${stat({ label: "% da agenda perdida", value: percent(current.clinicalMinutes ? a.lostMinutes / current.clinicalMinutes : null) })}
    ${stat({ label: "Receita recuperada", value: euros(a.recoveredCents, { round: true }), sub: `${a.recoveredSlots} vagas pela lista de espera` })}
    ${stat({ label: "Receita líquida perdida", value: euros(a.netLostCents, { round: true }), sub: `potencial ${euros(a.grossLostCents, { round: true })}`, tone: "warn" })}
  </section>`;
  const chart = stackedBars(summaries.map((m) => ({ label: formatMonthShort(m.month), a: m.productionCents / 100, b: m.absences.netLostCents / 100 })), ["Produção real", "Perdida com faltas"]);
  const list = state.absences.filter((a) => a.date >= period.from && a.date <= period.to).sort((a, b) => b.date.localeCompare(a.date) || b.startMinute - a.startMinute);
  const types = [...new Set(state.procedures.map((p) => p.procedureType))].sort((a, b) => a.localeCompare(b, "pt"));
  const body = html`
    ${pageTitle("Faltas e cancelamentos", "Faltas e cancelamentos tardios contam como perda; os antecipados ficam à parte.", periodPicker(period))}
    ${summaryStats}
    ${section("Produção real vs potencial sem faltas", html`<div class="card pad">${chart}</div>`, { desc: "Últimos 12 meses." })}
    ${section("Registar falta ou cancelamento", html`<form class="card pad form" data-op="createAbsence" aria-label="Registar falta">
      <div class="grid">
        ${field({ label: "Data", name: "date", type: "date", value: state.today, required: true })}
        ${field({ label: "Hora", name: "start", type: "time", value: "09:30", required: true })}
        ${field({ label: "Duração prevista (min)", name: "durationMinutes", type: "number", value: "45", attrs: 'min="5" max="480" step="5"' })}
        ${field({ label: "Tipo", name: "kind", value: "NO_SHOW", options: ABSENCE_KINDS.map((k) => ({ value: k, label: ABSENCE_LABELS[k] })) })}
        ${field({ label: "Procedimento previsto", name: "plannedProcedure", list: "dl-abs-types" })}
        ${field({ label: "Valor estimado (€)", name: "estimatedValue", inputmode: "decimal" })}
        ${field({ label: "Pagador", name: "payerType", value: "PRIVATE", options: payerOptions })}
        ${checkbox("slotRecovered", "Slot recuperado por outro paciente", false)}
        ${field({ label: "Receita recuperada (€)", name: "recoveredValue", inputmode: "decimal", hint: "Só se o slot foi ocupado." })}
      </div>
      <datalist id="dl-abs-types">${types.map((t) => html`<option value="${t}"></option>`)}</datalist>
      <div class="form-actions"><button type="submit" class="btn primary">Registar falta</button></div>
    </form>`)}
    ${section(`Registos · ${period.label}`, list.length === 0 ? empty("Sem faltas neste período.") : table(list, [
      { head: "Data", cell: (a) => `${formatCivilDate(a.date)} ${formatTime(a.startMinute)}` },
      { head: "Tipo", cell: (a) => ABSENCE_LABELS[a.kind as AbsenceKind] ?? a.kind },
      { head: "Previsto", cell: (a) => a.plannedProcedure ?? "—" },
      { head: "Duração", cell: (a) => duration(a.durationMinutes), num: true },
      { head: "Valor", cell: (a) => euros(a.estimatedValueCents), num: true },
      { head: "Recuperado", cell: (a) => (a.slotRecovered ? `Sim · ${euros(a.recoveredValueCents)}` : "Não") },
      { head: "", cell: (a) => html`<button class="btn ghost small" data-op="deleteAbsence" data-id="${a.id}" data-confirm="Apagar esta falta?">Apagar</button>` },
    ], "Faltas registadas"))}`;
  return { title: "Faltas", body };
}

// ---------------------------------------------------------------------------
// Utilitários de formulário partilhados com main.ts
// ---------------------------------------------------------------------------

/** Valores de um formulário (checkboxes desmarcadas não aparecem, como num POST). */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  new FormData(form).forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}

export function showErrors(form: HTMLFormElement, errors: Record<string, string>): void {
  form.querySelectorAll<HTMLElement>("[data-err]").forEach((el) => {
    el.textContent = errors[el.dataset.err ?? ""] ?? "";
    el.closest(".field")?.querySelector("input,select")?.setAttribute("aria-invalid", errors[el.dataset.err ?? ""] ? "true" : "false");
  });
  const general = errors._form;
  if (general) toast(general, false);
}

let applyDataHook: (data: import("../../server/api").AppData) => void = () => undefined;
let toastHook: (message: string, ok: boolean) => void = () => undefined;

export function registerHooks(apply: typeof applyDataHook, t: typeof toastHook): void {
  applyDataHook = apply;
  toastHook = t;
}
export function applyData(data: import("../../server/api").AppData): void {
  applyDataHook(data);
}
export function toast(message: string, ok: boolean): void {
  if (message) toastHook(message, ok);
}

export { esc };
