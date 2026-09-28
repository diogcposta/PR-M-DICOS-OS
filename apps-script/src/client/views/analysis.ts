import { applyClosings } from "@/modules/production/domain/closing";
import { PAYER_LABELS, type PayerType } from "@/modules/production/domain/constants";
import { EMPTY, duration, euros, eurosPerHour, formatNumber, hours, percent } from "@/modules/production/domain/format";
import { sortMatrix, topAndBottom, type MatrixSort, type ProfitabilityRow } from "@/modules/production/domain/metrics";
import type { MonthlySummary } from "@/modules/production/domain/monthly";
import { ladder, simulate } from "@/modules/production/domain/simulator";
import { formatMonthLong, formatMonthShort } from "@/modules/production/domain/time";
import { compareLast, movingAverage } from "@/modules/production/domain/trends";
import { dashboardView, monthlySeries, profitabilityView } from "@/modules/production/domain/views";

import { fmt, hbars, lineChart, type Kind } from "../charts";
import { badge, empty, html, link, pageTitle, raw, section, stat, table, type Safe } from "../ui";

import { insightList } from "./dashboard";
import { periodOf, periodPicker, type Ctx, type View } from "./types";

// ---------------------------------------------------------------------------
// Rentabilidade
// ---------------------------------------------------------------------------

const SORTS: Array<{ key: MatrixSort; label: string }> = [
  { key: "cph_desc", label: "Maior €/h" },
  { key: "cph_asc", label: "Menor €/h" },
  { key: "revenue_desc", label: "Maior faturação" },
  { key: "cases_desc", label: "Mais casos" },
];

function topList(title: string, rows: readonly ProfitabilityRow[]): Safe {
  return html`<div class="card pad"><h3>${title}</h3><ol class="rank">${rows.map((r) => html`<li><span>${r.key}</span><strong>${eurosPerHour(r.centsPerHour)}</strong></li>`)}</ol></div>`;
}

