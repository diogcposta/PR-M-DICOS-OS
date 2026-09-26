import { Simulator } from "@/components/production/Simulator";
import { PageTitle } from "@/components/production/ui";
import { getSettings } from "@/modules/production/application/profile";
import { defaultMonth, monthlySummaries } from "@/modules/production/application/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "What if?" };

export default async function SimulatorPage() {
  const month = await defaultMonth();
  const [summaries, settings] = await Promise.all([monthlySummaries(month, 3), getSettings()]);
  const current = summaries.at(-1)!;
  // Médias dos últimos 3 meses para os parâmetros de planos (um mês só é ruidoso).
  const presented = summaries.reduce((s, m) => s + m.plans.presentedCount, 0);
  const presentedCents = summaries.reduce((s, m) => s + m.plans.presentedCents, 0);
  const accepted = summaries.reduce((s, m) => s + m.plans.acceptedCents, 0);
  const actual = settings.scenarios.find((s) => s.centsPerHour === null);

  return (
    <div className="space-y-8">
      <PageTitle
        title="What if?"
        description="Altere os parâmetros e veja o impacto imediato. Ponto de partida: valores medidos no mês mais recente (planos: média de 3 meses)."
      />
      <Simulator
        measuredCph={current.centsPerHour}
        goals={settings.goals.map((g) => ({ label: g.label, centsPerHour: g.centsPerHour }))}
        scenarios={settings.scenarios.map((s) => ({ name: s.name, centsPerHour: s.centsPerHour, hoursPerMonth: s.hoursPerMonth }))}
        initial={{
          hoursPerMonth: actual?.hoursPerMonth ?? 146,
          centsPerHour: current.centsPerHour ?? settings.profile.primaryGoalCentsPerHour,
          feeBps: settings.profile.feeBps,
          baselineNoShowRate: current.absences.missedRate ?? 0,
          noShowRate: current.absences.missedRate ?? 0,
          acceptanceRate: presentedCents ? accepted / presentedCents : 0.5,
          avgPlanCents: presented ? Math.round(presentedCents / presented) : 100_000,
          plansPerMonth: Math.round(presented / summaries.length),
          workingMonths: 11,
        }}
      />
    </div>
  );
}
