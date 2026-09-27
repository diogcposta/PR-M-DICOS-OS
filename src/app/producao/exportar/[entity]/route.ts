import { ENTITIES, exportEntity, type Entity } from "@/modules/production/application/data-transfer";
import { todayInLisbon } from "@/modules/production/domain/time";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!ENTITIES.includes(entity as Entity)) {
    return new Response("Exportação desconhecida.", { status: 404 });
  }
  const csv = await exportEntity(entity as Entity);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="producao-${entity}-${todayInLisbon()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