export function profitability(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx, "3m");
  const procedures = state.procedures.filter((p) => p.date >= period.from && p.date <= period.to);
  const d = profitabilityView(procedures, state.profile, state.goals);
  const sort = (SORTS.find((s) => s.key === ctx.params.get("ordem"))?.key ?? "cph_desc") as MatrixSort;
  const { top, bottom } = topAndBottom(d.byType, 5);
  const lowCases = d.cases.cases.filter((c) => c.highValueLowProductivity);
  const base = `/rentabilidade?mes=${period.month}&periodo=${period.key}`;
  const matrix = sortMatrix(d.byType, sort);

  const body = html`
    ${pageTitle("Rentabilidade por procedimento", `${period.label}. €/h = receita ÷ horas de cadeira. Descreve números — a indicação clínica decide sempre.`, periodPicker(period))}
    ${procedures.length === 0 ? empty("Sem procedimentos neste período.") : html`
      <section class="cards">
        ${stat({ label: "€/h médio de cadeira", value: eurosPerHour(d.overallChairCph) })}
        ${stat({ label: "Receita", value: euros(d.byType.reduce((s, r) => s + r.revenueCents, 0), { round: true }) })}
        ${stat({ label: "Horas de cadeira", value: hours(d.byType.reduce((s, r) => s + r.chairMinutes, 0)) })}
        ${stat({ label: "Custos diretos", value: euros(d.byType.reduce((s, r) => s + r.costsCents, 0), { round: true }) })}
      </section>
      <div class="two">${topList("Top 5 mais produtivos (€/h)", top)}${topList("Top 5 menos produtivos (€/h)", bottom)}</div>
      ${section("Matriz de rentabilidade", html`
        <div class="chips" role="group" aria-label="Ordenar">${SORTS.map((s) => html`<a class="chip${s.key === sort ? " on" : ""}" href="#${base}&ordem=${s.key}">${s.label}</a>`)}</div>
        ${table(matrix, [
          { head: "Procedimento", cell: (r) => html`<strong>${r.key}</strong><br /><span class="muted small">${r.category}${r.untimedCases ? ` · ${r.untimedCases} sem tempo` : ""}</span>` },
          { head: "Casos", cell: (r) => r.cases, num: true },
          { head: "Receita", cell: (r) => euros(r.revenueCents, { round: true }), num: true },
          { head: "Tempo", cell: (r) => (r.chairMinutes ? hours(r.chairMinutes) : EMPTY), num: true },
          { head: "€/hora", cell: (r) => html`<strong>${eurosPerHour(r.centsPerHour)}</strong>${r.centsPerHour !== null && d.lowestGoalCph !== null && r.centsPerHour < d.lowestGoalCph ? html`<br />${badge("abaixo do objetivo", "warn")}` : ""}`, num: true },
          { head: "Honorários/h", cell: (r) => eurosPerHour(r.feeCentsPerHour), num: true },
          { head: "Custos", cell: (r) => (r.costsCents ? euros(r.costsCents, { round: true }) : "—"), num: true },
          { head: "Margem", cell: (r) => `${euros(r.marginCents, { round: true })} (${percent(r.marginShare, 0)})`, num: true },
        ], "Matriz de rentabilidade")}`, { desc: "Toque para ordenar. Atos sem horas contam na receita mas não no €/h." })}
      ${section("€/h por categoria", html`<div class="card pad">${hbars(d.byCategory.filter((r) => r.centsPerHour !== null).sort((a, b) => (b.centsPerHour ?? 0) - (a.centsPerHour ?? 0)).map((r) => ({ label: r.key, value: (r.centsPerHour ?? 0) / 100 })), "eurosPerHour", d.overallChairCph === null ? null : d.overallChairCph / 100)}</div>`)}
      ${section("Casos com vários procedimentos e consultas", html`
        ${lowCases.length ? html`<p class="notice">${lowCases.length} ${lowCases.length === 1 ? "caso" : "casos"} de valor elevado com produtividade relativamente baixa. Ex.: <strong>${lowCases[0]!.caseCode}</strong> — ${euros(lowCases[0]!.billedCents)} em ${duration(lowCases[0]!.chairMinutes)} = ${eurosPerHour(lowCases[0]!.centsPerHour)}${lowCases[0]!.weakestProcedure ? ` (${lowCases[0]!.weakestProcedure.type}: ${eurosPerHour(lowCases[0]!.weakestProcedure.centsPerHour)})` : ""}.</p>` : ""}
        ${table(d.cases.cases.slice(0, 30), [
          { head: "Case ID", cell: (c) => html`<span class="mono">${c.caseCode}</span>` },
          { head: "Procedimentos", cell: (c) => c.procedureTypes.join(" + ") },
          { head: "Consultas", cell: (c) => c.sessionCount, num: true },
          { head: "Valor", cell: (c) => euros(c.billedCents), num: true },
          { head: "Tempo", cell: (c) => (c.chairMinutes ? duration(c.chairMinutes) : "—"), num: true },
          { head: "€/h", cell: (c) => html`<strong>${eurosPerHour(c.centsPerHour)}</strong>`, num: true },
          { head: "", cell: (c) => html`${c.highValueLowProductivity ? badge("valor elevado, €/h baixo", "warn") : ""}${!c.completed ? badge("em curso") : ""}` },
        ], "Casos")}`, { desc: `Receita total ÷ tempo total do Case ID. Referência dos casos ≥ €500: ${eurosPerHour(d.cases.highValueReferenceCph)}.` })}
    `}`;
  return { title: "Rentabilidade", body };
}

// ---------------------------------------------------------------------------
// Seguros
// ---------------------------------------------------------------------------

