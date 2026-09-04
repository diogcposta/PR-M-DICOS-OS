"use client";

/**
 * Fluxo de importação: ficheiro → pré-visualização → mapeamento → validação →
 * confirmação.
 *
 * O ficheiro fica no browser e é reenviado em cada passo. O servidor não guarda
 * o conteúdo (D-007), por isso não há estado de sessão para expirar nem ficheiros
 * temporários para limpar. O servidor confirma o hash na gravação para garantir
 * que é o mesmo ficheiro que foi pré-visualizado.
 */
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import {
  APPOINTMENT_FIELDS,
  type AppointmentMapping,
  appointmentFieldKeys,
} from "@/modules/imports/domain/appointment-profile";

interface SheetPreview {
  name: string;
  headers: string[];
  rowCount: number;
  sampleRows: (string | null)[][];
}

interface Preview {
  fileHash: string;
  fileSizeBytes: number;
  kind: string;
  detectedDelimiter: string | null;
  sheets: SheetPreview[];
  suggestedMapping: AppointmentMapping;
  unmappedRequiredFields: string[];
  alreadyCommitted: { batchId: string; originalFilename: string } | null;
}

interface Issue {
  sourceRowNumber: number;
  columnName: string | null;
  code: string;
  message: string;
  severity: "WARNING" | "ERROR";
}

interface ValidationReport {
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  duplicateRowsInFile: number;
  unmappedRequiredFields: string[];
  issues: Issue[];
  issuesTruncated: boolean;
}

type CommitResult =
  | {
      kind: "COMMITTED";
      batchId: string;
      rowsTotal: number;
      rowsAccepted: number;
      rowsRejected: number;
      rowsIgnored: number;
    }
  | { kind: "DUPLICATE"; batchId: string; previousBatchId: string }
  | { kind: "REJECTED"; batchId: string; reason: string };

