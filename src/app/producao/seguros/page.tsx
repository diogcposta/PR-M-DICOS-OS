import { PeriodPicker } from "@/components/production/PeriodPicker";
import { EmptyNote, PageTitle, Section, StatCard, StatusBadge, TableWrap, td, th } from "@/components/production/ui";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { defaultMonth, getProfitability } from "@/modules/production/application/queries";
import { PAYER_LABELS, type PayerType } from "@/modules/production/domain/constants";
import { EMPTY, euros, eurosPerHour, hours, percent } from "@/modules/production/domain/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Particular vs seguros" };

export default async function InsurancePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod({ periodo: "3m", ...flattenParams(await searchParams) }, await defaultMonth());
  const d = await getProfitability(period.from, period.to);
  const months = period.key === "mes" ? 1 : Number(period.key.replace("m", ""));

  return (
    <div className="space-y-10">
      <PageTitle title="Particular vs seguros e convenções" description={`${period.label}. Compara o mesmo procedimento com pagadores diferentes, no mesmo tempo de cadeira.`} actions={<PeriodPicker period={period} />} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Impacto das convenções">
        <StatCard label="Produção com seguros/convenções" value={euros(d.agreement.thirdPartyRevenueCents, { round: true })} sub={`${percent(d.agreement.thirdPartyShare, 0)} da produção`} />
        <StatCard label="Horas de cadeira em seguros" value={hours(d.agreement.thirdPartyMinutes)} />
        <StatCard label="Desconto face à tabela" value={euros(d.agreement.discountCents, { round: true })} sub={`≈ ${euros(Math.round(d.agreement.discountCents / months), { round: true })}/mês`} hint="Σ (valor tabelado − valor faturado) nos atos com seguro/convenção." />
        <StatCard label="Impacto no tempo (mensal)" value={euros(Math.round(d.agreement.timeValueGapCents / months), { round: true })} tone="warning" hint="O que as mesmas horas renderiam ao €/h particular do mesmo procedimento, menos o que renderam." />
      </section>

      <Section title="Por seguradora / convenção" description="€/h comparado com o €/h particular da mesma mistura de procedimentos (compara maçãs com maçãs).">
        {d.insurers.length === 0 ? <EmptyNote>Sem atos com seguro ou convenção neste período.</EmptyNote> : (
          <TableWrap label="Seguradoras">
            <thead>
              <tr>
                <th className={th}>Pagador</th><th className={`${th} text-right`}>Casos</th><th className={`${th} text-right`}>Receita</th><th className={`${th} text-right`}>Tempo</th>
                <th className={`${th} text-right`}>€/h</th><th className={`${th} text-right`}>€/h particular equiv.</th><th className={`${th} text-right`}>Diferença</th><th className={`${th} text-right`}>Desconto tabela</th>
              </tr>
            </thead>
            <tbody>
              {d.insurers.map((i) => (
                <tr key={i.payerName}>
                  <td className={`${td} font-medium`}>{i.payerName}<span className="block text-xs font-normal text-slate-500">{PAYER_LABELS[i.payerType as PayerType]}</span></td>
                  <td className={`${td} text-right`}>{i.cases}</td>
                  <td className={`${td} text-right`}>{euros(i.revenueCents, { round: true })}</td>
                  <td className={`${td} text-right`}>{hours(i.chairMinutes)}</td>
                  <td className={`${td} text-right font-semibold`}>{eurosPerHour(i.centsPerHour)}</td>
                  <td className={`${td} text-right`}>{eurosPerHour(i.privateEquivalentCph)}</td>
                  <td className={`${td} text-right`}>
                    {i.diffShare === null ? EMPTY : <StatusBadge tone={i.diffShare <= -0.3 ? "critical" : i.diffShare <= -0.15 ? "warning" : "neutral"}>{`${i.diffShare > 0 ? "+" : ""}${percent(i.diffShare, 0)}`}</StatusBadge>}
                  </td>
                  <td className={`${td} text-right`}>{euros(i.discountCents, { round: true })}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Section>

      <Section title="Por procedimento" description="Só procedimentos com casos particulares e com seguro/convenção no período.">
        {d.payer.length === 0 ? <EmptyNote>Sem procedimentos comparáveis.</EmptyNote> : (
          <TableWrap label="Particular vs seguro por procedimento">
            <thead>
              <tr>
                <th className={th}>Procedimento</th><th className={`${th} text-right`}>Preço particular</th><th className={`${th} text-right`}>Preço seguro</th>
                <th className={`${th} text-right`}>Tempo (part. / seg.)</th><th className={`${th} text-right`}>€/h particular</th><th className={`${th} text-right`}>€/h seguro</th>
                <th className={`${th} text-right`}>Diferença €/h</th><th className={`${th} text-right`}>Diferença %</th>
              </tr>
            </thead>
            <tbody>
              {d.payer.map((r) => (
                <tr key={r.procedureType}>
                  <td className={`${td} font-medium`}>{r.procedureType}<span className="block text-xs font-normal text-slate-500">{r.privateCases} part. · {r.thirdPartyCases} seguro</span></td>
                  <td className={`${td} text-right`}>{euros(r.privateAvgPriceCents === null ? null : Math.round(r.privateAvgPriceCents))}</td>
                  <td className={`${td} text-right`}>{euros(r.thirdPartyAvgPriceCents === null ? null : Math.round(r.thirdPartyAvgPriceCents))}</td>
                  <td className={`${td} text-right`}>{r.privateAvgMinutes === null ? EMPTY : `${Math.round(r.privateAvgMinutes)}`} / {r.thirdPartyAvgMinutes === null ? EMPTY : `${Math.round(r.thirdPartyAvgMinutes)} min`}</td>
                  <td className={`${td} text-right`}>{eurosPerHour(r.privateCph)}</td>
                  <td className={`${td} text-right`}>{eurosPerHour(r.thirdPartyCph)}</td>
                  <td className={`${td} text-right`}>{r.diffCph === null ? EMPTY : `${r.diffCph > 0 ? "+" : ""}${eurosPerHour(r.diffCph)}`}</td>
                  <td className={`${td} text-right font-semibold`}>{r.diffShare === null ? EMPTY : `${r.diffShare > 0 ? "+" : ""}${percent(r.diffShare, 0)}`}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Section>
    </div>
  );
}