export function insurance(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx, "3m");
  const d = profitabilityView(state.procedures.filter((p) => p.date >= period.from && p.date <= period.to), state.profile, state.goals);
  const months = period.key === "mes" ? 1 : Number(period.key.replace("m", ""));
  const body = html`
    ${pageTitle("Particular vs seguros", `${period.label}. O mesmo procedimento, pagadores diferentes, no mesmo tempo de cadeira.`, periodPicker(period))}
    <section class="cards">
      ${stat({ label: "Produção com seguros/convenções", value: euros(d.agreement.thirdPartyRevenueCents, { round: true }), sub: `${percent(d.agreement.thirdPartyShare, 0)} da produção` })}
      ${stat({ label: "Horas em seguros", value: hours(d.agreement.thirdPartyMinutes) })}
      ${stat({ label: "Desconto face à tabela", value: euros(d.agreement.discountCents, { round: true }), sub: `≈ ${euros(Math.round(d.agreement.discountCents / months), { round: true })}/mês` })}
      ${stat({ label: "Impacto no tempo (mensal)", value: euros(Math.round(d.agreement.timeValueGapCents / months), { round: true }), tone: "warn", hint: "O que as mesmas horas renderiam ao €/h particular do mesmo procedimento, menos o que renderam." })}
    </section>
    ${section("Por seguradora / convenção", d.insurers.length === 0 ? empty("Sem atos com seguro neste período.") : table(d.insurers, [
      { head: "Pagador", cell: (i) => html`<strong>${i.payerName}</strong><br /><span class="muted small">${PAYER_LABELS[i.payerType as PayerType]}</span>` },
      { head: "Casos", cell: (i) => i.cases, num: true },
      { head: "Receita", cell: (i) => euros(i.revenueCents, { round: true }), num: true },
      { head: "€/h", cell: (i) => html`<strong>${eurosPerHour(i.centsPerHour)}</strong>`, num: true },
      { head: "€/h particular equiv.", cell: (i) => eurosPerHour(i.privateEquivalentCph), num: true },
      { head: "Diferença", cell: (i) => (i.diffShare === null ? EMPTY : badge(`${i.diffShare > 0 ? "+" : ""}${percent(i.diffShare, 0)}`, i.diffShare <= -0.3 ? "crit" : i.diffShare <= -0.15 ? "warn" : "neutral")), num: true },
      { head: "Desconto", cell: (i) => euros(i.discountCents, { round: true }), num: true },
    ], "Seguradoras"), { desc: "Comparado com o €/h particular da mesma mistura de procedimentos." })}
    ${section("Por procedimento", d.payer.length === 0 ? empty("Sem procedimentos comparáveis.") : table(d.payer, [
      { head: "Procedimento", cell: (r) => html`<strong>${r.procedureType}</strong>` },
      { head: "Preço part. / seg.", cell: (r) => `${euros(r.privateAvgPriceCents === null ? null : Math.round(r.privateAvgPriceCents), { round: true })} / ${euros(r.thirdPartyAvgPriceCents === null ? null : Math.round(r.thirdPartyAvgPriceCents), { round: true })}`, num: true },
      { head: "€/h part.", cell: (r) => eurosPerHour(r.privateCph), num: true },
      { head: "€/h seguro", cell: (r) => eurosPerHour(r.thirdPartyCph), num: true },
      { head: "Diferença", cell: (r) => (r.diffCph === null ? EMPTY : `${eurosPerHour(r.diffCph)} (${percent(r.diffShare, 0)})`), num: true },
    ], "Particular vs seguro"))}`;
  return { title: "Seguros", body };
}

// ---------------------------------------------------------------------------
// Tendências
// ---------------------------------------------------------------------------

/** `history`: também nos meses só com fecho (histórico); `closing`: só existe onde há fecho. */
const METRICS: Array<{ name: string; kind: Kind; better: boolean; get: (s: MonthlySummary) => number | null; history?: boolean; closing?: boolean }> = [
  { name: "Produção", kind: "euros", better: true, get: (s) => s.productionCents / 100, history: true },
  { name: "Honorários", kind: "euros", better: true, get: (s) => s.feeCents / 100, history: true },
  { name: "€/hora", kind: "eurosPerHour", better: true, get: (s) => (s.centsPerHour === null ? null : s.centsPerHour / 100), history: true },
  { name: "Horas trabalhadas", kind: "hours", better: true, get: (s) => s.clinicalMinutes / 60, history: true },
  { name: "Produção por dia", kind: "euros", better: true, get: (s) => (s.productionPerDayCents === null ? null : s.productionPerDayCents / 100) },
  { name: "Faltas", kind: "count", better: false, get: (s) => s.absences.missedCount },
  { name: "Receita perdida", kind: "euros", better: false, get: (s) => s.absences.netLostCents / 100 },
  { name: "Planos apresentados", kind: "count", better: true, get: (s) => s.plans.presentedCount },
  { name: "Taxa de aceitação", kind: "percent", better: true, get: (s) => s.plans.acceptanceRateByValue },
  { name: "Valor médio por caso", kind: "euros", better: true, get: (s) => (s.avgCaseValueCents === null ? null : s.avgCaseValueCents / 100) },
];