export function ImportWizard() {
  const router = useRouter();
  const fileRef = useRef<File | null>(null);

  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<AppointmentMapping | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "validate" | "commit">(null);

  const post = useCallback(
    async (endpoint: string, extra: Record<string, string> = {}): Promise<unknown> => {
      const file = fileRef.current;
      if (!file) {
        throw new Error("Selecione um ficheiro.");
      }
      const body = new FormData();
      body.append("file", file);
      for (const [key, value] of Object.entries(extra)) {
        body.append(key, value);
      }
      const response = await fetch(`/api/imports/${endpoint}`, { method: "POST", body });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Não foi possível processar o ficheiro.";
        throw new Error(message);
      }
      return payload;
    },
    [],
  );

  function resetFrom(step: "preview" | "validate"): void {
    setResult(null);
    setError(null);
    if (step === "preview") {
      setPreview(null);
      setMapping(null);
      setSheetName(null);
    }
    setReport(null);
  }

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    fileRef.current = file;
    setFilename(file.name);
    resetFrom("preview");
    setBusy("preview");
    try {
      const data = (await post("preview")) as Preview;
      setPreview(data);
      setMapping(data.suggestedMapping);
      setSheetName(data.sheets[0]?.name ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao ler o ficheiro.");
    } finally {
      setBusy(null);
    }
  }

  async function handleValidate(): Promise<void> {
    if (!mapping) return;
    setBusy("validate");
    setError(null);
    setResult(null);
    try {
      const data = (await post("validate", {
        mapping: JSON.stringify(mapping),
        ...(sheetName ? { sheetName } : {}),
      })) as ValidationReport;
      setReport(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao validar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit(): Promise<void> {
    if (!mapping || !preview) return;
    setBusy("commit");
    setError(null);
    try {
      const data = (await post("commit", {
        mapping: JSON.stringify(mapping),
        expectedFileHash: preview.fileHash,
        rowPolicy: allowPartial ? "VALID_ROWS_ONLY" : "ALL_OR_NOTHING",
        ...(sheetName ? { sheetName } : {}),
      })) as CommitResult;
      setResult(data);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao confirmar.");
    } finally {
      setBusy(null);
    }
  }

  const activeSheet = preview?.sheets.find((sheet) => sheet.name === sheetName) ?? preview?.sheets[0];
  const canCommit =
    report !== null &&
    report.unmappedRequiredFields.length === 0 &&
    report.rowsValid > 0 &&
    (report.rowsInvalid === 0 || allowPartial);

  return (
    <div className="space-y-8">
      {/* ---------- 1. ficheiro ---------- */}
      <section aria-labelledby="passo-ficheiro" className="space-y-3">
        <h2 id="passo-ficheiro" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          1. Ficheiro
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <label htmlFor="ficheiro" className="block text-sm text-slate-700 dark:text-slate-300">
            Exportação de agenda (.csv ou .xlsx, até 20 MB)
          </label>
          <input
            id="ficheiro"
            type="file"
            accept=".csv,.xlsx"
            data-testid="file-input"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:file:bg-slate-100 dark:file:text-slate-900"
          />
          {filename ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {filename}
              {preview ? ` · ${(preview.fileSizeBytes / 1024).toFixed(1)} KB · SHA-256 ${preview.fileHash.slice(0, 12)}…` : ""}
              {preview?.detectedDelimiter
                ? ` · separador detetado "${preview.detectedDelimiter}"`
                : ""}
            </p>
          ) : null}
        </div>
      </section>

      {error ? (
        <p role="alert" data-testid="error" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {preview?.alreadyCommitted ? (
        <p role="alert" data-testid="duplicate-warning" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Este ficheiro já foi importado e confirmado anteriormente. Confirmar de novo não vai
          duplicar dados: o lote será registado como duplicado e nenhum facto será gravado.
        </p>
      ) : null}

      {/* ---------- 2. estrutura e amostra ---------- */}
      {preview && activeSheet ? (
        <section aria-labelledby="passo-amostra" className="space-y-3">
          <h2 id="passo-amostra" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            2. Estrutura e amostra
          </h2>

          {preview.sheets.length > 1 ? (
            <div>
              <label htmlFor="folha" className="text-sm text-slate-700 dark:text-slate-300">
                Folha
              </label>
              <select
                id="folha"
                value={sheetName ?? ""}
                onChange={(event) => {
                  setSheetName(event.target.value);
                  setReport(null);
                }}
                className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {preview.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} ({sheet.rowCount} linhas)
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeSheet.rowCount} linhas de dados · {activeSheet.headers.length} colunas. Amostra
            das primeiras {activeSheet.sampleRows.length}:
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Amostra do ficheiro</caption>
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  {activeSheet.headers.map((header) => (
                    <th key={header} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeSheet.sampleRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="whitespace-nowrap px-3 py-2">
                        {cell ?? <span className="text-slate-400">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ---------- 3. mapeamento ---------- */}
      {preview && mapping && activeSheet ? (
        <section aria-labelledby="passo-mapeamento" className="space-y-3">
          <h2 id="passo-mapeamento" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            3. Mapeamento de colunas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Perfil <strong>sintético</strong>, criado para estas fixtures. Não corresponde a nenhuma
            exportação real do Newsoft — será substituído quando recebermos uma amostra anonimizada.
          </p>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
            {appointmentFieldKeys.map((field) => (
              <div key={field}>
                <label
                  htmlFor={`map-${field}`}
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {APPOINTMENT_FIELDS[field].label}
                  {APPOINTMENT_FIELDS[field].required ? (
                    <span className="ml-1 text-red-600 dark:text-red-400" aria-label="obrigatório">
                      *
                    </span>
                  ) : null}
                </label>
                <select
                  id={`map-${field}`}
                  data-testid={`map-${field}`}
                  value={mapping.columns[field] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMapping({
                      ...mapping,
                      columns: { ...mapping.columns, [field]: value === "" ? null : value },
                    });
                    setReport(null);
                  }}
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">— não mapeado —</option>
                  {activeSheet.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleValidate()}
            disabled={busy !== null}
            data-testid="validate-button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {busy === "validate" ? "A validar…" : "Validar"}
          </button>
        </section>
      ) : null}

      {/* ---------- 4. validação ---------- */}
      {report ? (
        <section aria-labelledby="passo-validacao" className="space-y-3">
          <h2 id="passo-validacao" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            4. Validação
          </h2>

          <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900">
            <span data-testid="rows-total">
              <strong className="tabular-nums">{report.rowsTotal}</strong> linhas
            </span>
            <span data-testid="rows-valid" className="text-emerald-700 dark:text-emerald-400">
              <strong className="tabular-nums">{report.rowsValid}</strong> válidas
            </span>
            <span data-testid="rows-invalid" className="text-red-700 dark:text-red-400">
              <strong className="tabular-nums">{report.rowsInvalid}</strong> inválidas
            </span>
            {report.duplicateRowsInFile > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">
                <strong className="tabular-nums">{report.duplicateRowsInFile}</strong> repetidas no
                ficheiro
              </span>
            ) : null}
          </div>

          {report.issues.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Erros por linha</caption>
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Linha</th>
                    <th scope="col" className="px-3 py-2 font-medium">Coluna</th>
                    <th scope="col" className="px-3 py-2 font-medium">Gravidade</th>
                    <th scope="col" className="px-3 py-2 font-medium">Problema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.issues.map((issue, index) => (
                    <tr key={`${issue.sourceRowNumber}-${issue.code}-${index}`}>
                      <td className="px-3 py-2 tabular-nums">{issue.sourceRowNumber}</td>
                      <td className="px-3 py-2">{issue.columnName ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge tone={issue.severity === "ERROR" ? "pending" : "neutral"}>
                          {issue.severity === "ERROR" ? "Erro" : "Aviso"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.issuesTruncated ? (
                <p className="px-3 py-2 text-xs text-slate-500">
                  Lista truncada. As contagens acima referem-se ao ficheiro completo.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Todas as linhas passaram na validação.
            </p>
          )}

          {report.rowsInvalid > 0 ? (
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <input
                type="checkbox"
                checked={allowPartial}
                data-testid="allow-partial"
                onChange={(event) => setAllowPartial(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                Gravar apenas as {report.rowsValid} linhas válidas e deixar de fora as{" "}
                {report.rowsInvalid} inválidas. Os KPIs calculados sobre este período ficarão
                incompletos.
              </span>
            </label>
          ) : null}

          <button
            type="button"
            onClick={() => void handleCommit()}
            disabled={!canCommit || busy !== null}
            data-testid="commit-button"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "commit" ? "A confirmar…" : "Confirmar importação"}
          </button>
        </section>
      ) : null}

      {/* ---------- 5. resultado ---------- */}
      {result ? (
        <section aria-labelledby="passo-resultado" className="space-y-3">
          <h2 id="passo-resultado" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            5. Resultado
          </h2>
          <div
            data-testid="commit-result"
            data-kind={result.kind}
            className="rounded-lg border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {result.kind === "COMMITTED" ? (
              <div>
                <p className="text-emerald-700 dark:text-emerald-400">
                  Importação confirmada. Das {result.rowsTotal} linhas do ficheiro:
                </p>
                <ul className="mt-2 space-y-1">
                  <li data-testid="summary-accepted">
                    <strong className="tabular-nums">{result.rowsAccepted}</strong> aceites e
                    gravadas
                  </li>
                  <li data-testid="summary-rejected">
                    <strong className="tabular-nums">{result.rowsRejected}</strong> rejeitadas por
                    erro de validação
                  </li>
                  <li data-testid="summary-ignored">
                    <strong className="tabular-nums">{result.rowsIgnored}</strong> ignoradas por já
                    existirem (repetidas no ficheiro ou já importadas antes)
                  </li>
                </ul>
              </div>
            ) : null}
            {result.kind === "DUPLICATE" ? (
              <p className="text-amber-700 dark:text-amber-400">
                Ficheiro já importado. Nenhum facto foi gravado; o lote ficou registado como
                duplicado para auditoria.
              </p>
            ) : null}
            {result.kind === "REJECTED" ? (
              <p className="text-red-700 dark:text-red-400">Lote recusado: {result.reason}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-4">
              <a href={`/imports/${result.batchId}`} className="underline underline-offset-4">
                Ver detalhe do lote
              </a>
              {result.kind !== "DUPLICATE" ? (
                <a
                  href={`/api/imports/${result.batchId}/errors`}
                  data-testid="download-errors"
                  className="underline underline-offset-4"
                >
                  Descarregar relatório de erros (CSV)
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
