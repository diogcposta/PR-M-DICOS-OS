import Link from "next/link";

import { FunnelView, GoalsPanel, InsightList, ScorePanel } from "@/components/production/blocks";
import { ProductionPotentialChart } from "@/components/production/charts";
import { PeriodPicker } from "@/components/production/PeriodPicker";
import { btnPrimary, btnSecondary, card, PageTitle, Section, StatCard, StatusBadge, type Tone } from "@/components/production/ui";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { defaultMonth, getDashboard } from "@/modules/production/application/queries";
import { relativeChange } from "@/modules/kpis/domain/ratio";
import { EMPTY, euros, eurosPerHour, hours, integer, percent } from "@/modules/production/domain/format";
import { formatMonthLong, formatMonthShort } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";

interface Delta {
  text: string | null;
  tone: Tone;
  direction?: "up" | "down";
}

function delta(current: number | null, previous: number | null | undefined, higherIsBetter = true): Delta {
  if (current === null || previous === null || previous === undefined) return { text: null, tone: "neutral" };
  const change = relativeChange(current, previous);
  if (change === null) return { text: null, tone: "neutral" };
  const up = change > 0;
  const good = up === higherIsBetter;
  return {
    text: `${up ? "+" : ""}${percent(change, 0)} vs mês anterior`,
    tone: Math.abs(change) < 0.005 ? "neutral" : good ? "good" : "critical",
    direction: up ? "up" : "down",
  };
}

