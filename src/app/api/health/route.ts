/**
 * Saúde da aplicação.
 *
 * Deliberadamente sem acesso à base de dados: responde à pergunta "a aplicação
 * arrancou e a configuração é válida?". A saúde da base de dados é uma verificação
 * distinta e será acrescentada quando houver algo que dependa dela em produção.
 */
import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  const env = serverEnv();
  return NextResponse.json({
    status: "ok",
    timezone: env.APP_TIMEZONE,
    aiProvider: env.AI_PROVIDER,
  });
}
