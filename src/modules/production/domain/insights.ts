/**
 * Insights automáticos e ações sugeridas — motor de regras, sem IA.
 *
 * Princípio central: descrever, nunca prescrever tratamentos. As frases comparam
 * números ("as coroas apresentam X €/h, comparativamente à média global Y €/h") e
 * as ações são operacionais (agenda, faltas, follow-up, tabela de preços). Nunca
 * "faz mais coroas porque dão mais dinheiro": a decisão clínica pertence ao
 * médico e baseia-se na indicação clínica. Há um teste que garante esta regra.
 */
import { relativeChange, safeDivide } from "@/modules/kpis/domain/ratio";

import { euros, eurosPerHour, hours, percent } from "./format";
import type { InsurerRow, ProfitabilityRow } from "./metrics";
import type { MonthlySummary } from "./monthly";
import type { FollowUpItem } from "./plans";

export type InsightTone = "positive" | "neutral" | "attention";

export interface Insight {
  readonly key: string;
  readonly tone: InsightTone;
  readonly text: string;
}

export interface InsightInput {
  readonly current: MonthlySummary;
  readonly previous: MonthlySummary | null;
  readonly categories: readonly ProfitabilityRow[];
  readonly procedureTypes: readonly ProfitabilityRow[];
  readonly insurers: readonly InsurerRow[];
  readonly followUps: readonly FollowUpItem[];
  readonly overallChairCph: number | null;
  /** Fração: 0,05 = 5%. */
  readonly targetNoShowRate: number;
}

/** Ganho potencial se a taxa de faltas descesse para o alvo (proporcional à perda líquida). */
export function noShowReductionGain(summary: MonthlySummary, targetRate: number): number {
  const rate = summary.absences.missedRate;
  if (rate === null || rate <= targetRate || rate === 0) return 0;
  return Math.round(summary.absences.netLostCents * (1 - targetRate / rate));
}

const MIN_CASES_FOR_COMPARISON = 3;

export function buildInsights(input: InsightInput): Insight[] {
  const { current, previous } = input;
  const insights: Insight[] = [];

  if (previous && current.centsPerHour !== null && previous.centsPerHour !== null) {
    const change = relativeChange(current.centsPerHour, previous.centsPerHour);
    if (change !== null && Math.abs(change) >= 0.01) {
      insights.push({
        key: "cph-change",
        tone: change > 0 ? "positive" : "attention",
        text: `A tua produção/hora ${change > 0 ? "aumentou" : "diminuiu"} ${percent(Math.abs(change), 0)} relativamente ao mês anterior (${eurosPerHour(previous.centsPerHour)} → ${eurosPerHour(current.centsPerHour)}).`,
      });
    }
  }

  if (current.absences.netLostCents > 0) {
    insights.push({
      key: "no-show-loss",
      tone: "attention",
      text: `Perdeste aproximadamente ${euros(current.absences.netLostCents, { round: true })} este mês devido a faltas (${current.absences.missedCount} faltas, ${hours(current.absences.lostMinutes)} de agenda não recuperada).`,
    });
  }

  const gain = noShowReductionGain(current, input.targetNoShowRate);
  if (gain > 0 && current.absences.missedRate !== null) {
    insights.push({
      key: "no-show-scenario",
      tone: "neutral",
      text: `Se reduzisses a taxa de faltas de ${percent(current.absences.missedRate, 0)} para ${percent(input.targetNoShowRate, 0)}, a produção potencial aumentaria aproximadamente ${euros(gain, { round: true })} por mês.`,
    });
  }

  for (const insurer of input.insurers) {
    if (insurer.cases < MIN_CASES_FOR_COMPARISON || insurer.diffShare === null) continue;
    if (insurer.diffShare <= -0.15) {
      insights.push({
        key: `insurer-${insurer.payerName}`,
        tone: "attention",
        text: `Os tratamentos com ${insurer.payerName} apresentam produtividade ${percent(-insurer.diffShare, 0)} inferior aos particulares nos mesmos procedimentos (${eurosPerHour(insurer.centsPerHour)} vs ${eurosPerHour(insurer.privateEquivalentCph)}).`,
      });
    }
  }

  const disparities = input.categories
    .filter((c) => c.hoursShare !== null && c.revenueShare !== null && c.hoursShare >= 0.05)
    .map((c) => ({ c, gap: (c.hoursShare ?? 0) - (c.revenueShare ?? 0) }))
    .filter(({ gap }) => Math.abs(gap) >= 0.05)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 2);
  for (const { c, gap } of disparities) {
    insights.push({
      key: `category-${c.key}`,
      tone: gap > 0 ? "attention" : "neutral",
      text: `${c.key} representa ${percent(c.hoursShare, 0)} das horas de cadeira e ${percent(c.revenueShare, 0)} da faturação.`,
    });
  }

  if (input.overallChairCph !== null) {
    const lowest = input.procedureTypes
      .filter((r) => r.centsPerHour !== null && r.revenueCents > 0 && r.cases >= 2)
      .sort((a, b) => (a.centsPerHour ?? 0) - (b.centsPerHour ?? 0))[0];
    if (lowest && lowest.centsPerHour !== null && lowest.centsPerHour < input.overallChairCph * 0.75) {
      insights.push({
        key: `low-procedure-${lowest.key}`,
        tone: "neutral",
        text: `${lowest.key} apresenta produção média de ${eurosPerHour(lowest.centsPerHour)}, comparativamente à média global de ${eurosPerHour(input.overallChairCph)} por hora de cadeira.`,
      });
    }
  }

  const openFollowUp = input.followUps.reduce((s, f) => s + f.openCents, 0);
  if (openFollowUp > 0) {
    const priority = input.followUps.filter((f) => f.priority === "PRIORITY").length;
    insights.push({
      key: "follow-up",
      tone: "attention",
      text: `Existem ${euros(openFollowUp, { round: true })} em planos de tratamento que precisam de follow-up (${input.followUps.length} planos${priority > 0 ? `, ${priority} prioritários` : ""}).`,
    });
  }

  if (current.agenda.emptyMinutes >= 5 * 60) {
    insights.push({
      key: "empty-hours",
      tone: "neutral",
      text: `Ficaram ${hours(current.agenda.emptyMinutes)} de horário disponível sem marcação (ocupação teórica de ${percent(current.agenda.theoreticalOccupancy, 0)}).`,
    });
  }

  if (current.plannedDays > 0 && current.projectedProductionCents !== null) {
    insights.push({
      key: "projection",
      tone: "neutral",
      text: `Com ${current.plannedDays} ${current.plannedDays === 1 ? "dia clínico previsto" : "dias clínicos previstos"} até ao fim do mês, ao ritmo atual a produção deverá rondar ${euros(current.projectedProductionCents, { round: true })}.`,
    });
  }

  return insights;
}

