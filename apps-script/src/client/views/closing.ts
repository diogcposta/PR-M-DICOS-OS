/**
 * Fecho do mês (D-060): o total da folha de honorários substitui a estimativa
 * (pago pelo paciente × percentagem + exames). Também é aqui que entram os
 * meses anteriores à app, só com totais mensais.
 */
import { applyClosings, closingFor, hasRecords, monthFees, type MonthFees } from "@/modules/production/domain/closing";
import { examTotals } from "@/modules/production/domain/exams";
import { euros, eurosPerHour, formatNumber, hours } from "@/modules/production/domain/format";
import { centsPerHour } from "@/modules/production/domain/metrics";
import type { MonthlySummary } from "@/modules/production/domain/monthly";
import { addMonths, formatMonthLong, formatMonthShort, monthOf, monthRange } from "@/modules/production/domain/time";
import { monthlySeries } from "@/modules/production/domain/views";

import type { State } from "../state";
import { badge, empty, field, html, pageTitle, section, table } from "../ui";

import type { Ctx, View } from "./types";

const money = (cents: number | null) => (!cents ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));

/** Honorários estimados de um mês: atos (resumo mensal) + exames. */
export function estimatedFees(state: State, summary: Pick<MonthlySummary, "month" | "feeCents">): number {
  const r = monthRange(summary.month);
  return summary.feeCents + examTotals(state.exams, r.from, r.to, state.profile.feeBps).feeCents;
}

/** Estado dos honorários de um mês (estimado ou fechado). */
export function feesOf(state: State, summary: Pick<MonthlySummary, "month" | "feeCents">): MonthFees {
  return monthFees(summary.month, estimatedFees(state, summary), state.closings);
}

const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${euros(Math.abs(cents))}`;

export function closing(ctx: Ctx): View {
  const { state } = ctx;
  const thisMonth = monthOf(state.today);
  const month = /^\d{4}-\d{2}$/.test(ctx.params.get("mes") ?? "") ? ctx.params.get("mes")! : addMonths(thisMonth, -1);
  const summaries = monthlySeries(state.records, state.profile, thisMonth, 12);
  const rows = applyClosings(summaries, state.closings)
    .map((s) => {
      const recorded = summaries.find((x) => x.month === s.month)!;
      const c = closingFor(state.closings, s.month);
      const fees = feesOf(state, recorded);
      return { s, c, fees, records: hasRecords(recorded) };
    })
    .filter((r) => r.records || r.c)
    .reverse();
  const current = closingFor(state.closings, month);
  const body = html`
    ${pageTitle("Fecho do mês", "No dia a dia regista o valor pago pelo paciente; os honorários são uma estimativa. Quando receber a folha de honorários, grave aqui o total recebido (atos e exames).")}
    ${section("Fechar um mês", html`<form class="card pad form" data-op="saveClosing" data-reset aria-label="Fechar mês">
      <div class="grid">
        ${field({ label: "Mês", name: "month", type: "month", value: month, required: true, attrs: `max="${thisMonth}"` })}
        ${field({ label: "Total recebido (€)", name: "received", value: money(current?.receivedCents ?? 0), required: true, inputmode: "decimal", hint: "Total da folha de honorários, com os exames." })}
        ${field({ label: "Valor pago pelos pacientes (€)", name: "production", value: money(current?.productionCents ?? 0), inputmode: "decimal", hint: "Só para meses sem registos diários (histórico)." })}
        ${field({ label: "Horas clínicas", name: "hours", value: current?.clinicalMinutes ? formatNumber(current.clinicalMinutes / 60, 1) : "", inputmode: "decimal", hint: "Só para meses sem registos diários. Ex.: 130,5" })}
        ${field({ label: "Nota", name: "note", value: current?.note ?? "", wide: true, attrs: 'maxlength="200"' })}
      </div>
      <div class="form-actions"><button type="submit" class="btn primary">Gravar fecho</button><span class="muted small">Gravar o mesmo mês substitui o fecho anterior.</span></div>
    </form>`)}
    ${section("Últimos 12 meses", rows.length === 0 ? empty("Ainda não há meses com registos nem fechos.") : table(rows, [
      { head: "Mês", cell: (r) => html`<a href="#/fecho?mes=${r.s.month}">${formatMonthShort(r.s.month)}</a>` },
      { head: "Estimado", cell: (r) => (r.records ? euros(r.fees.estimatedCents) : "—"), num: true },
      { head: "Recebido", cell: (r) => (r.c ? html`<strong>${euros(r.c.receivedCents)}</strong>` : "—"), num: true },
      { head: "Diferença", cell: (r) => (r.fees.differenceCents === null ? "—" : signed(r.fees.differenceCents)), num: true },
      { head: "Horas", cell: (r) => (r.s.clinicalMinutes ? hours(r.s.clinicalMinutes) : "—"), num: true },
      { head: "Recebido/h", cell: (r) => (r.c ? eurosPerHour(centsPerHour(r.c.receivedCents, r.s.clinicalMinutes)) : "—"), num: true },
      { head: "Estado", cell: (r) => (r.c ? badge(r.records ? "Fechado" : "Histórico", "good") : badge("Por fechar", "warn")) },
      { head: "", cell: (r) => (r.c ? html`<button class="btn ghost small" data-op="deleteClosing" data-id="${r.c.id}" data-confirm="Apagar o fecho de ${formatMonthLong(r.s.month)}?">Apagar</button>` : "") },
    ], "Fechos por mês"), { desc: "Estimado = valor pago pelos pacientes × percentagem + exames. Diferença = recebido − estimado." })}`;
  return { title: "Fecho do mês", body };
}
