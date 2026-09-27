import { PLAN_STATUSES, PLAN_STATUS_LABELS, PROCEDURE_CATEGORIES, type PlanStatus } from "@/modules/production/domain/constants";
import { euros, formatNumber, percent } from "@/modules/production/domain/format";
import { summarisePlans } from "@/modules/production/domain/monthly";
import { formatCivilDate, formatTime } from "@/modules/production/domain/time";
import { plansView } from "@/modules/production/domain/views";

import type { PlanFull, State } from "../state";
import { badge, checkbox, empty, field, html, link, pageTitle, raw, section, stat, table, type Safe } from "../ui";

import { funnelBlock } from "./dashboard";
import { nextCaseCode } from "./records";
import { periodOf, periodPicker, type Ctx, type View } from "./types";

const money = (cents: number) => (cents === 0 ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));
const statusOptions = PLAN_STATUSES.map((s) => ({ value: s, label: PLAN_STATUS_LABELS[s] }));

function planForm(plan: Partial<PlanFull> & { caseCode: string; presentedDate: string }, op: string, id: string | null, submit: string): Safe {
  return html`<form class="card pad form" data-op="${op}" ${id ? raw(`data-id="${id}"`) : ""} data-reset aria-label="Plano de tratamento">
    <div class="grid">
      ${field({ label: "Case ID", name: "caseCode", value: plan.caseCode, required: true, attrs: 'autocapitalize="characters"' })}
      ${field({ label: "Data de apresentação", name: "presentedDate", type: "date", value: plan.presentedDate, required: true })}
      ${field({ label: "Estado", name: "status", value: plan.status ?? "PRESENTED", options: statusOptions })}
      ${field({ label: "Número de fases", name: "phases", type: "number", value: String(plan.phases ?? 1), attrs: 'min="1" max="20"' })}
      ${field({ label: "Valor total (€)", name: "total", value: money(plan.totalCents ?? 0), required: true, inputmode: "decimal" })}
      ${field({ label: "Valor diagnosticado (€)", name: "diagnosed", value: money(plan.diagnosedCents ?? 0), inputmode: "decimal", hint: "Vazio = igual ao total." })}
      ${field({ label: "Valor aceite (€)", name: "accepted", value: money(plan.acceptedCents ?? 0), inputmode: "decimal" })}
      ${field({ label: "Valor realizado (€)", name: "performed", value: money(plan.performedCents ?? 0), inputmode: "decimal" })}
      ${field({ label: "Último contacto", name: "lastContactDate", type: "date", value: plan.lastContactDate ?? "" })}
      ${field({ label: "Observação", name: "note", value: plan.note ?? "", wide: true, hint: "Sem nomes nem contactos.", attrs: 'maxlength="200"' })}
      ${checkbox("nextAppointmentBooked", "Próxima consulta marcada", plan.nextAppointmentBooked ?? false)}
    </div>
    <div class="form-actions"><button type="submit" class="btn primary">${submit}</button></div>
  </form>`;
}

