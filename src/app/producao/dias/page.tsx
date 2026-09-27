import Link from "next/link";

import { deleteDayAction, saveDayAction } from "@/app/producao/actions";
import { ConfirmButton } from "@/components/production/ConfirmButton";
import { DayForm } from "@/components/production/forms";
import { PeriodPicker } from "@/components/production/PeriodPicker";
import { btnGhost, card, EmptyNote, PageTitle, Section, StatusBadge, TableWrap, td, th } from "@/components/production/ui";
import { flattenParams, parsePeriod } from "@/modules/production/application/period";
import { getSettings } from "@/modules/production/application/profile";
import { defaultMonth, listClinicalDays } from "@/modules/production/application/queries";
import { dayAvailableMinutes } from "@/modules/production/domain/monthly";
import { euros, eurosPerHour, hours } from "@/modules/production/domain/format";
import { formatCivilDate, formatTime, isoWeekday, todayInLisbon, weekdayName } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dias clínicos" };

export default async function DaysPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod(flattenParams(await searchParams), await defaultMonth());
  const [days, settings] = await Promise.all([listClinicalDays(period.from, period.to), getSettings()]);
  const today = todayInLisbon();
  const blocks = settings.schedule.filter((b) => b.weekday === isoWeekday(today));
  const first = blocks[0];
  const last = blocks.at(-1);
  const scheduled = blocks.reduce((s, b) => s + b.endMinute - b.startMinute, 0);
  const span = first && last ? last.endMinute - first.startMinute : 0;

  const worked = days.filter((d) => d.status === "WORKED");
  const totalMinutes = worked.reduce((s, d) => s + dayAvailableMinutes(d), 0);
  const totalProduction = worked.reduce((s, d) => s + d.productionCents, 0);

  return (
    <div className="space-y-8">
      <PageTitle title="Dias clínicos" description="Cada dia define as horas clínicas disponíveis. Depois, registe os atos realizados nesse dia." actions={<PeriodPicker period={period} />} />

      <Section title="Registar dia clínico" description={`O horário habitual de ${weekdayName(isoWeekday(today))} vem pré-preenchido (Definições).`}>
        <div className={`${card} p-5`}>
          <DayForm
            action={saveDayAction}
            defaults={{
              date: today,
              start: first ? formatTime(first.startMinute) : "09:30",
              end: last ? formatTime(last.endMinute) : "19:00",
              breakMinutes: String(first ? span - scheduled : 120),
            }}
          />
        </div>
      </Section>

      <Section title={`Dias em ${period.label}`} description={`${worked.length} dias realizados · ${hours(totalMinutes)} · ${euros(totalProduction, { round: true })} · ${eurosPerHour(totalMinutes ? (totalProduction * 60) / totalMinutes : null)}`}>
        {days.length === 0 ? (
          <EmptyNote>Sem dias registados neste período.</EmptyNote>
        ) : (
          <TableWrap label="Dias clínicos">
            <thead>
              <tr>
                <th className={th}>Data</th>
                <th className={th}>Horário</th>
                <th className={`${th} text-right`}>Pausa</th>
                <th className={`${th} text-right`}>Horas disponíveis</th>
                <th className={`${th} text-right`}>Consultas</th>
                <th className={`${th} text-right`}>Produção</th>
                <th className={`${th} text-right`}>€/h</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const minutes = dayAvailableMinutes(d);
                return (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className={`${td} font-medium`}>
                      <Link href={`/producao/dias/${d.date}`} className="hover:underline">{formatCivilDate(d.date)}</Link>{" "}
                      <span className="text-xs font-normal text-slate-500">{weekdayName(isoWeekday(d.date))}</span>{" "}
                      {d.status === "PLANNED" ? <StatusBadge tone="neutral">Previsto</StatusBadge> : null}
                    </td>
                    <td className={td}>{formatTime(d.startMinute)}–{formatTime(d.endMinute)}</td>
                    <td className={`${td} text-right`}>{d.breakMinutes} min</td>
                    <td className={`${td} text-right`}>{hours(minutes)}</td>
                    <td className={`${td} text-right`}>{d.sessionCount}</td>
                    <td className={`${td} text-right`}>{euros(d.productionCents, { round: true })}</td>
                    <td className={`${td} text-right`}>{d.status === "WORKED" ? eurosPerHour(minutes ? (d.productionCents * 60) / minutes : null) : "—"}</td>
                    <td className={`${td} text-right`}>
                      <form action={deleteDayAction.bind(null, d.id)}>
                        <ConfirmButton className={`${btnGhost} px-2 py-1 text-xs`} message="Apagar este dia clínico? Os procedimentos mantêm-se.">Apagar</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Section>
    </div>
  );
}
