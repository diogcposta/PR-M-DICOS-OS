import Link from "next/link";

import { createProcedureAction } from "@/app/producao/actions";
import { draftFromRecord, emptyDraft } from "@/components/production/draft";
import { ProcedureForm } from "@/components/production/ProcedureForm";
import { card, PageTitle, TextLink } from "@/components/production/ui";
import { nextCaseCode } from "@/modules/production/application/commands";
import { flattenParams } from "@/modules/production/application/period";
import { getSettings } from "@/modules/production/application/profile";
import { getEntryContext } from "@/modules/production/application/queries";
import { formatCivilDate, isValidCivilDate, isoWeekday, todayInLisbon } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registar procedimento" };

export default async function NewProcedurePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = flattenParams(await searchParams);
  const date = params.data && isValidCivilDate(params.data) ? params.data : todayInLisbon();
  const ctx = await getEntryContext(date);
  const next = await nextCaseCode(Number(date.slice(0, 4)));
  const { schedule } = await getSettings();
  const start = ctx.nextStartMinute ?? schedule.find((b) => b.weekday === isoWeekday(date))?.startMinute ?? 9 * 60 + 30;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Registar procedimento"
        description={`Para ${formatCivilDate(date)}. Um procedimento tem uma única receita; para tratamentos em várias consultas, registe o procedimento uma vez e acrescente as consultas seguintes na página do procedimento.`}
        actions={<Link href={`/producao/dias/${date}`} className="text-sm text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">Ver o dia →</Link>}
      />
      <div className={`${card} p-5 sm:p-6`}>
        <ProcedureForm
          action={createProcedureAction}
          initial={emptyDraft(date, start)}
          templates={ctx.templates}
          suggestions={ctx.suggestions}
          caseCodes={ctx.caseCodes}
          payerNames={ctx.payerNames}
          nextCaseCode={next}
          last={ctx.last ? draftFromRecord(ctx.last) : null}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Privacidade: não registe nomes, números de utente, telefones ou dados clínicos identificáveis. Use apenas o Case ID.
        Gerir templates e favoritos em <TextLink href="/producao/definicoes#templates">Definições</TextLink>.
      </p>
    </div>
  );
}
