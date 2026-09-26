import { InsightList } from "@/components/production/blocks";
import { PeriodPicker } from "@/components/production/PeriodPicker";
import { PrintButton } from "@/components/production/PrintButton";
import { btnSecondary, card, PageTitle, Section } from "@/components/production/ui";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { defaultMonth, getMonthlyReport } from "@/modules/production/application/queries";
import { EMPTY, euros, eurosPerHour, hours, percent } from "@/modules/production/domain/format";
import { topAndBottom } from "@/modules/production/domain/metrics";
import { formatMonthLong } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatório mensal" };

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="font-medium tabular-nums text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

function Block({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className={`${card} p-5`}>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

export default async function ReportPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod(flattenParams(await searchParams), await defaultMonth());
  const { dashboard: d, profitability: p } = await getMonthlyReport(period.month);
  const c = d.current;
  const { top, bottom } = topAndBottom(p.byType, 3);

  return (
    <div className="space-y-8">
      <PageTitle
        title={`Relatório mensal · ${formatMonthLong(d.month)}`}
        description={`${d.profile.name}. Indicadores operacionais e económicos — não medem qualidade clínica.`}
        actions={
          <>
            <PeriodPicker period={period} presets={false} />
            <PrintButton />
            <a className={`${btnSecondary} no-print`} href={`/producao/relatorio/exportar?mes=${d.month}`} download>⤓ Markdown</a>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Block title="Resumo">
          <Row label="Produção" value={euros(c.productionCents)} />
          <Row label={`Honorários (${percent(d.profile.feeBps / 10_000, 0)})`} value={euros(c.feeCents)} />
          <Row label="Horas clínicas" value={hours(c.clinicalMinutes)} />
          <Row label="€/hora" value={eurosPerHour(c.centsPerHour, 2)} />
          <Row label="€/dia" value={euros(c.productionPerDayCents === null ? null : Math.round(c.productionPerDayCents))} />
          <Row label="Efficiency Score (operacional)" value={d.score.score === null ? EMPTY : `${d.score.score}/100`} />
        </Block>
        <Block title="Agenda">
          <Row label="Ocupação teórica (marcada)" value={percent(c.agenda.theoreticalOccupancy)} />
          <Row label="Ocupação real (trabalhada)" value={percent(c.agenda.realOccupancy)} />
          <Row label="Horas vazias" value={hours(c.agenda.emptyMinutes)} />
          <Row label="Faltas" value={`${c.absences.missedCount} (${percent(c.absences.missedRate)})`} />
          <Row label="Horas perdidas" value={hours(c.absences.lostMinutes)} />
          <Row label="Receita perdida (líquida)" value={euros(c.absences.netLostCents)} />
        </Block>
        <Block title="Planos">
          <Row label="Apresentados" value={`${c.plans.presentedCount} · ${euros(c.plans.presentedCents, { round: true })}`} />
          <Row label="Aceites" value={`${c.plans.acceptedCount} · ${euros(c.plans.acceptedCents, { round: true })}`} />
          <Row label="Taxa de aceitação (valor)" value={percent(c.plans.acceptanceRateByValue)} />
          <Row label="Pendentes de realizar" value={euros(c.plans.pendingTreatmentCents, { round: true })} />
          <Row label="Follow-up necessário" value={`${d.followUps.length} planos`} />
        </Block>
        <Block title="Procedimentos · mais rentáveis">
          {top.map((r) => <Row key={r.key} label={r.key} value={eurosPerHour(r.centsPerHour)} />)}
          <Row label="Média por hora de cadeira" value={eurosPerHour(p.overallChairCph)} />
        </Block>
        <Block title="Procedimentos · menos rentáveis">
          {bottom.map((r) => <Row key={r.key} label={r.key} value={eurosPerHour(r.centsPerHour)} />)}
        </Block>
        <Block title="Seguros · impacto na produtividade">
          <Row label="Produção com seguros/convenções" value={`${euros(p.agreement.thirdPartyRevenueCents, { round: true })} (${percent(p.agreement.thirdPartyShare, 0)})`} />
          <Row label="Desconto face à tabela" value={euros(p.agreement.discountCents, { round: true })} />
          {p.insurers.map((i) => <Row key={i.payerName} label={i.payerName} value={`${eurosPerHour(i.centsPerHour)} (${i.diffShare === null ? EMPTY : percent(i.diffShare, 0)})`} />)}
        </Block>
      </div>

      <Section title="Oportunidades — as três ações com maior impacto potencial para o próximo mês">
        <ol className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {d.actions.length === 0 ? <li className="p-4 text-sm text-slate-500">{EMPTY}</li> : null}
          {d.actions.map((a, i) => (
            <li key={a.key} className="p-4 text-sm">
              <p className="font-medium">{i + 1}. {a.title} <span className="font-normal text-slate-500">≈ {euros(a.impactCents, { round: true })}</span></p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-400">{a.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Insights">
        <div className={`${card} px-5`}><InsightList insights={d.insights} /></div>
      </Section>

      <p className="text-xs text-slate-500">A decisão clínica pertence sempre ao médico e baseia-se na indicação clínica.</p>
    </div>
  );
}
