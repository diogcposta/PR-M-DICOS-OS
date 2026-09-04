import { NextResponse } from "next/server";

import { analyzeFile } from "@/modules/imports/application/validate-file";
import { RequestError, readUploadRequest, toErrorResponse } from "@/app/api/imports/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Número de erros devolvidos ao ecrã. O total continua nas contagens. */
const ISSUE_LIMIT = 200;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const upload = await readUploadRequest(request);
    if (upload.mapping === null) {
      throw new RequestError(400, "É necessário enviar o mapeamento de colunas.");
    }

    const analysis = await analyzeFile({
      organizationId: upload.organizationId,
      filename: upload.filename,
      content: upload.content,
      mapping: upload.mapping,
      ...(upload.sheetName === undefined ? {} : { sheetName: upload.sheetName }),
    });

    return NextResponse.json({
      fileHash: analysis.fileHash,
      sheetName: analysis.sheetName,
      rowsTotal: analysis.rowsTotal,
      rowsValid: analysis.rowsValid,
      rowsInvalid: analysis.rowsInvalid,
      duplicateRowsInFile: analysis.duplicateRowsInFile,
      unmappedRequiredFields: analysis.unmappedRequiredFields,
      issues: analysis.issues.slice(0, ISSUE_LIMIT),
      issuesTruncated: analysis.issues.length > ISSUE_LIMIT,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