export function plans(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx, "3m");
  const v = plansView(state.plans, state.profile, period.from, period.to, state.today);
  const summary = summarisePlans(v.inRange);
  const followValue = v.followUps.reduce((s, f) => s + f.openCents, 0);
  const inRange = (v.inRange as PlanFull[]).slice().sort((a, b) => b.presentedDate.localeCompare(a.presentedDate));
  const pr = state.profile;
  const body = html`
    ${pageTitle("Planos de tratamento", `${period.label}. A aplicação indica o que seguir — não envia mensagens a pacientes.`, periodPicker(period))}
    <section class="cards">
      ${stat({ label: "Apresentados", value: String(summary.presentedCount), sub: euros(summary.presentedCents, { round: true }) })}
      ${stat({ label: "Aceites", value: String(summary.acceptedCount), sub: euros(summary.acceptedCents, { round: true }) })}
      ${stat({ label: "Aceitação (valor)", value: percent(summary.acceptanceRateByValue), sub: `por número ${percent(summary.acceptanceRateByCount, 0)}` })}
      ${stat({ label: "Pendente de realizar", value: euros(summary.pendingTreatmentCents, { round: true }) })}
      ${stat({ label: "Não avançou", value: euros(summary.notAdvancedCents, { round: true }), tone: "warn" })}
      ${stat({ label: "Follow-up necessário", value: String(v.followUps.length), sub: euros(followValue, { round: true }), tone: v.followUps.length ? "warn" : "neutral" })}
    </section>
    <div class="two">
      ${section("Follow-up", v.followUps.length === 0 ? empty("Nada a seguir.") : html`<ul class="card list" data-testid="follow-up-list">${v.followUps.map(
        (f) => html`<li><div class="row"><span>${link(`/plano/${f.planId}`, html`<span class="mono">${f.caseCode}</span>`)} <strong>${euros(f.openCents, { round: true })}</strong> ${f.priority === "PRIORITY" ? badge("Prioritário", "crit") : ""} ${f.alertLevel === 2 ? badge("2.º alerta", "crit") : f.alertLevel === 1 ? badge("Alerta", "warn") : ""}</span><button class="btn small" data-op="markPlanContacted" data-id="${f.planId}">Contactado hoje</button></div>
          <p class="muted small">${PLAN_STATUS_LABELS[f.status as PlanStatus]} · ${f.reasons.join(" · ")}</p></li>`,
      )}</ul>`, { id: "follow-up", desc: `Plano > ${euros(pr.followUpMinCents)} sem próxima consulta; > ${euros(pr.followUpPriorityCents)} prioritário; sem resposta há ${pr.followUpFirstAlertDays} e ${pr.followUpSecondAlertDays} dias.` })}
      ${section("Funil de tratamento", html`<div class="card pad" aria-label="Funil de tratamento">${funnelBlock(v.funnel)}</div>`)}
    </div>
    ${section("Apresentados que não avançaram", v.notAdvanced.length === 0 ? empty("Nenhum.") : html`<div class="chips">${v.notAdvanced.map((p) => html`<a class="chip" href="#/plano/${p.id}"><span class="mono">${p.caseCode}</span> ${euros(p.totalCents - p.acceptedCents, { round: true })} <span class="muted">${PLAN_STATUS_LABELS[p.status as PlanStatus]}</span></a>`)}</div>`)}
    ${section("Registar plano", planForm({ caseCode: nextCaseCode(state, Number(state.today.slice(0, 4))), presentedDate: state.today }, "createPlan", null, "Gravar plano"))}
    ${section(`Planos · ${period.label}`, inRange.length === 0 ? empty("Sem planos neste período.") : table(inRange, [
      { head: "Case ID", cell: (p) => link(`/plano/${p.id}`, html`<span class="mono">${p.caseCode}</span>`) },
      { head: "Data", cell: (p) => formatCivilDate(p.presentedDate) },
      { head: "Estado", cell: (p) => PLAN_STATUS_LABELS[p.status as PlanStatus] ?? p.status },
      { head: "Total", cell: (p) => euros(p.totalCents, { round: true }), num: true },
      { head: "Aceite", cell: (p) => euros(p.acceptedCents, { round: true }), num: true },
      { head: "Por realizar", cell: (p) => euros(Math.max(0, p.acceptedCents - p.performedCents), { round: true }), num: true },
      { head: "Próx. consulta", cell: (p) => (p.nextAppointmentBooked ? "Sim" : "Não") },
    ], "Planos"))}`;
  return { title: "Planos", body };
}

export function planDetail(ctx: Ctx): View {
  const plan = ctx.state.plans.find((p) => p.id === ctx.segments[1]);
  if (!plan) return { title: "Plano", body: html`${empty("Plano não encontrado.")} ${link("/planos", "← Planos")}` };
  const body = html`
    ${pageTitle(`Plano ${plan.caseCode}`, undefined, html`<button class="btn danger" data-op="deletePlan" data-id="${plan.id}" data-confirm="Apagar este plano?" data-next="/planos">Apagar</button>`)}
    ${planForm(plan, "updatePlan", plan.id, "Gravar alterações")}
    ${link("/planos", "← Planos")}`;
  return { title: "Plano", body };
}

// ---------------------------------------------------------------------------
// Definições
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const bps = (v: number) => money(v) || "0";