export default async function ProductionDashboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = flattenParams(await searchParams);
  const period = parsePeriod(params, await defaultMonth());
  const d = await getDashboard(period.month);
  const c = d.current;
  const p = d.previous;
  const monthLabel = formatMonthLong(d.month);
  const hasData = c.procedureCount > 0 || c.workedDays > 0;

  const cards: Array<Parameters<typeof StatCard>[0]> = [
    { label: "Produção do mês", value: euros(c.productionCents, { round: true }), ...pick(delta(c.productionCents, p?.productionCents)), hint: "Soma do valor efetivamente faturado dos procedimentos com data no mês.", testId: "card-production", emphasis: true },
    { label: `Honorários (${percent(d.profile.feeBps / 10_000, 0)})`, value: euros(c.feeCents), ...pick(delta(c.feeCents, p?.feeCents)), hint: d.profile.feeBase === "NET" ? "(Produção − custos diretos) × percentagem médica." : "Produção × percentagem médica.", testId: "card-fees", emphasis: true },
    { label: "Horas clínicas", value: hours(c.clinicalMinutes), sub: `${c.workedDays} dias${c.plannedDays ? ` · +${c.plannedDays} previstos` : ""}`, hint: "Σ (fim − início − pausa) dos dias clínicos realizados.", testId: "card-hours" },
    { label: "Produção por hora", value: eurosPerHour(c.centsPerHour), ...pick(delta(c.centsPerHour, p?.centsPerHour)), hint: "Produção ÷ horas clínicas (inclui tempo sem marcação).", testId: "card-cph" },
    { label: "Produção por dia", value: euros(c.productionPerDayCents === null ? null : Math.round(c.productionPerDayCents), { round: true }), ...pick(delta(c.productionPerDayCents, p?.productionPerDayCents)), hint: "Produção ÷ dias clínicos realizados.", testId: "card-per-day" },
    { label: "Atos realizados", value: integer(c.procedureCount), hint: "Número de procedimentos com data no mês (cada um com a sua receita).", testId: "card-acts" },
    { label: "Agendamentos", value: integer(c.appointmentCount), sub: "consultas realizadas", hint: "Número de consultas (sessões de cadeira) realizadas no mês.", testId: "card-appointments" },
    { label: "Faltas", value: integer(c.absences.missedCount), sub: `${c.absences.noShowCount} faltas · ${c.absences.lateCancelCount} canc. tardios`, hint: "Faltas + cancelamentos tardios. Cancelamentos antecipados ficam fora.", testId: "card-no-shows" },
    { label: "Taxa de faltas", value: percent(c.absences.missedRate), ...pick(delta(c.absences.missedRate, p?.absences.missedRate, false)), hint: "Faltas ÷ (consultas realizadas + faltas).", testId: "card-no-show-rate" },
    { label: "Receita perdida com faltas", value: euros(c.absences.netLostCents, { round: true }), sub: `bruta ${euros(c.absences.grossLostCents, { round: true })} · recuperada ${euros(c.absences.recoveredCents, { round: true })}`, hint: "Valor estimado das faltas − receita recuperada pela lista de espera.", testId: "card-lost" },
    { label: "Planos apresentados", value: integer(c.plans.presentedCount), hint: "Planos de tratamento com data de apresentação no mês.", testId: "card-plans" },
    { label: "Valor apresentado", value: euros(c.plans.presentedCents, { round: true }), testId: "card-plans-value", hint: "Soma do valor total dos planos apresentados no mês." },
    { label: "Planos aceites", value: integer(c.plans.acceptedCount), sub: euros(c.plans.acceptedCents, { round: true }), hint: "Planos aceites total ou parcialmente (inclui concluídos).", testId: "card-accepted" },
    { label: "Taxa de aceitação", value: percent(c.plans.acceptanceRateByValue), sub: `por número: ${percent(c.plans.acceptanceRateByCount, 0)}`, hint: "Valor aceite ÷ valor apresentado (planos apresentados no mês).", testId: "card-acceptance" },
    { label: "Tratamentos pendentes", value: euros(c.plans.pendingTreatmentCents, { round: true }), sub: "aceite e por realizar", hint: "Σ (valor aceite − valor realizado) dos planos não rejeitados apresentados no mês.", testId: "card-pending" },
  ];

  const chartData = d.summaries.map((s) => ({
    label: formatMonthShort(s.month),
    production: s.productionCents / 100,
    lost: s.absences.netLostCents / 100,
  }));

  return (
    <div className="space-y-10">
      <PageTitle
        title="Clinical Production Dashboard"
        description={`${d.profile.name} · ${monthLabel}. Produção, honorários, agenda e planos — para decidir onde agir.`}
        actions={
          <>
            <PeriodPicker period={period} presets={false} />
            <Link href="/producao/procedimentos/novo" className={btnPrimary}>
              + Registar procedimento
            </Link>
          </>
        }
      />

      {!hasData ? (
        <div className={`${card} p-6 text-sm text-slate-600 dark:text-slate-300`}>
          Sem registos em {monthLabel}. Comece por <Link className="underline" href="/producao/dias">registar um dia clínico</Link> e
          depois os procedimentos — ou carregue os dados de demonstração com <code>npm run producao:seed</code>.
        </div>
      ) : null}

      <section aria-label="Indicadores do mês" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((cardProps) => (
          <StatCard key={cardProps.label} {...cardProps} />
        ))}
      </section>

      {c.projectedProductionCents !== null && c.plannedDays > 0 ? (
        <p className="-mt-6 text-sm text-slate-500 dark:text-slate-400" data-testid="projection">
          Projeção para o fim do mês com {c.plannedDays} {c.plannedDays === 1 ? "dia previsto" : "dias previstos"} ({hours(c.plannedMinutes)}) ao ritmo atual:{" "}
          <strong className="text-slate-900 dark:text-white">{euros(c.projectedProductionCents, { round: true })}</strong> de produção ·{" "}
          {euros(Math.round((c.projectedProductionCents * d.profile.feeBps) / 10_000), { round: true })} de honorários.
        </p>
      ) : null}

      <Section id="objetivos" title="Produção atual vs objetivos" description="Projeções com as mesmas horas clínicas do mês: o que muda é apenas a produção por hora.">
        <GoalsPanel currentCph={c.centsPerHour} clinicalMinutes={c.clinicalMinutes} goals={d.goals} gap={d.gap} />
      </Section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Section id="insights" title="Insights automáticos" description="Regras determinísticas sobre os teus dados — sem IA e sem recomendações clínicas.">
          <div className={`${card} px-5`}>
            <InsightList insights={d.insights} />
          </div>
        </Section>
        <Section id="score" title="Eficiência operacional">
          <ScorePanel score={d.score} />
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Produção real vs potencial sem faltas" description="Últimos 6 meses. A parte laranja é a receita líquida perdida com faltas e cancelamentos tardios.">
          <div className={`${card} p-4`}>
            <ProductionPotentialChart data={chartData} />
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer">Ver tabela</summary>
              <table className="mt-2 w-full tabular-nums">
                <thead><tr className="text-left"><th>Mês</th><th className="text-right">Produção</th><th className="text-right">Perdida</th><th className="text-right">Potencial</th></tr></thead>
                <tbody>
                  {d.summaries.map((s) => (
                    <tr key={s.month}><td>{formatMonthShort(s.month)}</td><td className="text-right">{euros(s.productionCents, { round: true })}</td><td className="text-right">{euros(s.absences.netLostCents, { round: true })}</td><td className="text-right">{euros(s.productionCents + s.absences.netLostCents, { round: true })}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        </Section>
        <Section title="Funil de tratamento" description={`Planos apresentados em ${monthLabel}.`} actions={<Link href="/producao/planos" className={btnSecondary}>Planos</Link>}>
          <div className={`${card} p-5`}>
            <FunnelView funnel={d.funnel} />
          </div>
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Agenda do mês" description="Marcado vs efetivamente utilizado. A diferença são as faltas.">
          <div className={`${card} grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-3`}>
            <Metric label="Horas disponíveis" value={hours(c.agenda.availableMinutes)} />
            <Metric label="Horas marcadas" value={hours(c.agenda.bookedMinutes)} />
            <Metric label="Horas trabalhadas" value={hours(c.agenda.workedMinutes)} />
            <Metric label="Perdidas por faltas" value={hours(c.agenda.lostMinutes)} />
            <Metric label="Horas vazias" value={hours(c.agenda.emptyMinutes)} />
            <Metric label="Ocupação teórica → real" value={`${percent(c.agenda.theoreticalOccupancy, 0)} → ${percent(c.agenda.realOccupancy, 0)}`} />
          </div>
        </Section>
        <Section title="Ações com maior impacto" description="Operacionais — agenda, faltas, follow-up e tabela. Nunca clínicas." actions={<Link href={`/producao/relatorio?mes=${d.month}`} className={btnSecondary}>Relatório</Link>}>
          <ol className={`${card} divide-y divide-slate-100 dark:divide-slate-800`} data-testid="actions">
            {d.actions.length === 0 ? <li className="p-5 text-sm text-slate-500">{EMPTY}</li> : null}
            {d.actions.map((a, i) => (
              <li key={a.key} className="flex gap-4 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {a.title} <span className="ml-1 font-normal text-slate-500">≈ {euros(a.impactCents, { round: true })} potencial</span>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{a.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          {d.followUps.length > 0 ? (
            <p className="text-sm">
              <StatusBadge tone="warning">{`${d.followUps.length} planos para follow-up`}</StatusBadge>{" "}
              <Link href="/producao/planos#follow-up" className="ml-1 text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">Ver lista</Link>
            </p>
          ) : null}
        </Section>
      </div>
    </div>
  );
}

function pick(d: Delta) {
  return { delta: d.text, tone: d.tone, direction: d.direction };
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
