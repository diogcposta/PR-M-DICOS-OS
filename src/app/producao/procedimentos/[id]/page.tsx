import Link from "next/link";
import { notFound } from "next/navigation";

import { addSessionAction, deleteProcedureAction, deleteSessionAction, updateProcedureAction } from "@/app/producao/actions";
import { ConfirmButton } from "@/components/production/ConfirmButton";
import { draftFromRecord } from "@/components/production/draft";
import { SessionForm } from "@/components/production/forms";
import { ProcedureForm } from "@/components/production/ProcedureForm";
import { btnDanger, btnGhost, card, PageTitle, Section, StatCard, StatusBadge } from "@/components/production/ui";
import { nextCaseCode } from "@/modules/production/application/commands";
import { getEntryContext, getProcedure } from "@/modules/production/application/queries";
import { duration, euros, eurosPerHour } from "@/modules/production/domain/format";
import { formatCivilDate, formatTime, todayInLisbon } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Procedimento" };

export default async function ProcedurePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProcedure(id);
  if (!data) notFound();
  const { record: p, metrics: m, row } = data;
  const ctx = await getEntryContext(p.date);
  const next = await nextCaseCode(Number(p.date.slice(0, 4)));
  const lastSession = p.sessions.at(-1);

  return (
    <div className="space-y-8">
      <PageTitle
        title={p.procedureType}
        description={`${p.category} · ${formatCivilDate(p.date)}${p.caseCode ? ` · ${p.caseCode}` : ""}`}
        actions={
          <form action={deleteProcedureAction.bind(null, p.id)}>
            <ConfirmButton className={btnDanger} message="Apagar este procedimento e todas as suas consultas?">Apagar</ConfirmButton>
          </form>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Rentabilidade do procedimento">
        <StatCard label="Valor faturado" value={euros(p.billedCents)} sub={p.listPriceCents !== p.billedCents ? `tabela ${euros(p.listPriceCents)}` : undefined} />
        <StatCard label="Tempo de cadeira" value={m.chairMinutes ? duration(m.chairMinutes) : "sem dados"} sub={`${m.sessionCount} de ${p.plannedVisits} consultas`} />
        <StatCard label="Produção por hora" value={eurosPerHour(m.centsPerHour)} tone={m.lowProductivity ? "warning" : "neutral"} delta={m.lowProductivity ? "abaixo do objetivo mínimo" : null} hint="Valor faturado ÷ horas de cadeira (todas as consultas)." />
        <StatCard label="Produção líquida" value={euros(m.netCents)} sub="faturado − laboratório − outros" />
        <StatCard label="Honorários" value={euros(m.feeCents)} />
        <StatCard label="Honorários por hora" value={eurosPerHour(m.feeCentsPerHour)} />
      </section>
      {m.provisional || m.missingSessions > 0 ? (
        <p className="-mt-4 text-sm">
          <StatusBadge tone="neutral">Em curso</StatusBadge>{" "}
          <span className="text-slate-600 dark:text-slate-400">
            {m.missingSessions > 0 ? `Faltam ${m.missingSessions} consulta(s) previstas. ` : ""}O €/h é provisório até o procedimento estar concluído.
          </span>
        </p>
      ) : null}

      <Section title="Consultas deste procedimento" description="Todas as consultas contam para o mesmo procedimento: a receita é uma só e o tempo é somado.">
        <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {p.sessions.length === 0 ? <p className="p-4 text-sm text-slate-500">Sem consultas registadas — o €/h fica sem dados.</p> : null}
          {p.sessions.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <strong className="font-medium">Consulta {i + 1}</strong> · {formatCivilDate(s.date)} · {formatTime(s.startMinute)}–{formatTime(s.endMinute)}{" "}
                <span className="text-slate-500">({duration(s.endMinute - s.startMinute)})</span>
              </span>
              <form action={deleteSessionAction.bind(null, s.id)}>
                <ConfirmButton className={`${btnGhost} px-2 py-1 text-xs`} message="Apagar esta consulta?">Remover</ConfirmButton>
              </form>
            </div>
          ))}
        </div>
        <div className={`${card} p-4`}>
          <SessionForm
            action={addSessionAction.bind(null, p.id)}
            defaults={{ date: todayInLisbon(), start: lastSession ? formatTime(lastSession.startMinute) : "09:30", end: lastSession ? formatTime(lastSession.startMinute + 45) : "10:15" }}
          />
        </div>
      </Section>

      <Section title="Editar dados do procedimento" description="As horas da primeira consulta editam-se na lista de consultas acima.">
        <div className={`${card} p-5`}>
          <ProcedureForm
            mode="edit"
            action={updateProcedureAction.bind(null, p.id)}
            initial={draftFromRecord(p, row.note)}
            templates={ctx.templates}
            suggestions={ctx.suggestions}
            caseCodes={ctx.caseCodes}
            payerNames={ctx.payerNames}
            nextCaseCode={next}
            last={null}
          />
        </div>
      </Section>
      <Link href="/producao/procedimentos" className="text-sm text-blue-700 hover:underline dark:text-blue-400">← Todos os procedimentos</Link>
    </div>
  );
}
