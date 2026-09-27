"use client";

import { useState, useTransition } from "react";

import { commitImportAction, previewImportAction } from "@/app/producao/actions";
import type { ImportPreview } from "@/modules/production/application/data-transfer";

import { btnPrimary, btnSecondary, card, FormMessage, inputClass, StatusBadge } from "./ui";

export function ImportPanel({ entities }: { readonly entities: ReadonlyArray<{ key: string; label: string; headers: readonly string[] }> }) {
  const [entity, setEntity] = useState(entities[1]?.key ?? entities[0]!.key);
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const headers = entities.find((e) => e.key === entity)?.headers ?? [];

  function onPreview() {
    if (!file) return;
    start(async () => {
      const r = await previewImportAction(entity, file.content);
      setMessage(r.ok ? null : { ok: false, message: r.message });
      setPreview(r.ok ? r.preview : null);
    });
  }

  function onCommit() {
    if (!file) return;
    start(async () => {
      const r = await commitImportAction(entity, file.content, file.name, allowPartial);
      setMessage(r);
      if (r.ok) setPreview(null);
    });
  }

  return (
    <div className={`${card} space-y-5 p-5`}>
      <div className="grid gap-4 sm:grid-cols-[220px_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="imp-entity" className="mb-1 block text-xs font-medium">Tipo de dados</label>
          <select id="imp-entity" value={entity} onChange={(e) => { setEntity(e.target.value); setPreview(null); }} className={inputClass}>
            {entities.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="imp-file" className="mb-1 block text-xs font-medium">Ficheiro CSV</label>
          <input
            id="imp-file"
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setPreview(null);
              setMessage(null);
              setFile(f ? { name: f.name, content: await f.text() } : null);
            }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:file:bg-slate-800"
          />
        </div>
        <button type="button" className={btnSecondary} onClick={onPreview} disabled={!file || pending}>Pré-visualizar</button>
      </div>
      <p className="text-xs text-slate-500">Colunas esperadas (separador ; ou ,, datas dd/mm/aaaa, decimal com vírgula): <code className="break-all">{headers.join(";")}</code></p>

      {preview ? (
        <div className="space-y-4" data-testid="import-preview">
          <div className="flex flex-wrap gap-2 text-sm">
            <StatusBadge tone="neutral">{`${preview.total} linhas`}</StatusBadge>
            <StatusBadge tone="good">{`${preview.valid} válidas`}</StatusBadge>
            <StatusBadge tone={preview.invalid ? "critical" : "neutral"}>{`${preview.invalid} inválidas`}</StatusBadge>
            <StatusBadge tone="neutral">{`${preview.duplicates} já existentes (ignoradas)`}</StatusBadge>
            {preview.alreadyImported ? <StatusBadge tone="warning">Ficheiro já importado</StatusBadge> : null}
          </div>
          <p className="font-mono text-xs text-slate-500">SHA-256 {preview.fileHash.slice(0, 16)}…</p>
          {preview.missingHeaders.length ? <p className="text-sm text-red-700">Faltam colunas: {preview.missingHeaders.join(", ")}</p> : null}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead><tr>{preview.headers.map((h) => <th key={h} className="whitespace-nowrap bg-slate-50 px-2 py-1.5 text-left font-medium dark:bg-slate-900">{h}</th>)}</tr></thead>
              <tbody>{preview.sample.map((r, i) => <tr key={i}>{preview.headers.map((h) => <td key={h} className="whitespace-nowrap border-t border-slate-100 px-2 py-1 dark:border-slate-800">{r[h]}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {preview.rows.some((r) => !r.valid) ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-red-800 dark:text-red-300">
              {preview.rows.filter((r) => !r.valid).map((r) => <li key={r.rowNumber}>Linha {r.rowNumber}: {r.errors.join(" · ")}</li>)}
            </ul>
          ) : null}
          {preview.invalid > 0 ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} className="h-4 w-4" />
              Importar só as linhas válidas (as inválidas ficam de fora)
            </label>
          ) : null}
          <button type="button" className={btnPrimary} onClick={onCommit} disabled={pending || preview.alreadyImported || preview.missingHeaders.length > 0 || (preview.invalid > 0 && !allowPartial)}>
            Confirmar importação
          </button>
        </div>
      ) : null}
      <FormMessage state={message} />
    </div>
  );
}
