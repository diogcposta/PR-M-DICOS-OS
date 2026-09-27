import Link from "next/link";
import { notFound } from "next/navigation";

import { deletePlanAction, updatePlanAction } from "@/app/producao/actions";
import { ConfirmButton } from "@/components/production/ConfirmButton";
import { PlanForm } from "@/components/production/forms";
import { btnDanger, card, PageTitle } from "@/components/production/ui";
import { centsToInput } from "@/modules/production/application/parse";
import { getPlan } from "@/modules/production/application/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plano de tratamento" };

export default async function PlanPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  const money = (c: number) => (c === 0 ? "" : centsToInput(c));

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Plano ${plan.case.code}`}
        actions={
          <form action={deletePlanAction.bind(null, plan.id)}>
            <ConfirmButton className={btnDanger} message="Apagar este plano?">Apagar</ConfirmButton>
          </form>
        }
      />
      <div className={`${card} p-5`}>
        <PlanForm
          action={updatePlanAction.bind(null, plan.id)}
          submitLabel="Gravar alterações"
          caseCodes={[]}
          defaults={{
            caseCode: plan.case.code,
            presentedDate: plan.presentedDate,
            diagnosed: money(plan.diagnosedCents),
            total: money(plan.totalCents),
            phases: String(plan.phases),
            status: plan.status,
            accepted: money(plan.acceptedCents),
            performed: money(plan.performedCents),
            lastContactDate: plan.lastContactDate ?? "",
            nextAppointmentBooked: plan.nextAppointmentBooked,
            note: plan.note ?? "",
          }}
        />
      </div>
      <Link href="/producao/planos" className="text-sm text-blue-700 hover:underline dark:text-blue-400">← Planos</Link>
    </div>
  );
}