export interface Action {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  /** Impacto mensal potencial estimado, em cêntimos. */
  readonly impactCents: number;
}

/**
 * As ações com maior impacto potencial para o próximo mês. Todas operacionais:
 * nenhuma sugere fazer mais (ou menos) de um tratamento.
 */
export function topActions(input: InsightInput, limit = 3): Action[] {
  const { current } = input;
  const actions: Action[] = [];

  const gain = noShowReductionGain(current, input.targetNoShowRate);
  if (gain > 0) {
    actions.push({
      key: "no-shows",
      title: "Reduzir faltas",
      detail: `Confirmar marcações na véspera e manter lista de espera ativa. Taxa atual ${percent(current.absences.missedRate, 0)}; alvo ${percent(input.targetNoShowRate, 0)}.`,
      impactCents: gain,
    });
  }

  if (input.followUps.length > 0) {
    const open = input.followUps.reduce((s, f) => s + f.openCents, 0);
    const rate = current.plans.acceptanceRateByValue ?? 0.5;
    actions.push({
      key: "follow-up",
      title: "Fazer follow-up de planos pendentes",
      detail: `${input.followUps.length} planos com ${euros(open, { round: true })} em aberto. Impacto estimado com a taxa de aceitação atual (${percent(rate, 0)}).`,
      impactCents: Math.round(open * rate),
    });
  }

  if (current.agenda.emptyMinutes > 0 && current.centsPerHour !== null) {
    actions.push({
      key: "empty-hours",
      title: "Ocupar horas vazias",
      detail: `${hours(current.agenda.emptyMinutes)} sem marcação. Usar lista de espera e slots de duração ajustada ao procedimento em vez de blocos fixos de 45 min.`,
      impactCents: Math.round((current.agenda.emptyMinutes / 60) * current.centsPerHour),
    });
  }

  if (input.overallChairCph !== null) {
    const lowest = input.procedureTypes
      .filter((r) => r.centsPerHour !== null && r.revenueCents > 0 && r.cases >= 2 && r.chairMinutes > 0)
      .sort((a, b) => (a.centsPerHour ?? 0) - (b.centsPerHour ?? 0))[0];
    if (lowest && lowest.centsPerHour !== null && lowest.centsPerHour < input.overallChairCph) {
      const gap = input.overallChairCph - lowest.centsPerHour;
      actions.push({
        key: `review-${lowest.key}`,
        title: `Rever tempo de cadeira e preço de ${lowest.key}`,
        detail: `${eurosPerHour(lowest.centsPerHour)} vs média global ${eurosPerHour(input.overallChairCph)}. Rever protocolo de tempo, tabela ou convenção — sem alterar a indicação clínica.`,
        // Impacto teórico se o €/h deste procedimento chegasse à média, no mesmo tempo.
        impactCents: Math.round((gap * lowest.chairMinutes) / 60),
      });
    }
  }

  const worstInsurer = input.insurers
    .filter((i) => i.diffShare !== null && i.diffShare < -0.15 && i.cases >= MIN_CASES_FOR_COMPARISON)
    .sort((a, b) => (a.diffShare ?? 0) - (b.diffShare ?? 0))[0];
  if (worstInsurer && worstInsurer.privateEquivalentCph !== null && worstInsurer.centsPerHour !== null) {
    const gap = worstInsurer.privateEquivalentCph - worstInsurer.centsPerHour;
    actions.push({
      key: `insurer-${worstInsurer.payerName}`,
      title: `Avaliar a convenção ${worstInsurer.payerName}`,
      detail: `${eurosPerHour(worstInsurer.centsPerHour)} vs ${eurosPerHour(worstInsurer.privateEquivalentCph)} a preço particular nos mesmos procedimentos. Discutir tabela com a clínica.`,
      impactCents: Math.round((gap * worstInsurer.chairMinutes) / 60),
    });
  }

  return actions
    .filter((a) => a.impactCents > 0)
    .sort((a, b) => b.impactCents - a.impactCents)
    .slice(0, limit);
}

/** Fração do valor em aberto que não está em atraso (para o score). */
export function followUpHealth(
  openPlansCents: number,
  overdueCents: number,
): number | null {
  const ratio = safeDivide(openPlansCents - overdueCents, openPlansCents);
  return ratio === null ? null : Math.max(0, ratio);
}