export function settings(ctx: Ctx): View {
  const { state } = ctx;
  const p = state.profile;
  const sched = new Map<string, string>();
  const perDay = new Map<number, number>();
  for (const b of state.schedule) {
    const i = perDay.get(b.weekday) ?? 0;
    perDay.set(b.weekday, i + 1);
    if (i > 1) continue;
    sched.set(`s_${b.weekday}_${i}_start`, formatTime(b.startMinute));
    sched.set(`s_${b.weekday}_${i}_end`, formatTime(b.endMinute));
  }
  const goals = [...state.goals, ...Array.from({ length: Math.max(0, 6 - state.goals.length) }, () => ({ label: "", centsPerHour: 0 }))];
  const scenarios = [...state.scenarios, ...Array.from({ length: Math.max(0, 4 - state.scenarios.length) }, () => ({ id: "", name: "", centsPerHour: null, hoursPerMonth: 0 }))];
  const body = html`
    ${pageTitle("Definições", "Todos os parâmetros são editáveis. Valores iniciais: 50%, segunda a sexta 09:30–12:30 e 14:30–19:00, consulta de 45 min.")}
    <form class="card pad form" data-op="saveSettings" aria-label="Definições">
      <h3>Perfil do médico</h3>
      <div class="grid">
        ${field({ label: "Nome", name: "name", value: p.name, required: true })}
        ${field({ label: "Percentagem recebida (%)", name: "feePercent", value: bps(p.feeBps), inputmode: "decimal" })}
        ${field({ label: "Base dos honorários", name: "feeBase", value: p.feeBase, options: [{ value: "BILLED", label: "Valor faturado × %" }, { value: "NET", label: "(Faturado − custos diretos) × %" }] })}
        ${field({ label: "Consulta standard (min)", name: "standardSlotMinutes", type: "number", value: String(p.standardSlotMinutes) })}
        ${field({ label: "Sábados ocasionais (min)", name: "saturdayMinutes", type: "number", value: String(p.saturdayMinutes) })}
        ${field({ label: "Objetivo principal (€/h)", name: "primaryGoal", value: money(p.primaryGoalCentsPerHour), inputmode: "decimal" })}
        ${field({ label: "Taxa de faltas de referência (%)", name: "targetNoShowPercent", value: bps(p.targetNoShowBps), inputmode: "decimal" })}
      </div>
      <h3>Horário habitual</h3>
      <p class="muted small">Até dois períodos por dia; vazio nos dias sem consulta.</p>
      <div class="schedule">${WEEKDAYS.map((name, i) => {
        const d = i + 1;
        return html`<div class="sched-row"><span>${name}</span>${[0, 1].map((k) => html`<input type="time" name="s_${d}_${k}_start" value="${sched.get(`s_${d}_${k}_start`) ?? ""}" aria-label="${name} período ${k + 1} início" /><input type="time" name="s_${d}_${k}_end" value="${sched.get(`s_${d}_${k}_end`) ?? ""}" aria-label="${name} período ${k + 1} fim" />`)}</div>`;
      })}</div>
      <h3>Objetivos (€/hora)</h3>
      <div class="pairs">${goals.map((g, i) => html`<div class="inline"><input name="g_${i}_label" value="${g.label}" placeholder="Nome" aria-label="Objetivo ${i + 1} nome" /><input name="g_${i}_value" value="${g.centsPerHour ? money(g.centsPerHour) : ""}" placeholder="€/h" inputmode="decimal" aria-label="Objetivo ${i + 1} €/h" /></div>`)}</div>
      <h3>Cenários</h3>
      <p class="muted small">€/h vazio = usar o €/h medido.</p>
      <div class="pairs">${scenarios.map((c, i) => html`<div class="inline"><input name="c_${i}_name" value="${c.name}" placeholder="Nome" aria-label="Cenário ${i + 1} nome" /><input name="c_${i}_value" value="${c.centsPerHour === null ? "" : money(c.centsPerHour)}" placeholder="€/h" inputmode="decimal" aria-label="Cenário ${i + 1} €/h" /><input name="c_${i}_hours" value="${c.hoursPerMonth ? formatNumber(c.hoursPerMonth, 1) : ""}" placeholder="h/mês" inputmode="decimal" aria-label="Cenário ${i + 1} horas/mês" /></div>`)}</div>
      <h3>Follow-up</h3>
      <div class="grid">
        ${field({ label: "Follow-up acima de (€)", name: "followUpMin", value: money(p.followUpMinCents), inputmode: "decimal" })}
        ${field({ label: "Prioritário acima de (€)", name: "followUpPriority", value: money(p.followUpPriorityCents), inputmode: "decimal" })}
        ${field({ label: "1.º alerta (dias)", name: "followUpFirstAlertDays", type: "number", value: String(p.followUpFirstAlertDays) })}
        ${field({ label: "2.º alerta (dias)", name: "followUpSecondAlertDays", type: "number", value: String(p.followUpSecondAlertDays) })}
      </div>
      <div class="form-actions"><button type="submit" class="btn primary">Gravar definições</button></div>
    </form>
    ${section("Templates e favoritos", html`
      <ul class="card list">${state.templates.map((t) => html`<li class="row"><span><button class="star" data-op="toggleFavorite" data-id="${t.id}" aria-label="${t.favorite ? "Remover dos favoritos" : "Marcar como favorito"}">${t.favorite ? "★" : "☆"}</button> <strong>${t.name}</strong> <span class="muted small">· ${t.category} · ${euros(t.priceCents)} · ${t.durationMinutes} min</span></span><button class="btn ghost small" data-op="deleteTemplate" data-id="${t.id}" data-confirm="Apagar este template?">Apagar</button></li>`)}</ul>
      <form class="card pad form" data-op="saveTemplate" data-reset aria-label="Novo template">
        <div class="grid">
          ${field({ label: "Nome", name: "name", required: true })}
          ${field({ label: "Categoria", name: "category", value: "Dentisteria", options: PROCEDURE_CATEGORIES.map((c) => ({ value: c, label: c })) })}
          ${field({ label: "Preço (€)", name: "price", required: true, inputmode: "decimal" })}
          ${field({ label: "Duração (min)", name: "durationMinutes", type: "number", value: "45" })}
          ${field({ label: "Consultas", name: "plannedVisits", type: "number", value: "1" })}
          ${field({ label: "Laboratório (€)", name: "labCost", inputmode: "decimal" })}
          ${checkbox("favorite", "Favorito", false)}
        </div>
        <div class="form-actions"><button type="submit" class="btn primary">Gravar template</button></div>
      </form>`, { id: "templates" })}
    ${section("Exames", html`
      ${state.examTypes.length === 0 ? empty("Sem tipos de exame.") : html`<ul class="card list">${state.examTypes.map((t) => html`<li class="row"><span><strong>${t.name}</strong> <span class="muted small">· ${t.priceCents > 0 ? euros(t.priceCents) : "sem valor habitual"}</span></span><button class="btn ghost small" data-op="deleteExamType" data-id="${t.id}" data-confirm="Apagar este tipo de exame? Os exames já registados mantêm-se.">Apagar</button></li>`)}</ul>`}
      <form class="card pad form" data-op="saveExamType" data-reset aria-label="Tipo de exame">
        <div class="grid">
          ${field({ label: "Exame", name: "name", required: true, hint: "Um nome que já exista atualiza o valor." })}
          ${field({ label: "Valor habitual (€)", name: "price", inputmode: "decimal" })}
        </div>
        <div class="form-actions"><button type="submit" class="btn primary">Gravar exame</button></div>
      </form>`, { id: "exames", desc: `Recebe ${percent(p.feeBps / 10_000, 0)} do valor de cada exame (a mesma percentagem dos atos). Os exames não entram na produção clínica nem no €/hora.` })}`;
  return { title: "Definições", body };
}