export function trends(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx);
  const recorded = monthlySeries(state.records, state.profile, period.month, 12);
  // Meses do histórico (só com fecho) contam para produção, honorários, €/h e horas.
  const summaries = applyClosings(recorded, state.closings);
  const received = new Map(state.closings.map((c) => [c.month, c.receivedCents / 100]));
  const metrics: typeof METRICS = [
    ...METRICS.slice(0, 2),
    { name: "Recebido (folha de honorários)", kind: "euros", better: true, get: (s) => received.get(s.month) ?? null, closing: true },
    ...METRICS.slice(2),
  ];
  const labels = summaries.map((s) => formatMonthShort(s.month));
  const body = html`
    ${pageTitle("Tendências", `12 meses até ${formatMonthLong(period.month)}. Mês vs anterior e média móvel de 3 meses.`, periodPicker(period, false))}
    <div class="grid-cards">${metrics.map((m) => {
      const values = summaries.map((s) => (m.closing || s.workedDays > 0 || s.procedureCount > 0 || (s.fromClosing && m.history) ? m.get(s) : null));
      const avg = movingAverage(values);
      const c = compareLast(values);
      const good = c.change === null ? null : c.change > 0 === m.better;
      return html`<section class="card pad" aria-label="${m.name}">
        <div class="row"><span class="label">${m.name}</span>${c.change !== null ? html`<span class="delta ${good ? "good" : "crit"}">${c.change > 0 ? "▲ +" : "▼ "}${percent(c.change, 0)}</span>` : ""}</div>
        <p class="value">${fmt(c.current, m.kind)}</p>
        <p class="muted small">anterior ${fmt(c.previous, m.kind)} · média 3m ${fmt(c.movingAverage, m.kind)}</p>
        ${lineChart(labels.map((label, i) => ({ label, value: values[i] ?? null, avg: avg[i] ?? null })), m.kind, m.name)}
      </section>`;
    })}</div>`;
  return { title: "Tendências", body };
}

// ---------------------------------------------------------------------------
// Simulador e cenários
// ---------------------------------------------------------------------------

