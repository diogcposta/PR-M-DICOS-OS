/**
 * Relatório mensal em Markdown (descarregável; a página do relatório é a versão
 * visual e imprime/guarda como PDF pelo browser).
 */
import { EMPTY, euros, eurosPerHour, hours, percent } from "../domain/format";
import { topAndBottom } from "../domain/metrics";
import { formatMonthLong } from "../domain/time";

import type { getMonthlyReport } from "./queries";

type Report = Awaited<ReturnType<typeof getMonthlyReport>>;

export function reportMarkdown({ dashboard: d, profitability: p }: Report): string {
  const c = d.current;
  const { top, bottom } = topAndBottom(p.byType, 3);
  const lines = [
    `# Relatório mensal — ${formatMonthLong(d.month)}`,
    "",
    `${d.profile.name} · Clinical Production Dashboard · indicadores operacionais/económicos (não medem qualidade clínica).`,
    "",
    "## Resumo",
    `- Produção: **${euros(c.productionCents)}**`,
    `- Honorários (${percent(d.profile.feeBps / 10_000, 0)}): **${euros(c.feeCents)}**`,
    `- Horas clínicas: ${hours(c.clinicalMinutes)} em ${c.workedDays} dias`,
    `- €/hora: ${eurosPerHour(c.centsPerHour, 2)} · €/dia: ${euros(c.productionPerDayCents === null ? null : Math.round(c.productionPerDayCents))}`,
    `- Clinical Efficiency Score: ${d.score.score ?? EMPTY}/100 (operacional)`,
    "",
    "## Agenda",
    `- Ocupação teórica (marcada): ${percent(c.agenda.theoreticalOccupancy)} · real (trabalhada): ${percent(c.agenda.realOccupancy)}`,
    `- Horas vazias: ${hours(c.agenda.emptyMinutes)}`,
    `- Faltas: ${c.absences.missedCount} (${percent(c.absences.missedRate)}) · horas perdidas ${hours(c.absences.lostMinutes)} · receita líquida perdida ${euros(c.absences.netLostCents)}`,
    "",
    "## Procedimentos",
    `- Mais rentáveis (€/h): ${top.map((r) => `${r.key} ${eurosPerHour(r.centsPerHour)}`).join("; ") || EMPTY}`,
    `- Menos rentáveis (€/h): ${bottom.map((r) => `${r.key} ${eurosPerHour(r.centsPerHour)}`).join("; ") || EMPTY}`,
    `- Média global por hora de cadeira: ${eurosPerHour(p.overallChairCph)}`,
    "",
    "## Seguros e convenções",
    `- Produção com seguros/convenções: ${euros(p.agreement.thirdPartyRevenueCents)} (${percent(p.agreement.thirdPartyShare, 0)})`,
    `- Desconto face à tabela: ${euros(p.agreement.discountCents)} · impacto no tempo: ${euros(p.agreement.timeValueGapCents)}`,
    ...p.insurers.map((i) => `- ${i.payerName}: ${eurosPerHour(i.centsPerHour)} vs ${eurosPerHour(i.privateEquivalentCph)} particular equivalente (${i.diffShare === null ? EMPTY : percent(i.diffShare, 0)})`),
    "",
    "## Planos",
    `- Apresentados: ${c.plans.presentedCount} (${euros(c.plans.presentedCents)}) · aceites: ${c.plans.acceptedCount} (${euros(c.plans.acceptedCents)}) · aceitação ${percent(c.plans.acceptanceRateByValue)}`,
    `- Pendentes de realizar: ${euros(c.plans.pendingTreatmentCents)} · follow-up necessário: ${d.followUps.length} planos`,
    "",
    "## Oportunidades — ações com maior impacto para o próximo mês",
    ...(d.actions.length ? d.actions.map((a, i) => `${i + 1}. **${a.title}** (≈ ${euros(a.impactCents, { round: true })}) — ${a.detail}`) : [EMPTY]),
    "",
    "## Insights",
    ...d.insights.map((i) => `- ${i.text}`),
    "",
    "_A decisão clínica pertence sempre ao médico e baseia-se na indicação clínica._",
    "",
  ];
  return lines.join("\n");
}
