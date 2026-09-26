import { redirect } from "next/navigation";

import { isValidCivilDate } from "@/modules/production/domain/time";

/** O detalhe de um dia é a vista de agenda desse dia. */
export default async function DayPage({ params }: { readonly params: Promise<{ date: string }> }) {
  const { date } = await params;
  redirect(isValidCivilDate(date) ? `/producao/agenda?data=${date}` : "/producao/dias");
}