export function simulator(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx);
  const summaries = monthlySeries(state.records, state.profile, period.month, 3);
  const current = summaries.at(-1)!;
  const presented = summaries.reduce((s, m) => s + m.plans.presentedCount, 0);
  const presentedCents = summaries.reduce((s, m) => s + m.plans.presentedCents, 0);
  const acceptedCents = summaries.reduce((s, m) => s + m.plans.acceptedCents, 0);
  const baseline = Math.round((current.absences.missedRate ?? 0) * 1000) / 1000;
  const actual = state.scenarios.find((s) => s.centsPerHour === null);
  const init = {
    hours: actual?.hoursPerMonth ?? 146,
    cph: Math.round((current.centsPerHour ?? state.profile.primaryGoalCentsPerHour) / 100),
    fee: state.profile.feeBps / 100,
    noShow: Math.round(baseline * 1000) / 10,
    acceptance: Math.round((presentedCents ? acceptedCents / presentedCents : 0.5) * 100),
    avgPlan: presented ? Math.round(presentedCents / presented / 100) : 1000,
    plans: Math.round(presented / summaries.length),
    months: 11,
  };
  const inputs: Array<[keyof typeof init, string, number, number, number, string]> = [
    ["hours", "Horas clínicas / mês", 0, 250, 0.5, "h"],
    ["cph", "Produção por hora", 0, 300, 1, "€/h"],
    ["fee", "Percentagem recebida", 0, 100, 1, "%"],
    ["noShow", "Taxa de faltas", 0, 50, 0.5, "%"],
    ["acceptance", "Taxa de aceitação", 0, 100, 1, "%"],
    ["avgPlan", "Valor médio dos planos", 0, 10000, 10, "€"],
    ["plans", "Planos / mês", 0, 100, 1, ""],
    ["months", "Meses de trabalho / ano", 1, 12, 0.5, "meses"],
  ];
  const body = html`
    ${pageTitle("What if?", "Altere os parâmetros e veja o impacto imediato. Ponto de partida: mês mais recente (planos: média de 3 meses).")}
    <div class="two">
      <form class="card pad sim" data-sim>${inputs.map(
        ([key, label, min, max, step, unit]) => html`<div class="sim-row"><label for="sim-${key}">${label} <span class="muted">${unit}</span></label>
          <div class="inline"><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${init[key]}" aria-label="${label}" /><input id="sim-${key}" type="number" inputmode="decimal" data-num="${key}" min="${min}" max="${max}" step="${step}" value="${init[key]}" /></div></div>`,
      )}</form>
      <div><div class="cards two-col" aria-live="polite" data-sim-out></div>
        <details class="card pad"><summary>Como é calculado</summary><ul class="muted small">
          <li>Produção = horas × €/h × (1 − faltas) ÷ (1 − faltas atuais ${formatNumber(baseline * 100, 1)}%).</li>
          <li>Honorários = produção × %. Anual = mensal × meses de trabalho.</li>
          <li>Valor aceite/mês = planos × valor médio × aceitação — à parte, não somado à produção (usaria as mesmas horas).</li>
        </ul></details>
      </div>
    </div>
    <div class="two">
      <div class="card pad"><h3>Mesmas horas, outros €/h</h3><div data-ladder></div></div>
      <div class="card pad" data-testid="scenarios"><h3>Cenários</h3><div data-scenarios></div><p class="muted small">Editar em ${link("/definicoes", "Definições")}.</p></div>
    </div>`;

  const mount = (root: HTMLElement) => {
    const form = root.querySelector<HTMLFormElement>("[data-sim]")!;
    const values = { ...init };
    const update = () => {
      const feeBps = Math.round(values.fee * 100);
      const input = {
        hoursPerMonth: values.hours,
        centsPerHour: values.cph * 100,
        feeBps,
        baselineNoShowRate: baseline,
        noShowRate: values.noShow / 100,
        acceptanceRate: values.acceptance / 100,
        avgPlanCents: values.avgPlan * 100,
        plansPerMonth: values.plans,
        workingMonths: values.months,
      };
      const r = simulate(input);
      const b = simulate({ ...input, hoursPerMonth: init.hours, centsPerHour: init.cph * 100, feeBps: state.profile.feeBps, noShowRate: baseline, workingMonths: init.months });
      const diff = r.monthlyProductionCents - b.monthlyProductionCents;
      root.querySelector("[data-sim-out]")!.innerHTML = html`
        ${stat({ label: "Produção mensal", value: euros(r.monthlyProductionCents, { round: true }), big: true, id: "sim-monthly" })}
        ${stat({ label: "Honorários mensais", value: euros(r.monthlyFeeCents, { round: true }), big: true, id: "sim-fee" })}
        ${stat({ label: "Produção anual", value: euros(r.annualProductionCents, { round: true }) })}
        ${stat({ label: "Honorários anuais", value: euros(r.annualFeeCents, { round: true }) })}
        ${stat({ label: "€/h efetivo", value: eurosPerHour(r.effectiveCentsPerHour) })}
        ${stat({ label: "Valor aceite / mês", value: euros(r.monthlyAcceptedPlanCents, { round: true }), sub: `${diff >= 0 ? "+" : ""}${euros(diff, { round: true })}/mês face ao atual` })}`.html;
      root.querySelector("[data-ladder]")!.innerHTML = table(
        ladder(values.hours, [values.cph * 100, ...state.goals.map((g) => g.centsPerHour)], feeBps).map((row, i) => ({ ...row, label: i === 0 ? "Simulado" : state.goals[i - 1]!.label })),
        [
          { head: "€/h", cell: (row) => `${row.label} · ${eurosPerHour(row.centsPerHour)}` },
          { head: "Produção", cell: (row) => euros(row.productionCents, { round: true }), num: true },
          { head: "Honorários", cell: (row) => euros(row.feeCents, { round: true }), num: true },
        ],
        "Tabela de €/h",
      ).html;
      root.querySelector("[data-scenarios]")!.innerHTML = table(
        state.scenarios.map((s) => {
          const c = s.centsPerHour ?? current.centsPerHour ?? 0;
          return { s, c, r: simulate({ ...input, hoursPerMonth: s.hoursPerMonth, centsPerHour: c, noShowRate: baseline }) };
        }),
        [
          { head: "Cenário", cell: (x) => html`<strong>${x.s.name}</strong>${x.s.centsPerHour === null ? html`<br /><span class="muted small">€/h medido</span>` : ""}` },
          { head: "€/h", cell: (x) => eurosPerHour(x.c), num: true },
          { head: "Horas", cell: (x) => formatNumber(x.s.hoursPerMonth, 1), num: true },
          { head: "Produção/mês", cell: (x) => euros(x.r.monthlyProductionCents, { round: true }), num: true },
          { head: "Honorários/ano", cell: (x) => euros(x.r.annualFeeCents, { round: true }), num: true },
        ],
        "Cenários",
      ).html;
    };
    form.addEventListener("input", (e) => {
      const el = e.target as HTMLInputElement;
      const key = (el.dataset.range ?? el.dataset.num) as keyof typeof init | undefined;
      if (!key) return;
      const v = Number(el.value.replace(",", "."));
      values[key] = Number.isFinite(v) ? v : 0;
      const other = form.querySelector<HTMLInputElement>(el.dataset.range ? `[data-num="${key}"]` : `[data-range="${key}"]`);
      if (other) other.value = String(values[key]);
      update();
    });
    update();
  };
  return { title: "What if?", body, mount };
}

// ---------------------------------------------------------------------------
// Relatório mensal
// ---------------------------------------------------------------------------

function rows(pairs: Array<[string, string]>): Safe {
  return html`<dl class="dl">${pairs.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
}

