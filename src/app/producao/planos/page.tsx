import Link from "next/link";

import { createPlanAction, markPlanContactedAction } from "@/app/producao/actions";
import { FunnelView } from "@/components/production/blocks";
import { PlanForm } from "@/components/production/forms";
import { PeriodPicker } from "@/components/production/PeriodPicker";
import { btnSecondary, card, EmptyNote, PageTitle, Section, StatCard, StatusBadge, TableWrap, td, th } from "@/components/production/ui";
import { nextCaseCode } from "@/modules/production/application/commands";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { defaultMonth, getPlansOverview } from "@/modules/production/application/queries";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/modules/production/domain/constants";
import { euros, percent } from "@/modules/production/domain/format";
import { summarisePlans } from "@/modules/production/domain/monthly";
import { formatCivilDate, todayInLisbon } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planos de tratamento" };

export default async function PlansPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod({ periodo: "3m", ...flattenParams(await searchParams) }, await defaultMonth());
  const d = await getPlansOverview(period.from, period.to);
  const summary = summarisePlans(d.inRange);
  const today = todayInLisbon();
  const next = await nextCaseCode(Number(today.slice(0, 4)));
  const followUpValue = d.followUps.reduce((s, f) => s + f.openCents, 0);
  const inRangeRows = d.plans.filter((p) => p.presentedDate >= period.from && p.presentedDate <= period.to);

  return (
    <div className="space-y-10">
      <PageTitle title="Planos de tratamento" description={`${period.label}. A aplicação indica o que seguir — não envia mensagens a pacientes.`} actions={<PeriodPicker period={period} />} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Resumo dos planos">
        <StatCard label="Planos apresentados" value={String(summary.presentedCount)} sub={euros(summary.presentedCents, { round: true })} />
        <StatCard label="Planos aceites" value={String(summary.acceptedCount)} sub={euros(summary.acceptedCents, { round: true })} />
        <StatCard label="Taxa de aceitação (valor)" value={percent(summary.acceptanceRateByValue)} sub={`por número ${percent(summary.acceptanceRateByCount, 0)}`} />
        <StatCard label="Pendente de realizar" value={euros(summary.pendingTreatmentCents, { round: true })} sub="aceite, por fazer" />
        <StatCard label="Não avançou" value={euros(summary.notAdvancedCents, { round: true })} sub="apresentado e não aceite" tone="warning" />
        <StatCard label="Follow-up necessário" value={String(d.followUps.length)} sub={euros(followUpValue, { round: true })} tone={d.followUps.length ? "warning" : "neutral"} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <Section title="Funil de tratamento" description="Em valor e número de casos. A barra destacada é o passo com maior perda.">
          <div className={`${card} p-5`}><FunnelView funnel={d.funnel} /></div>
        </Section>

        <Section id="follow-up" title="Follow-up" description={`Regras: plano > ${euros(d.profile.followUpMinCents)} sem próxima consulta; > ${euros(d.profile.followUpPriorityCents)} prioritário; sem resposta há ${d.profile.followUpFirstAlertDays} e ${d.profile.followUpSecondAlertDays} dias.`}>
          {d.followUps.length === 0 ? <EmptyNote>Nada a seguir. 👍</EmptyNote> : (
            <ul className={`${card} divide-y divide-slate-100 dark:divide-slate-800`} data-testid="follow-up-list">
              {d.followUps.map((f) => (
                <li key={f.planId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <Link href={`/producao/planos/${f.planId}`} className="font-mono hover:underline">{f.caseCode}</Link>{" "}
                      <span className="tabular-nums">{euros(f.openCents, { round: true })}</span>{" "}
                      {f.priority === "PRIORITY" ? <StatusBadge tone="critical">Prioritário</StatusBadge> : null}{" "}
                      {f.alertLevel === 2 ? <StatusBadge tone="critical">2.º alerta</StatusBadge> : f.alertLevel === 1 ? <StatusBadge tone="warning">Alerta</StatusBadge> : null}
                    </p>
                    <p className="text-xs text-slate-500">{PLAN_STATUS_LABELS[f.status as PlanStatus]} · {f.reasons.join(" · ")}</p>
                  </div>
                  <form action={markPlanContactedAction.bind(null, f.planId)}>
                    <button type="submit" className={`${btnSecondary} px-2.5 py-1 text-xs`}>Contactado hoje</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Tratamentos apresentados que não avançaram" description="Rejeitados ou ainda sem decisão (valor não aceite).">
        {d.notAdvanced.length === 0 ? <EmptyNote>Nenhum.</EmptyNote> : (
          <ul className="flex flex-wrap gap-2">
            {d.notAdvanced.map((p) => (
              <li key={p.id}>
                <Link href={`/producao/planos/${p.id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  <span className="font-mono">{p.caseCode}</span>
                  <span className="tabular-nums">{euros(p.totalCents - p.acceptedCents, { round: true })}</span>
                  <span className="text-slate-500">{PLAN_STATUS_LABELS[p.status as PlanStatus]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Registar plano">
        <div className={`${card} p-5`}>
          <PlanForm
            action={createPlanAction}
            submitLabel="Gravar plano"
            caseCodes={[]}
            defaults={{ caseCode: next, presentedDate: today, diagnosed: "", total: "", phases: "1", status: "PRESENTED", accepted: "", performed: "", lastContactDate: "", nextAppointmentBooked: false, note: "" }}
          />
        </div>
      </Section>

      <Section title={`Planos apresentados · ${period.label}`}>
        {inRangeRows.length === 0 ? <EmptyNote>Sem planos neste período.</EmptyNote> : (
          <TableWrap label="Planos">
            <thead>
              <tr>
                <th className={th}>Case ID</th><th className={th}>Apresentado</th><th className={th}>Estado</th><th className={`${th} text-right`}>Fases</th>
                <th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Aceite</th><th className={`${th} text-right`}>Realizado</th>
                <th className={`${th} text-right`}>Por realizar</th><th className={th}>Último contacto</th><th className={th}>Próx. consulta</th>
              </tr>
            </thead>
            <tbody>
              {inRangeRows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={`${td} font-mono text-xs`}><Link href={`/producao/planos/${p.id}`} className="hover:underline">{p.case.code}</Link></td>
                  <td className={td}>{formatCivilDate(p.presentedDate)}</td>
                  <td className={td}>{PLAN_STATUS_LABELS[p.status as PlanStatus] ?? p.status}</td>
                  <td className={`${td} text-right`}>{p.phases}</td>
                  <td className={`${td} text-right`}>{euros(p.totalCents, { round: true })}</td>
                  <td className={`${td} text-right`}>{euros(p.acceptedCents, { round: true })}</td>
                  <td className={`${td} text-right`}>{euros(p.performedCents, { round: true })}</td>
                  <td className={`${td} text-right`}>{euros(Math.max(0, p.acceptedCents - p.performedCents), { round: true })}</td>
                  <td className={td}>{p.lastContactDate ? formatCivilDate(p.lastContactDate) : "—"}</td>
                  <td className={td}>{p.nextAppointmentBooked ? "Sim" : "Não"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Section>
    </div>
  );
}
