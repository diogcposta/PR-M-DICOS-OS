import { deleteTemplateAction, saveSettingsAction, saveTemplateAction, toggleFavoriteAction } from "@/app/producao/actions";
import { ConfirmButton } from "@/components/production/ConfirmButton";
import { SettingsForm, TemplateForm } from "@/components/production/forms";
import { btnGhost, card, PageTitle, Section } from "@/components/production/ui";
import { bpsToInput, centsToInput } from "@/modules/production/application/parse";
import { getSettings } from "@/modules/production/application/profile";
import { PROCEDURE_CATEGORIES } from "@/modules/production/domain/constants";
import { euros } from "@/modules/production/domain/format";
import { formatTime } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Definições" };

export default async function SettingsPage() {
  const { profile, schedule, goals, scenarios, templates } = await getSettings();
  const scheduleMap: Record<string, string> = {};
  const perDay = new Map<number, number>();
  for (const b of schedule) {
    const i = perDay.get(b.weekday) ?? 0;
    perDay.set(b.weekday, i + 1);
    if (i > 1) continue;
    scheduleMap[`s_${b.weekday}_${i}_start`] = formatTime(b.startMinute);
    scheduleMap[`s_${b.weekday}_${i}_end`] = formatTime(b.endMinute);
  }

  return (
    <div className="space-y-10">
      <PageTitle title="Definições" description="Todos os parâmetros são editáveis. Os valores iniciais seguem o pedido: 50%, segunda a sexta 09:30–12:30 e 14:30–19:00, consulta de 45 min." />
      <div className={`${card} p-5 sm:p-6`}>
        <SettingsForm
          action={saveSettingsAction}
          defaults={{
            name: profile.name,
            feePercent: bpsToInput(profile.feeBps),
            feeBase: profile.feeBase,
            standardSlotMinutes: String(profile.standardSlotMinutes),
            saturdayMinutes: String(profile.saturdayMinutes),
            primaryGoal: centsToInput(profile.primaryGoalCentsPerHour),
            targetNoShowPercent: bpsToInput(profile.targetNoShowBps),
            followUpMin: centsToInput(profile.followUpMinCents),
            followUpPriority: centsToInput(profile.followUpPriorityCents),
            followUpFirstAlertDays: String(profile.followUpFirstAlertDays),
            followUpSecondAlertDays: String(profile.followUpSecondAlertDays),
            schedule: scheduleMap,
            goals: goals.map((g) => ({ label: g.label, value: centsToInput(g.centsPerHour) })),
            scenarios: scenarios.map((s) => ({ name: s.name, value: s.centsPerHour === null ? "" : centsToInput(s.centsPerHour), hours: String(s.hoursPerMonth).replace(".", ",") })),
          }}
        />
      </div>

      <Section id="templates" title="Templates e favoritos" description="Usados no registo rápido. ★ = aparece como botão de um clique.">
        <ul className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <form action={toggleFavoriteAction.bind(null, t.id)} className="inline">
                  <button type="submit" aria-label={t.favorite ? "Remover dos favoritos" : "Marcar como favorito"} className="mr-2 text-base">{t.favorite ? "★" : "☆"}</button>
                </form>
                <strong className="font-medium">{t.name}</strong>{" "}
                <span className="text-slate-500">· {t.category} · {euros(t.priceCents)} · {t.durationMinutes} min · {t.plannedVisits} consulta(s){t.labCostCents ? ` · lab ${euros(t.labCostCents)}` : ""}</span>
              </span>
              <form action={deleteTemplateAction.bind(null, t.id)}>
                <ConfirmButton className={`${btnGhost} px-2 py-1 text-xs`} message="Apagar este template?">Apagar</ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <div className={`${card} p-5`}>
          <TemplateForm action={saveTemplateAction} categories={PROCEDURE_CATEGORIES} />
        </div>
      </Section>
    </div>
  );
}
