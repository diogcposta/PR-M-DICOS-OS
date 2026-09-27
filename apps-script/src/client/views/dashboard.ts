import { relativeChange } from "@/modules/kpis/domain/ratio";
import { examTotals } from "@/modules/production/domain/exams";
import { EMPTY, euros, eurosPerHour, formatNumber, hours, integer, percent } from "@/modules/production/domain/format";
import type { Funnel } from "@/modules/production/domain/plans";
import type { Insight } from "@/modules/production/domain/insights";
import type { ScoreResult } from "@/modules/production/domain/score";
import { addMonths, formatMonthLong, formatMonthShort, monthRange } from "@/modules/production/domain/time";
import { dashboardView } from "@/modules/production/domain/views";

import { stackedBars } from "../charts";
import { badge, html, link, meter, pageTitle, section, stat, type Safe, type StatOptions, type Tone } from "../ui";

import { periodOf, periodPicker, type Ctx, type View } from "./types";

function delta(current: number | null, previous: number | null | undefined, higherIsBetter = true): Pick<StatOptions, "delta" | "tone" | "direction"> {
  if (current === null || previous === null || previous === undefined) return {};
  const change = relativeChange(current, previous);
  if (change === null) return {};
  const up = change > 0;
  return {
    delta: `${up ? "+" : ""}${percent(change, 0)} vs mês anterior`,
    tone: Math.abs(change) < 0.005 ? "neutral" : up === higherIsBetter ? "good" : "crit",
    direction: up ? "up" : "down",
  };
}

export function funnelBlock(funnel: Funnel): Safe {
  if (funnel.stages.every((s) => s.count === 0)) return html`<p class="empty">Sem planos no período.</p>`;
  const max = Math.max(1, ...funnel.stages.map((s) => s.cents));
  return html`<ol class="funnel">${funnel.stages.map((s, i) => {
    const biggest = funnel.biggestLossStage === s.key;
    return html`<li>
      <div class="row"><span>${i ? "↓ " : ""}${s.label}</span><span><strong>${euros(s.cents, { round: true })}</strong> · ${s.count} ${s.count === 1 ? "caso" : "casos"}</span></div>
      <div class="track"><div class="${biggest ? "loss" : ""}" style="width:${((s.cents / max) * 100).toFixed(1)}%"></div></div>
      ${i ? html`<p class="hint-text">${s.conversionFromPrevious === null ? EMPTY : `${percent(s.conversionFromPrevious, 0)} do passo anterior`}${s.lossFromPreviousCents > 0 ? ` · perda de ${euros(s.lossFromPreviousCents, { round: true })}` : ""} ${biggest ? badge("Maior perda", "warn") : ""}</p>` : ""}
    </li>`;
  })}</ol>`;
}

const INSIGHT_TONE: Record<Insight["tone"], Tone> = { positive: "good", neutral: "neutral", attention: "warn" };

export function insightList(insights: readonly Insight[]): Safe {
  if (!insights.length) return html`<p class="empty">Ainda não há dados suficientes para gerar insights.</p>`;
  return html`<ul class="insights" data-testid="insights">${insights.map(
    (i) => html`<li>${badge(i.tone === "positive" ? "Evolução" : i.tone === "attention" ? "Atenção" : "Info", INSIGHT_TONE[i.tone])}<span>${i.text}</span></li>`,
  )}</ul>`;
}

export function scoreBlock(score: ScoreResult): Safe {
  return html`<div class="card pad" data-testid="score">
    <div class="row"><div><p class="label">Clinical Efficiency Score</p><p class="value xl">${score.score === null ? EMPTY : String(score.score)}${score.score !== null ? html`<small> / 100</small>` : ""}</p></div>${badge("Operacional")}</div>
    <p class="notice">Indicador exclusivamente operacional/económico. <strong>Não mede qualidade clínica</strong> nem substitui o juízo clínico.</p>
    <ul class="score-list">${score.components.map(
      (c) => html`<li><div class="row small"><span>${c.label} <span class="muted">(${c.weight}%)</span></span><span>${c.value === null ? "sem dados — excluído" : String(Math.round(c.value * 100))}</span></div>${meter(c.value, c.label)}</li>`,
    )}</ul>
  </div>`;
}

