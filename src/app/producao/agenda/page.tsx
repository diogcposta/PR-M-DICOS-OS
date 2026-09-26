import Link from "next/link";

import { deleteAbsenceAction } from "@/app/producao/actions";
import { ConfirmButton } from "@/components/production/ConfirmButton";
import { btnGhost, btnPrimary, btnSecondary, card, inputClass, PageTitle, StatCard } from "@/components/production/ui";
import { flattenParams } from "@/modules/production/application/period";
import { defaultMonth, getDay } from "@/modules/production/application/queries";
import { buildSlots, fillSlots, type AgendaEvent } from "@/modules/production/domain/agenda";
import { ABSENCE_LABELS, SLOT_OPTIONS, type AbsenceKind } from "@/modules/production/domain/constants";
import { duration, euros, eurosPerHour, hours, percent } from "@/modules/production/domain/format";
import { agendaEfficiency, dayAvailableMinutes } from "@/modules/production/domain/monthly";
import { addDays, formatCivilDate, formatTime, isValidCivilDate, isoWeekday, monthRange, todayInLisbon, weekdayName } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda do dia" };

const STATE_STYLE = {
  free: "border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900",
  worked: "border-slate-200 bg-blue-50 text-slate-900 dark:border-slate-700 dark:bg-blue-950/40 dark:text-white",
  absence: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200",
  mixed: "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white",
} as const;
const STATE_LABEL = { free: "Livre", worked: "Ocupado", absence: "Falta", mixed: "Falta + recuperado" } as const;

export default async function AgendaPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = flattenParams(await searchParams);
  const fallback = monthRange(await defaultMonth()).to < todayInLisbon() ? monthRange(await defaultMonth()).to : todayInLisbon();
  const date = params.data && isValidCivilDate(params.data) ? params.data : fallback;
  const data = await getDay(date);
  const slot = SLOT_OPTIONS.find((s) => String(s) === params.slot) ?? data.profile.standardSlotMinutes;

  const weekday = isoWeekday(date);
  const scheduleBlocks = data.schedule.filter((b) => b.weekday === weekday);
  // Sem horário habitual para o dia (ex.: sábado ocasional), usa o dia clínico registado.
  const blocks =
    scheduleBlocks.length > 0
      ? scheduleBlocks
      : data.day
        ? [{ startMinute: data.day.startMinute, endMinute: data.day.endMinute }]
        : [];

  const events: AgendaEvent[] = [
    ...data.sessions.map((s) => ({
      kind: "session" as const,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
      label: s.procedure.procedureType,
      detail: s.procedure.case?.code ?? undefined,
      href: `/producao/procedimentos/${s.procedureId}`,
    })),
    ...data.absences.map((a) => ({
      kind: "absence" as const,
      startMinute: a.startMinute,
      endMinute: a.startMinute + a.durationMinutes,
      label: ABSENCE_LABELS[a.kind as AbsenceKind] ?? a.kind,
      detail: a.plannedProcedure ?? undefined,
    })),
  ];
  const slots = fillSlots(buildSlots(blocks, slot), events);
  const dayRecord = data.day ? [{ ...data.day }] : [];
  const efficiency = agendaEfficiency(dayRecord, data.sessions, data.absences);
  const production = data.procedures.reduce((s, p) => s + p.billedCents, 0);
  const available = data.day ? dayAvailableMinutes(data.day) : 0;

  return (
    <div className="space-y-8">
      <PageTitle
        title={`Agenda · ${weekdayName(weekday)}, ${formatCivilDate(date)}`}
        description="Slots gerados a partir do horário; ocupação a partir das consultas e faltas registadas."
        actions={
          <>
            <Link className={btnSecondary} href={`/producao/agenda?data=${addDays(date, -1)}&slot=${slot}`} aria-label="Dia anterior">←</Link>
            <form method="get" className="flex items-end gap-2">
              <input type="date" name="data" defaultValue={date} className={`${inputClass} w-40`} aria-label="Data" />
              <select name="slot" defaultValue={String(slot)} className={`${inputClass} w-28`} aria-label="Duração do slot">
                {SLOT_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s} min</option>
                ))}
              </select>
              <button className={btnSecondary} type="submit">Ver</button>
            </form>
            <Link className={btnSecondary} href={`/producao/agenda?data=${addDays(date, 1)}&slot=${slot}`} aria-label="Dia seguinte">→</Link>
            <Link className={btnPrimary} href={`/producao/procedimentos/novo?data=${date}`}>+ Procedimento</Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Resumo do dia">
        <StatCard label="Horas disponíveis" value={data.day ? hours(available) : "sem registo"} sub={data.day ? `${formatTime(data.day.startMinute)}–${formatTime(data.day.endMinute)} · pausa ${data.day.breakMinutes} min` : "registe o dia clínico"} />
        <StatCard label="Horas trabalhadas" value={hours(efficiency.workedMinutes)} />
        <StatCard label="Perdidas por faltas" value={hours(efficiency.lostMinutes)} />
        <StatCard label="Ocupação teórica → real" value={`${percent(efficiency.theoreticalOccupancy, 0)} → ${percent(efficiency.realOccupancy, 0)}`} />
        <StatCard label="Produção do dia" value={euros(production, { round: true })} />
        <StatCard label="€/hora do dia" value={eurosPerHour(available ? (production * 60) / available : null)} />
      </section>

      {!data.day ? (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          ⚠ Este dia não tem registo de dia clínico: as consultas não entram nas horas disponíveis. <Link className="underline" href="/producao/dias">Registar dia</Link>
        </p>
      ) : null}

      {blocks.length === 0 ? (
        <p className="text-sm text-slate-500">Sem horário para este dia.</p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={`Slots de ${slot} minutos`}>
          {slots.map((s) => (
            <li key={s.startMinute} className={`rounded-lg border px-3 py-2.5 ${STATE_STYLE[s.state]}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums">{formatTime(s.startMinute)}</span>
                <span className="text-xs">{STATE_LABEL[s.state]} · {s.endMinute - s.startMinute} min</span>
              </div>
              {s.events.map((ev, i) => (
                <p key={i} className="mt-1 truncate text-xs">
                  {ev.href ? <Link href={ev.href} className="hover:underline">{ev.label}</Link> : ev.label}
                  <span className="opacity-70"> · {formatTime(ev.startMinute)}–{formatTime(ev.endMinute)}{ev.detail ? ` · ${ev.detail}` : ""}</span>
                </p>
              ))}
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Dica: comparar slots de 30, 45, 60 ou 90 min ajuda a ver onde a agenda rígida de 45 min deixa tempo por usar
        ou força consultas a ultrapassar o slot.
      </p>

      {data.absences.length > 0 ? (
        <section className={`${card} divide-y divide-slate-100 dark:divide-slate-800`} aria-label="Faltas do dia">
          {data.absences.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                {formatTime(a.startMinute)} · {ABSENCE_LABELS[a.kind as AbsenceKind]} · {a.plannedProcedure ?? "—"} · {duration(a.durationMinutes)} · {euros(a.estimatedValueCents)}
                {a.slotRecovered ? ` · recuperado (${euros(a.recoveredValueCents)})` : ""}
              </span>
              <form action={deleteAbsenceAction.bind(null, a.id)}>
                <ConfirmButton className={`${btnGhost} px-2 py-1 text-xs`} message="Apagar esta falta?">Apagar</ConfirmButton>
              </form>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
