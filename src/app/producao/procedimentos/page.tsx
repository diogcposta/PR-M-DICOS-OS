import Link from "next/link";

import { PeriodPicker } from "@/components/production/PeriodPicker";
import { btnPrimary, EmptyNote, PageTitle, StatusBadge, TableWrap, td, th } from "@/components/production/ui";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { defaultMonth, getProfitability } from "@/modules/production/application/queries";
import { PAYER_LABELS, type PayerType } from "@/modules/production/domain/constants";
import { duration, euros, eurosPerHour } from "@/modules/production/domain/format";
import { formatCivilDate } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Procedimentos" };

export default async function ProceduresPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod(flattenParams(await searchParams), await defaultMonth());
  const data = await getProfitability(period.from, period.to);
  const rows = [...data.perProcedure].reverse();

  return (
    <div className="space-y-6">
      <PageTitle
        title="Procedimentos"
        description={`${period.label} · ${rows.length} procedimentos. €/h = valor faturado ÷ horas de cadeira de todas as consultas do procedimento.`}
        actions={
          <>
            <PeriodPicker period={period} />
            <Link href="/producao/procedimentos/novo" className={btnPrimary}>+ Registar</Link>
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyNote>Sem procedimentos neste período.</EmptyNote>
      ) : (
        <TableWrap label="Lista de procedimentos">
          <thead>
            <tr>
              <th className={th}>Data</th>
              <th className={th}>Procedimento</th>
              <th className={th}>Case ID</th>
              <th className={th}>Pagador</th>
              <th className={`${th} text-right`}>Faturado</th>
              <th className={`${th} text-right`}>Tempo</th>
              <th className={`${th} text-right`}>€/h</th>
              <th className={`${th} text-right`}>Honorários</th>
              <th className={`${th} text-right`}>Hon./h</th>
              <th className={`${th} text-right`}>Custos</th>
              <th className={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ record: p, metrics: m }) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className={td}>{formatCivilDate(p.date)}</td>
                <td className={`${td} font-medium`}>
                  <Link href={`/producao/procedimentos/${p.id}`} className="hover:underline">{p.procedureType}</Link>
                  <span className="block text-xs font-normal text-slate-500">{p.category}</span>
                </td>
                <td className={td}>{p.caseCode ?? "—"}</td>
                <td className={td}>{PAYER_LABELS[p.payerType as PayerType] ?? p.payerType}{p.payerName ? <span className="block text-xs text-slate-500">{p.payerName}</span> : null}</td>
                <td className={`${td} text-right`}>{euros(p.billedCents)}</td>
                <td className={`${td} text-right`}>{m.chairMinutes ? duration(m.chairMinutes) : "—"}<span className="block text-xs text-slate-500">{m.sessionCount}/{p.plannedVisits} consultas</span></td>
                <td className={`${td} text-right font-medium`}>{eurosPerHour(m.centsPerHour)}</td>
                <td className={`${td} text-right`}>{euros(m.feeCents)}</td>
                <td className={`${td} text-right`}>{eurosPerHour(m.feeCentsPerHour)}</td>
                <td className={`${td} text-right`}>{m.directCostsCents ? euros(m.directCostsCents) : "—"}</td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1">
                    {m.lowProductivity ? <StatusBadge tone="warning">Baixa produtividade</StatusBadge> : null}
                    {m.provisional ? <StatusBadge tone="neutral">Em curso</StatusBadge> : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
