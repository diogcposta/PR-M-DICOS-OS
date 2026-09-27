import { HorizontalBars } from "@/components/production/charts";
import { PeriodPicker } from "@/components/production/PeriodPicker";
import { ProfitabilityTable } from "@/components/production/ProfitabilityTable";
import { card, EmptyNote, PageTitle, Section, StatCard, StatusBadge, TableWrap, td, th } from "@/components/production/ui";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { defaultMonth, getProfitability } from "@/modules/production/application/queries";
import { duration, euros, eurosPerHour, hours, percent } from "@/modules/production/domain/format";
import { topAndBottom, type ProfitabilityRow } from "@/modules/production/domain/metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rentabilidade" };

function TopList({ title, rows, reference }: { readonly title: string; readonly rows: readonly ProfitabilityRow[]; readonly reference: number | null }) {
  return (
    <div className={`${card} p-5`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <ol className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate"><span className="mr-2 text-slate-400 tabular-nums">{i + 1}.</span>{r.key}</span>
            <span className="shrink-0 tabular-nums font-semibold">{eurosPerHour(r.centsPerHour)}</span>
          </li>
        ))}
      </ol>
      {reference !== null ? <p className="mt-3 text-xs text-slate-500">Média global: {eurosPerHour(reference)} por hora de cadeira.</p> : null}
    </div>
  );
}

export default async function ProfitabilityPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod({ periodo: "3m", ...flattenParams(await searchParams) }, await defaultMonth());
  const d = await getProfitability(period.from, period.to);
  const { top, bottom } = topAndBottom(d.byType, 5);
  const lowCases = d.cases.cases.filter((c) => c.highValueLowProductivity);
  const lowProcedures = d.byType.filter((r) => r.centsPerHour !== null && d.lowestGoalCph !== null && r.centsPerHour < d.lowestGoalCph && r.revenueCents > 0);

  return (
    <div className="space-y-10">
      <PageTitle
        title="Rentabilidade por procedimento"
        description={`${period.label}. €/h = receita ÷ horas de cadeira (todas as consultas do procedimento). Descreve números — a indicação clínica decide sempre o tratamento.`}
        actions={<PeriodPicker period={period} />}
      />

      {d.procedures.length === 0 ? <EmptyNote>Sem procedimentos neste período.</EmptyNote> : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Resumo">
            <StatCard label="€/h médio de cadeira" value={eurosPerHour(d.overallChairCph)} hint="Receita dos atos com tempo ÷ horas de cadeira." />
            <StatCard label="Receita" value={euros(d.byType.reduce((s, r) => s + r.revenueCents, 0), { round: true })} />
            <StatCard label="Horas de cadeira" value={hours(d.byType.reduce((s, r) => s + r.chairMinutes, 0))} />
            <StatCard label="Custos diretos" value={euros(d.byType.reduce((s, r) => s + r.costsCents, 0), { round: true })} sub="laboratório + outros" />
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <TopList title="Top 5 mais produtivos (€/h)" rows={top} reference={d.overallChairCph} />
            <TopList title="Top 5 menos produtivos (€/h)" rows={bottom} reference={d.overallChairCph} />
          </div>

          <Section title="Matriz de rentabilidade" description="Clique para ordenar. Procedimentos sem horas registadas contam na receita mas não no €/h.">
            <ProfitabilityTable rows={d.byType} lowestGoalCph={d.lowestGoalCph} referenceCph={d.overallChairCph} />
          </Section>

          <Section title="€/h por categoria" description="Linha tracejada: média global por hora de cadeira.">
            <div className={`${card} p-4`}>
              <HorizontalBars
                name="€/h por categoria"
                kind="eurosPerHour"
                reference={d.overallChairCph === null ? null : d.overallChairCph / 100}
                data={d.byCategory.filter((r) => r.centsPerHour !== null).sort((a, b) => (b.centsPerHour ?? 0) - (a.centsPerHour ?? 0)).map((r) => ({ label: r.key, value: (r.centsPerHour ?? 0) / 100 }))}
              />
              <details className="mt-2 text-xs text-slate-500">
                <summary className="cursor-pointer">Ver tabela (horas vs faturação)</summary>
                <table className="mt-2 w-full tabular-nums">
                  <thead><tr className="text-left"><th>Categoria</th><th className="text-right">% horas</th><th className="text-right">% faturação</th><th className="text-right">€/h</th></tr></thead>
                  <tbody>{d.byCategory.map((r) => <tr key={r.key}><td>{r.key}</td><td className="text-right">{percent(r.hoursShare, 0)}</td><td className="text-right">{percent(r.revenueShare, 0)}</td><td className="text-right">{eurosPerHour(r.centsPerHour)}</td></tr>)}</tbody>
                </table>
              </details>
            </div>
          </Section>

          {lowProcedures.length > 0 ? (
            <Section title="Procedimentos com baixa produtividade" description={`Abaixo do objetivo mínimo (${eurosPerHour(d.lowestGoalCph)}). Ponto de partida para rever protocolo de tempo, tabela ou convenção.`}>
              <ul className="flex flex-wrap gap-2">
                {lowProcedures.map((r) => (
                  <li key={r.key}><StatusBadge tone="warning">{`${r.key}: ${eurosPerHour(r.centsPerHour)}`}</StatusBadge></li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section
            id="casos"
            title="Casos com vários procedimentos e consultas"
            description={`Receita total do Case ID ÷ tempo total de todas as consultas. Valor elevado (≥ €500) com €/h mais de 25% abaixo da média dos casos de valor elevado (${eurosPerHour(d.cases.highValueReferenceCph)}) é assinalado.`}
          >
            {lowCases.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                <strong>{lowCases.length} {lowCases.length === 1 ? "caso" : "casos"} de valor elevado com produtividade relativamente baixa.</strong>{" "}
                Ex.: {lowCases[0]!.caseCode} — {euros(lowCases[0]!.billedCents)} em {duration(lowCases[0]!.chairMinutes)} = {eurosPerHour(lowCases[0]!.centsPerHour)}
                {lowCases[0]!.weakestProcedure ? ` (${lowCases[0]!.weakestProcedure.type}: ${eurosPerHour(lowCases[0]!.weakestProcedure.centsPerHour)})` : ""}.
              </div>
            ) : null}
            <TableWrap label="Casos">
              <thead>
                <tr>
                  <th className={th}>Case ID</th><th className={th}>Procedimentos</th><th className={`${th} text-right`}>Consultas</th>
                  <th className={`${th} text-right`}>Valor total</th><th className={`${th} text-right`}>Tempo total</th><th className={`${th} text-right`}>€/h</th><th className={th}>Sinal</th>
                </tr>
              </thead>
              <tbody>
                {d.cases.cases.slice(0, 40).map((c) => (
                  <tr key={c.caseCode}>
                    <td className={`${td} font-mono text-xs`}>{c.caseCode}</td>
                    <td className={td}>{c.procedureTypes.join(" + ")}</td>
                    <td className={`${td} text-right`}>{c.sessionCount}</td>
                    <td className={`${td} text-right`}>{euros(c.billedCents)}</td>
                    <td className={`${td} text-right`}>{c.chairMinutes ? duration(c.chairMinutes) : "—"}</td>
                    <td className={`${td} text-right font-semibold`}>{eurosPerHour(c.centsPerHour)}</td>
                    <td className={td}>
                      {c.highValueLowProductivity ? <StatusBadge tone="warning">Valor elevado, €/h baixo</StatusBadge> : null}
                      {!c.completed ? <StatusBadge tone="neutral">Em curso</StatusBadge> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Section>
        </>
      )}
    </div>
  );
}