// ---------------------------------------------------------------------------
// Dados: exportação CSV e demonstração
// ---------------------------------------------------------------------------

function csv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    const guarded = /^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };
  return `﻿${[headers.join(";"), ...rows.map((r) => r.map(cell).join(";"))].join("\r\n")}\r\n`;
}

const ptDate = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/** Mesmo formato de CSV da app Next (Importar/Exportar), para poder migrar entre as duas. */
export function exportCsv(state: State, entity: string): string {
  switch (entity) {
    case "dias":
      return csv(["data", "inicio", "fim", "pausa_min", "estado", "nota"], state.days.map((d) => [ptDate(d.date), formatTime(d.startMinute), formatTime(d.endMinute), d.breakMinutes, d.status, d.note]));
    case "procedimentos":
      return csv(
        ["id", "data", "case_id", "procedimento", "categoria", "valor_tabelado", "valor_faturado", "pagador", "seguradora", "consultas_previstas", "custo_laboratorio", "outros_custos", "concluido", "observacao", "consultas"],
        state.procedures.map((p) => [p.id, ptDate(p.date), p.caseCode, p.procedureType, p.category, eur(p.listPriceCents), eur(p.billedCents), p.payerType, p.payerName, p.plannedVisits, eur(p.labCostCents), eur(p.otherCostCents), p.completed ? "sim" : "não", p.note, p.sessions.map((s) => `${ptDate(s.date)} ${formatTime(s.startMinute)}-${formatTime(s.endMinute)}`).join("|")]),
      );
    case "exames":
      return csv(["id", "data", "exame", "case_id", "valor", "observacao"], state.exams.map((x) => [x.id, ptDate(x.date), x.examType, x.caseCode, eur(x.billedCents), x.note]));
    case "faltas":
      return csv(["id", "data", "hora", "duracao_min", "procedimento_previsto", "valor_estimado", "pagador", "tipo", "slot_recuperado", "receita_recuperada"], state.absences.map((a) => [a.id, ptDate(a.date), formatTime(a.startMinute), a.durationMinutes, a.plannedProcedure, eur(a.estimatedValueCents), a.payerType, a.kind, a.slotRecovered ? "sim" : "não", eur(a.recoveredValueCents)]));
    default:
      return csv(
        ["id", "case_id", "data_apresentacao", "valor_diagnosticado", "valor_total", "fases", "estado", "valor_aceite", "valor_realizado", "ultimo_contacto", "proxima_consulta_marcada", "observacao"],
        state.plans.map((p) => [p.id, p.caseCode, ptDate(p.presentedDate), eur(p.diagnosedCents), eur(p.totalCents), p.phases, p.status, eur(p.acceptedCents), eur(p.performedCents), ptDate(p.lastContactDate), p.nextAppointmentBooked ? "sim" : "não", p.note]),
      );
  }
}

