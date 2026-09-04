/**
 * Utilitários partilhados pelas rotas de importação.
 *
 * As rotas limitam-se a extrair o pedido, delegar num serviço de aplicação e
 * traduzir erros. Nenhuma regra de negócio vive aqui.
 */
import { NextResponse } from "next/server";

import {
  appointmentMappingSchema,
  type AppointmentMapping,
} from "@/modules/imports/domain/appointment-profile";
import { MAX_UPLOAD_BYTES } from "@/modules/imports/domain/contract";
import { FileRejectedError } from "@/modules/imports/infrastructure/file-parser";
import { getCurrentOrganization } from "@/modules/organizations/application/get-current-organization";

export interface UploadRequest {
  readonly organizationId: string;
  readonly filename: string;
  readonly content: Buffer;
  readonly mapping: AppointmentMapping | null;
  readonly sheetName: string | undefined;
  readonly rowPolicy: string | null;
  readonly expectedFileHash: string | undefined;
}

export class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

export async function readUploadRequest(request: Request): Promise<UploadRequest> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    throw new RequestError(400, "Não existe nenhuma organização configurada. Execute o seed.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new RequestError(400, "Pedido inválido: esperado um envio de ficheiro.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new RequestError(400, "Nenhum ficheiro foi enviado.");
  }

  // Rejeitar pelo tamanho declarado antes de o ler para memória.
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new RequestError(
      413,
      `O ficheiro excede o limite de ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
    );
  }

  const content = Buffer.from(await file.arrayBuffer());

  let mapping: AppointmentMapping | null = null;
  const rawMapping = form.get("mapping");
  if (typeof rawMapping === "string" && rawMapping.length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawMapping);
    } catch {
      throw new RequestError(400, "Mapeamento inválido: JSON mal formado.");
    }
    const result = appointmentMappingSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new RequestError(400, "Mapeamento inválido para o contrato de consulta.");
    }
    mapping = result.data;
  }

  const sheetName = form.get("sheetName");
  const rowPolicy = form.get("rowPolicy");
  const expectedFileHash = form.get("expectedFileHash");

  return {
    organizationId: organization.id,
    filename: file.name,
    content,
    mapping,
    sheetName: typeof sheetName === "string" && sheetName.length > 0 ? sheetName : undefined,
    rowPolicy: typeof rowPolicy === "string" ? rowPolicy : null,
    expectedFileHash:
      typeof expectedFileHash === "string" && expectedFileHash.length > 0
        ? expectedFileHash
        : undefined,
  };
}

/** Traduz erros conhecidos em respostas com mensagem compreensível. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof RequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof FileRejectedError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 415 });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Erro inesperado ao processar o ficheiro." }, { status: 500 });
}