export function dashboard(ctx: Ctx): View {
  const { state } = ctx;
  const period = periodOf(ctx);
  const d = dashboardView(state.records, state.profile, state.goals, period.month, state.today);
  const c = d.current;
  const p = d.previous;
  const monthLabel = formatMonthLong(d.month);
  const hasData = c.procedureCount > 0 || c.workedDays > 0;
  const fee = state.profile.feeBps;
  const monthExams = (m: string) => {
    const r = monthRange(m);
    return examTotals(state.exams, r.from, r.to, fee);
  };
  const ex = monthExams(d.month);
  const exPrev = monthExams(addMonths(d.month, -1));

  const cards: StatOptions[] = [
    { label: "Produção do mês", value: euros(c.productionCents, { round: true }), ...delta(c.productionCents, p?.productionCents), big: true, id: "card-production", hint: "Soma do valor faturado dos procedimentos com data no mês." },
    { label: `Honorários (${percent(fee / 10_000, 0)})`, value: euros(c.feeCents), ...delta(c.feeCents, p?.feeCents), big: true, id: "card-fees", hint: "Produção × percentagem médica." },
    { label: "Exames", value: euros(ex.feeCents), ...delta(ex.feeCents, exPrev.count ? exPrev.feeCents : null), sub: `${ex.count} ${ex.count === 1 ? "exame" : "exames"} · ${euros(ex.billedCents, { round: true })}`, id: "card-exams", hint: `Honorários dos exames (${percent(fee / 10_000, 0)} do valor). Não entram na produção nem no €/hora.` },
    { label: "Total a receber", value: euros(c.feeCents + ex.feeCents), sub: "honorários dos atos + exames", id: "card-total-fees" },
    { label: "Horas clínicas", value: hours(c.clinicalMinutes), sub: `${c.workedDays} dias${c.plannedDays ? ` · +${c.plannedDays} previstos` : ""}`, id: "card-hours", hint: "Σ (fim − início − pausa) dos dias realizados." },
    { label: "Produção por hora", value: eurosPerHour(c.centsPerHour), ...delta(c.centsPerHour, p?.centsPerHour), id: "card-cph", hint: "Produção ÷ horas clínicas." },
    { label: "Produção por dia", value: euros(c.productionPerDayCents === null ? null : Math.round(c.productionPerDayCents), { round: true }), ...delta(c.productionPerDayCents, p?.productionPerDayCents) },
    { label: "Atos realizados", value: integer(c.procedureCount) },
    { label: "Agendamentos", value: integer(c.appointmentCount), sub: "consultas realizadas" },
    { label: "Faltas", value: integer(c.absences.missedCount), sub: `${c.absences.noShowCount} faltas · ${c.absences.lateCancelCount} canc. tardios` },
    { label: "Taxa de faltas", value: percent(c.absences.missedRate), ...delta(c.absences.missedRate, p?.absences.missedRate, false), hint: "Faltas ÷ (consultas realizadas + faltas)." },
    { label: "Receita perdida (faltas)", value: euros(c.absences.netLostCents, { round: true }), sub: `bruta ${euros(c.absences.grossLostCents, { round: true })} · recuperada ${euros(c.absences.recoveredCents, { round: true })}` },
    { label: "Planos apresentados", value: integer(c.plans.presentedCount) },
    { label: "Valor apresentado", value: euros(c.plans.presentedCents, { round: true }) },
    { label: "Planos aceites", value: integer(c.plans.acceptedCount), sub: euros(c.plans.acceptedCents, { round: true }) },
    { label: "Taxa de aceitação", value: percent(c.plans.acceptanceRateByValue), sub: `por número: ${percent(c.plans.acceptanceRateByCount, 0)}`, hint: "Valor aceite ÷ valor apresentado." },
    { label: "Tratamentos pendentes", value: euros(c.plans.pendingTreatmentCents, { round: true }), sub: "aceite e por realizar" },
  ];

  const max = Math.max(c.centsPerHour ?? 0, ...d.goals.map((g) => g.centsPerHour)) * 1.05 || 1;
  const goals = html`<div class="card pad" data-testid="goals">
    <div class="goals">
      <div>
        <p class="label">Produção atual</p>
        <p class="value hero" data-testid="current-cph">${eurosPerHour(c.centsPerHour)}</p>
        <p class="muted">com ${formatNumber(c.clinicalMinutes / 60, 1)} h clínicas no mês</p>
        ${d.gap
          ? html`<div class="gap" data-testid="goal-gap"><p class="label">Próximo objetivo · ${d.gap.nextGoal.label}</p>
              <p>${eurosPerHour(c.centsPerHour)} → <strong>${eurosPerHour(d.gap.nextGoal.centsPerHour)}</strong></p>
              <p class="value">+${eurosPerHour(d.gap.diffCentsPerHour)} <small>+${percent(d.gap.diffShare)}</small></p></div>`
          : c.centsPerHour !== null ? badge("Todos os objetivos atingidos", "good") : ""}
      </div>
      <div>
        <p class="muted">Se mantiver as mesmas horas clínicas:</p>
        ${d.goals.map(
          (g) => html`<div class="goal">
            <div class="row small"><strong>${g.label} · ${eurosPerHour(g.centsPerHour)}</strong>${g.reached ? badge("atingido", "good") : ""}</div>
            <div class="track"><div style="width:${((g.centsPerHour / max) * 100).toFixed(1)}%"></div>${c.centsPerHour !== null ? html`<span class="now" style="left:${((c.centsPerHour / max) * 100).toFixed(1)}%" title="Atual"></span>` : ""}</div>
            <div class="goal-nums"><span>Produção <b>${euros(g.projectedProductionCents, { round: true })}</b></span><span>Honorários <b>${euros(g.projectedFeeCents, { round: true })}</b></span><span>Diferença <b>${g.extraProductionCents === null ? EMPTY : `${g.extraProductionCents > 0 ? "+" : ""}${euros(g.extraProductionCents, { round: true })}`}</b></span></div>
          </div>`,
        )}
      </div>
    </div>
  </div>`;

  const agenda = html`<div class="card pad metrics">
    ${[
      ["Horas disponíveis", hours(c.agenda.availableMinutes)],
      ["Horas marcadas", hours(c.agenda.bookedMinutes)],
      ["Horas trabalhadas", hours(c.agenda.workedMinutes)],
      ["Perdidas por faltas", hours(c.agenda.lostMinutes)],
      ["Horas vazias", hours(c.agenda.emptyMinutes)],
      ["Ocupação teórica → real", `${percent(c.agenda.theoreticalOccupancy, 0)} → ${percent(c.agenda.realOccupancy, 0)}`],
    ].map(([l, v]) => html`<div><p class="label">${l}</p><p class="value sm">${v}</p></div>`)}
  </div>`;

  const actions = html`<ol class="card actions-list" data-testid="actions">${d.actions.length === 0 ? html`<li class="muted">${EMPTY}</li>` : ""}${d.actions.map(
    (a, i) => html`<li><span class="num">${i + 1}</span><div><p><strong>${a.title}</strong> <span class="muted">≈ ${euros(a.impactCents, { round: true })} potencial</span></p><p class="muted">${a.detail}</p></div></li>`,
  )}</ol>
  ${d.followUps.length ? html`<p>${badge(`${d.followUps.length} planos para follow-up`, "warn")} ${link("/planos", "Ver lista")}</p>` : ""}`;

  const body = html`
    ${pageTitle("Clinical Production Dashboard", `${state.profile.name} · ${monthLabel}`, html`${periodPicker(period, false)}<a class="btn primary" href="#/registar">+ Registar</a>`)}
    ${!hasData ? html`<div class="card pad">Sem registos em ${monthLabel}. ${link("/dias", "Registe um dia clínico")} e depois os procedimentos — ou carregue a demonstração em ${link("/dados", "Dados")}.</div>` : ""}
    <section class="cards" aria-label="Indicadores do mês">${cards.map(stat)}</section>
    ${c.projectedProductionCents !== null && c.plannedDays > 0 ? html`<p class="muted" data-testid="projection">Projeção para o fim do mês (${c.plannedDays} ${c.plannedDays === 1 ? "dia previsto" : "dias previstos"}): <strong>${euros(c.projectedProductionCents, { round: true })}</strong> de produção · ${euros(Math.round((c.projectedProductionCents * fee) / 10_000), { round: true })} de honorários.</p>` : ""}
    ${section("Produção atual vs objetivos", goals, { desc: "Com as mesmas horas clínicas do mês: só muda a produção por hora." })}
    <div class="two">
      ${section("Insights automáticos", html`<div class="card pad">${insightList(d.insights)}</div>`, { desc: "Regras sobre os teus dados — sem IA e sem recomendações clínicas." })}
      ${section("Eficiência operacional", scoreBlock(d.score))}
    </div>
    <div class="two">
      ${section("Produção real vs potencial sem faltas", html`<div class="card pad">${stackedBars(d.summaries.map((s) => ({ label: formatMonthShort(s.month), a: s.productionCents / 100, b: s.absences.netLostCents / 100 })), ["Produção real", "Perdida com faltas"])}</div>`, { desc: "Últimos 6 meses." })}
      ${section("Funil de tratamento", html`<div class="card pad">${funnelBlock(d.funnel)}</div>`, { desc: `Planos apresentados em ${monthLabel}.` })}
    </div>
    <div class="two">
      ${section("Agenda do mês", agenda, { desc: "Marcado vs efetivamente utilizado." })}
      ${section("Ações com maior impacto", actions, { desc: "Operacionais — nunca clínicas." })}
    </div>`;
  return { title: "Dashboard", body };
}
