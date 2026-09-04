import { NextResponse } from "next/server";

import { inspectFile } from "@/modules/imports/application/inspect-file";
import { readUploadRequest, toErrorResponse } from "@/app/api/imports/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const upload = await readUploadRequest(request);
    const preview = await inspectFile({
      organizationId: upload.organizationId,
      filename: upload.filename,
      content: upload.content,
    });
    return NextResponse.json(preview);
  } catch (error) {
    return toErrorResponse(error);
  }
}
