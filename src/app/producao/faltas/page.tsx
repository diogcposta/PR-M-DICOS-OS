import { createAbsenceAction, deleteAbsenceAction } from "@/app/producao/actions";
import { ProductionPotentialChart } from "@/components/production/charts";
import { ConfirmButton } from "@/components/production/ConfirmButton";
import { AbsenceForm } from "@/components/production/forms";
import { PeriodPicker } from "@/components/production/PeriodPicker";
import { btnGhost, card, EmptyNote, PageTitle, Section, StatCard, TableWrap, td, th } from "@/components/production/ui";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { defaultMonth, getEntryContext, listAbsences, monthlySummaries } from "@/modules/production/application/queries";
import { ABSENCE_LABELS, PAYER_LABELS, type AbsenceKind, type PayerType } from "@/modules/production/domain/constants";
import { duration, euros, hours, percent } from "@/modules/production/domain/format";
import { formatCivilDate, formatMonthShort, formatTime, todayInLisbon } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Faltas" };

export default async function AbsencesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod(flattenParams(await searchParams), await defaultMonth());
  const [absences, summaries, ctx] = await Promise.all([
    listAbsences(period.from, period.to),
    monthlySummaries(period.month, 12),
    getEntryContext(todayInLisbon()),
  ]);
  const current = summaries.at(-1)!;
  const a = current.absences;

  return (
    <div className="space-y-8">
      <PageTitle title="Faltas e cancelamentos" description="Faltas e cancelamentos tardios contam como perda; cancelamentos antecipados ficam à parte (houve tempo para reocupar o slot)." actions={<PeriodPicker period={period} />} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label={`Faltas em ${current.month}`}>
        <StatCard label="Faltas + canc. tardios" value={String(a.missedCount)} sub={`${a.earlyCancelCount} canc. antecipados`} />
        <StatCard label="Taxa de faltas" value={percent(a.missedRate)} hint="Faltas ÷ (consultas realizadas + faltas)." />
        <StatCard label="Horas perdidas" value={hours(a.lostMinutes)} hint="Duração das faltas cuja vaga não foi recuperada." />
        <StatCard label="% da agenda perdida" value={percent(current.clinicalMinutes ? a.lostMinutes / current.clinicalMinutes : null)} hint="Horas perdidas ÷ horas clínicas." />
        <StatCard label="Receita recuperada" value={euros(a.recoveredCents, { round: true })} sub={`${a.recoveredSlots} vagas pela lista de espera`} />
        <StatCard label="Receita líquida perdida" value={euros(a.netLostCents, { round: true })} sub={`potencial ${euros(a.grossLostCents, { round: true })}`} tone="warning" />
      </section>

      <Section title="Produção real vs produção potencial sem faltas" description="Últimos 12 meses.">
        <div className={`${card} p-4`}>
          <ProductionPotentialChart data={summaries.map((s) => ({ label: formatMonthShort(s.month), production: s.productionCents / 100, lost: s.absences.netLostCents / 100 }))} />
        </div>
      </Section>

      <Section title="Registar falta ou cancelamento">
        <div className={`${card} p-5`}>
          <AbsenceForm action={createAbsenceAction} defaultDate={todayInLisbon()} procedureTypes={ctx.suggestions.map((s) => s.procedureType)} />
        </div>
      </Section>

      <Section title={`Registos · ${period.label}`}>
        {absences.length === 0 ? (
          <EmptyNote>Sem faltas neste período.</EmptyNote>
        ) : (
          <TableWrap label="Faltas registadas">
            <thead>
              <tr>
                <th className={th}>Data</th><th className={th}>Hora</th><th className={th}>Tipo</th><th className={th}>Procedimento previsto</th>
                <th className={`${th} text-right`}>Duração</th><th className={`${th} text-right`}>Valor estimado</th><th className={th}>Pagador</th>
                <th className={th}>Slot recuperado</th><th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {absences.map((x) => (
                <tr key={x.id}>
                  <td className={td}>{formatCivilDate(x.date)}</td>
                  <td className={td}>{formatTime(x.startMinute)}</td>
                  <td className={td}>{ABSENCE_LABELS[x.kind as AbsenceKind] ?? x.kind}</td>
                  <td className={td}>{x.plannedProcedure ?? "—"}</td>
                  <td className={`${td} text-right`}>{duration(x.durationMinutes)}</td>
                  <td className={`${td} text-right`}>{euros(x.estimatedValueCents)}</td>
                  <td className={td}>{PAYER_LABELS[x.payerType as PayerType] ?? x.payerType}</td>
                  <td className={td}>{x.slotRecovered ? `Sim · ${euros(x.recoveredValueCents)}` : "Não"}</td>
                  <td className={`${td} text-right`}>
                    <form action={deleteAbsenceAction.bind(null, x.id)}>
                      <ConfirmButton className={`${btnGhost} px-2 py-1 text-xs`} message="Apagar esta falta?">Apagar</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Section>
    </div>
  );
}
