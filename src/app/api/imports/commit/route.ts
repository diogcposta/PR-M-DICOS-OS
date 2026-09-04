import { NextResponse } from "next/server";

import { commitAppointmentFile, type RowPolicy } from "@/modules/imports/application/commit-file";
import { RequestError, readUploadRequest, toErrorResponse } from "@/app/api/imports/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROW_POLICIES: readonly RowPolicy[] = ["ALL_OR_NOTHING", "VALID_ROWS_ONLY"];

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const upload = await readUploadRequest(request);
    if (upload.mapping === null) {
      throw new RequestError(400, "É necessário enviar o mapeamento de colunas.");
    }

    // Por omissão nada é gravado parcialmente: gravar só as linhas válidas tem
    // de ser uma escolha explícita do gestor (D-008).
    const rowPolicy: RowPolicy = ROW_POLICIES.includes(upload.rowPolicy as RowPolicy)
      ? (upload.rowPolicy as RowPolicy)
      : "ALL_OR_NOTHING";

    const outcome = await commitAppointmentFile({
      organizationId: upload.organizationId,
      filename: upload.filename,
      content: upload.content,
      mapping: upload.mapping,
      rowPolicy,
      ...(upload.sheetName === undefined ? {} : { sheetName: upload.sheetName }),
      ...(upload.expectedFileHash === undefined
        ? {}
        : { expectedFileHash: upload.expectedFileHash }),
    });

    return NextResponse.json(outcome, { status: outcome.kind === "COMMITTED" ? 201 : 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
