import { getMonthlyReport } from "@/modules/production/application/queries";
import { reportMarkdown } from "@/modules/production/application/report";
import { isValidCivilMonth } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("mes") ?? "";
  if (!isValidCivilMonth(month)) return new Response("Mês inválido (aaaa-mm).", { status: 400 });
  const markdown = reportMarkdown(await getMonthlyReport(month));
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${month}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