export function report(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx);
  const d = dashboardView(state.records, state.profile, state.goals, period.month, state.today);
  const p = profitabilityView(state.procedures.filter((x) => x.date >= `${period.month}-01` && x.date <= period.to), state.profile, state.goals);
  const c = d.current;
  const { top, bottom } = topAndBottom(p.byType, 3);
  const body = html`
    ${pageTitle(`Relatório · ${formatMonthLong(d.month)}`, `${state.profile.name}. Indicadores operacionais e económicos — não medem qualidade clínica.`, html`${periodPicker(period, false)}<button class="btn no-print" data-print>⎙ Imprimir / PDF</button>`)}
    <div class="grid-cards">
      <div class="card pad"><h3>Resumo</h3>${rows([["Produção", euros(c.productionCents)], [`Honorários (${percent(state.profile.feeBps / 10_000, 0)})`, euros(c.feeCents)], ["Horas clínicas", hours(c.clinicalMinutes)], ["€/hora", eurosPerHour(c.centsPerHour, 2)], ["€/dia", euros(c.productionPerDayCents === null ? null : Math.round(c.productionPerDayCents))], ["Efficiency Score", d.score.score === null ? EMPTY : `${d.score.score}/100`]])}</div>
      <div class="card pad"><h3>Agenda</h3>${rows([["Ocupação teórica", percent(c.agenda.theoreticalOccupancy)], ["Ocupação real", percent(c.agenda.realOccupancy)], ["Horas vazias", hours(c.agenda.emptyMinutes)], ["Faltas", `${c.absences.missedCount} (${percent(c.absences.missedRate)})`], ["Horas perdidas", hours(c.absences.lostMinutes)], ["Receita perdida", euros(c.absences.netLostCents)]])}</div>
      <div class="card pad"><h3>Planos</h3>${rows([["Apresentados", `${c.plans.presentedCount} · ${euros(c.plans.presentedCents, { round: true })}`], ["Aceites", `${c.plans.acceptedCount} · ${euros(c.plans.acceptedCents, { round: true })}`], ["Aceitação", percent(c.plans.acceptanceRateByValue)], ["Pendentes", euros(c.plans.pendingTreatmentCents, { round: true })], ["Follow-up", `${d.followUps.length} planos`]])}</div>
      <div class="card pad"><h3>Mais rentáveis</h3>${rows(top.map((r) => [r.key, eurosPerHour(r.centsPerHour)]))}</div>
      <div class="card pad"><h3>Menos rentáveis</h3>${rows(bottom.map((r) => [r.key, eurosPerHour(r.centsPerHour)]))}</div>
      <div class="card pad"><h3>Seguros</h3>${rows([["Produção com seguros", `${euros(p.agreement.thirdPartyRevenueCents, { round: true })} (${percent(p.agreement.thirdPartyShare, 0)})`], ["Desconto face à tabela", euros(p.agreement.discountCents, { round: true })], ...p.insurers.map((i): [string, string] => [i.payerName, `${eurosPerHour(i.centsPerHour)} (${i.diffShare === null ? EMPTY : percent(i.diffShare, 0)})`])])}</div>
    </div>
    ${section("As três ações com maior impacto potencial", html`<ol class="card actions-list">${d.actions.length ? "" : html`<li class="muted">${EMPTY}</li>`}${d.actions.map((a, i) => html`<li><span class="num">${i + 1}</span><div><p><strong>${a.title}</strong> <span class="muted">≈ ${euros(a.impactCents, { round: true })}</span></p><p class="muted">${a.detail}</p></div></li>`)}</ol>`)}
    ${section("Insights", html`<div class="card pad">${insightList(d.insights)}</div>`)}
    <p class="muted small">A decisão clínica pertence sempre ao médico e baseia-se na indicação clínica.</p>`;
  return {
    title: "Relatório",
    body,
    mount: (root) => root.querySelector("[data-print]")?.addEventListener("click", () => window.print()),
  };
}

export { raw };