export function data(ctx: Ctx): View {
  const { state } = ctx;
  const body = html`
    ${pageTitle("Dados", "Os dados vivem numa folha Google Sheets da sua conta — pode abri-la, copiá-la ou fazer cópia de segurança a qualquer momento.")}
    ${section("Exportar CSV", html`<div class="card pad chips">${[
      ["dias", "Dias clínicos"],
      ["procedimentos", "Procedimentos"],
      ["faltas", "Faltas"],
      ["planos", "Planos"],
      ["exames", "Exames"],
    ].map(([k, l]) => html`<button class="btn" data-export="${k}">⤓ ${l}</button>`)}</div>`, { desc: "Formato do Excel português (;, dd/mm/aaaa). Compatível com a importação da versão local." })}
    ${section("Folha Google Sheets", html`<div class="card pad"><p class="muted">Os dados estão numa folha da sua conta Google. Pode abri-la para consultar, filtrar ou descarregar (Ficheiro › Transferir › CSV). Não altere os cabeçalhos.</p><a class="btn" href="${state.raw.spreadsheetUrl}" target="_blank" rel="noopener">Abrir a folha ↗</a></div>`)}
    ${section("Demonstração", html`<div class="card pad">
      <p class="muted">Carrega dados sintéticos (setembro de 2026: €8.619 em 130,5 h). <strong>Substitui</strong> os registos atuais; as definições mantêm-se.</p>
      <div class="chips"><button class="btn" data-op="loadDemo" data-confirm="Substituir todos os registos pelos dados de demonstração?">Carregar demonstração</button>
      <button class="btn danger" data-op="clearRecords" data-confirm="Apagar TODOS os registos (dias, procedimentos, faltas, planos, exames)? As definições mantêm-se.">Apagar todos os registos</button></div>
    </div>`)}
    <p class="muted small">${state.procedures.length} procedimentos · ${state.sessions.length} consultas · ${state.days.length} dias · ${state.absences.length} faltas · ${state.plans.length} planos · ${state.exams.length} exames.</p>`;
  const mount = (root: HTMLElement) =>
    root.querySelectorAll<HTMLButtonElement>("[data-export]").forEach((b) =>
      b.addEventListener("click", () => {
        const blob = new Blob([exportCsv(state, b.dataset.export!)], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `producao-${b.dataset.export}-${state.today}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }),
    );
  return { title: "Dados", body, mount };
}

export function more(): View {
  const items: Array<[string, string, string]> = [
    ["/procedimentos", "Procedimentos", "Lista, €/h e consultas de cada ato"],
    ["/dias", "Dias clínicos", "Horas disponíveis por dia"],
    ["/faltas", "Faltas", "Horas e receita perdidas"],
    ["/exames", "Exames", "Ortopantomografia, CBCT… e honorários"],
    ["/rentabilidade", "Rentabilidade", "Matriz, top 5, casos complexos"],
    ["/seguros", "Particular vs seguros", "Impacto das convenções"],
    ["/simulador", "What if?", "Simulador e cenários"],
    ["/tendencias", "Tendências", "12 meses e média móvel"],
    ["/relatorio", "Relatório mensal", "Resumo e 3 ações"],
    ["/definicoes", "Definições", "Perfil, horário, objetivos, templates, exames"],
    ["/dados", "Dados", "Exportar CSV e demonstração"],
  ];
  return {
    title: "Mais",
    body: html`${pageTitle("Mais")}<ul class="card list menu">${items.map(([r, t, d]) => html`<li><a href="#${r}"><strong>${t}</strong><span class="muted small">${d}</span></a></li>`)}</ul>`,
  };
}
