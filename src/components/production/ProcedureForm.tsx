"use client";

/**
 * Registo rápido de procedimento (objetivo: < 20 segundos).
 *
 * - favoritos e templates num clique;
 * - autocomplete do tipo de procedimento; ao escolher um tipo já usado, sugere
 *   duração, preço, pagador e custos habituais (sempre editáveis);
 * - "Copiar último" repete o procedimento anterior;
 * - a hora de início sugerida é o fim da consulta anterior do dia;
 * - ⌘/Ctrl + Enter grava; "Gravar e novo" mantém a data e avança a hora.
 */
import { useMemo, useRef, useState, useTransition } from "react";

import type { ActionState } from "@/app/producao/actions";
import { PAYER_LABELS, PAYER_TYPES, PROCEDURE_CATEGORIES } from "@/modules/production/domain/constants";
import { euros } from "@/modules/production/domain/format";
import { formatTime, isValidTime, parseTime } from "@/modules/production/domain/time";

import { btnGhost, btnPrimary, btnSecondary, Field, FormMessage, inputClass } from "./ui";

export interface TemplateOption {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly priceCents: number;
  readonly durationMinutes: number;
  readonly plannedVisits: number;
  readonly labCostCents: number;
  readonly payerType: string;
  readonly favorite: boolean;
}

export interface SuggestionOption {
  readonly procedureType: string;
  readonly category: string;
  readonly count: number;
  readonly usualDurationMinutes: number | null;
  readonly usualPriceCents: number;
  readonly usualListPriceCents: number;
  readonly usualPayerType: string;
  readonly usualPayerName: string | null;
  readonly usualLabCostCents: number;
  readonly usualVisits: number;
}

export interface ProcedureDraft {
  date: string;
  caseCode: string;
  procedureType: string;
  category: string;
  listPrice: string;
  billed: string;
  payerType: string;
  payerName: string;
  start: string;
  end: string;
  plannedVisits: string;
  labCost: string;
  otherCost: string;
  note: string;
  completed: boolean;
}

const toInput = (cents: number) => (cents === 0 ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));

function addMinutes(time: string, minutes: number): string {
  if (!isValidTime(time)) return "";
  return formatTime(Math.min(parseTime(time) + minutes, 23 * 60 + 59));
}

export function ProcedureForm({
  action,
  initial,
  templates,
  suggestions,
  caseCodes,
  payerNames,
  nextCaseCode,
  last,
  mode = "create",
}: {
  readonly action: (state: ActionState | null, formData: FormData) => Promise<ActionState>;
  readonly initial: ProcedureDraft;
  readonly templates: readonly TemplateOption[];
  readonly suggestions: readonly SuggestionOption[];
  readonly caseCodes: readonly string[];
  readonly payerNames: readonly string[];
  readonly nextCaseCode: string;
  readonly last: ProcedureDraft | null;
  readonly mode?: "create" | "edit";
}) {
  const [draft, setDraft] = useState<ProcedureDraft>(initial);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);
  const keepAdding = useRef(true);

  const set = <K extends keyof ProcedureDraft>(key: K, value: ProcedureDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const typeOptions = useMemo(() => {
    const names = new Set<string>([...suggestions.map((s) => s.procedureType), ...templates.map((t) => t.name)]);
    return [...names].sort((a, b) => a.localeCompare(b, "pt"));
  }, [suggestions, templates]);

  const durationMinutes =
    isValidTime(draft.start) && isValidTime(draft.end) ? parseTime(draft.end) - parseTime(draft.start) : null;

  function applyTemplate(t: TemplateOption) {
    setDraft((d) => ({
      ...d,
      procedureType: t.name,
      category: t.category,
      billed: toInput(t.priceCents),
      listPrice: toInput(t.priceCents),
      payerType: t.payerType,
      plannedVisits: String(t.plannedVisits),
      labCost: toInput(t.labCostCents),
      end: d.start ? addMinutes(d.start, t.durationMinutes) : d.end,
    }));
    setSuggestionNote(`Template "${t.name}": ${t.durationMinutes} min, ${euros(t.priceCents)}.`);
  }

  function onTypeChange(value: string) {
    set("procedureType", value);
    const s = suggestions.find((x) => x.procedureType.toLowerCase() === value.trim().toLowerCase());
    if (s) {
      setDraft((d) => ({
        ...d,
        procedureType: s.procedureType,
        category: s.category,
        billed: toInput(s.usualPriceCents),
        listPrice: toInput(s.usualListPriceCents),
        payerType: s.usualPayerType,
        payerName: s.usualPayerName ?? "",
        plannedVisits: String(s.usualVisits),
        labCost: toInput(s.usualLabCostCents),
        end: s.usualDurationMinutes && d.start ? addMinutes(d.start, s.usualDurationMinutes) : d.end,
      }));
      setSuggestionNote(
        `Sugestão com base em ${s.count} registos: ${s.usualDurationMinutes ?? "?"} min, ${euros(s.usualPriceCents)}, ${PAYER_LABELS[s.usualPayerType as keyof typeof PAYER_LABELS] ?? s.usualPayerType}${s.usualPayerName ? ` (${s.usualPayerName})` : ""}.`,
      );
      return;
    }
    const t = templates.find((x) => x.name.toLowerCase() === value.trim().toLowerCase());
    if (t) applyTemplate(t);
  }

  function copyLast() {
    if (!last) return;
    const duration =
      isValidTime(last.start) && isValidTime(last.end) ? parseTime(last.end) - parseTime(last.start) : null;
    setDraft((d) => ({
      ...last,
      date: d.date,
      start: d.start,
      end: duration && d.start ? addMinutes(d.start, duration) : "",
      caseCode: "",
      note: "",
    }));
    setSuggestionNote("Copiado do último procedimento registado (Case ID e observação limpos).");
  }

  function submit() {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await action(null, formData);
      setState(result);
      if (result.ok && mode === "create" && keepAdding.current) {
        // Próximo registo: mesma data, começa onde este acabou.
        setDraft((d) => ({
          ...initial,
          date: d.date,
          start: d.end || d.start,
          end: "",
        }));
        setSuggestionNote(null);
        typeRef.current?.focus();
      }
    });
  }

  const err = state?.ok ? {} : (state?.errors ?? {});

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          submit();
        }
      }}
      className="space-y-5"
      aria-label={mode === "create" ? "Registar procedimento" : "Editar procedimento"}
    >
      {mode === "create" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Favoritos:</span>
          {templates.filter((t) => t.favorite).map((t) => (
            <button key={t.id} type="button" onClick={() => applyTemplate(t)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              ★ {t.name}
            </button>
          ))}
          <button type="button" onClick={copyLast} disabled={!last} className={`${btnGhost} px-2 py-1 text-xs`}>
            ⧉ Copiar último
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Data" name="date" error={err.date}>
          <input id="date" name="date" type="date" required value={draft.date} onChange={(e) => set("date", e.target.value)} className={inputClass} aria-invalid={Boolean(err.date)} />
        </Field>
        <Field label="Procedimento" name="procedureType" error={err.procedureType} className="sm:col-span-2" hint="Escreva ou escolha; os valores habituais preenchem-se sozinhos.">
          <input ref={typeRef} id="procedureType" name="procedureType" list="procedure-types" autoFocus={mode === "create"} required autoComplete="off" value={draft.procedureType} onChange={(e) => onTypeChange(e.target.value)} className={inputClass} aria-invalid={Boolean(err.procedureType)} placeholder="ex.: Coroa cerâmica" />
          <datalist id="procedure-types">
            {typeOptions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Categoria" name="category" error={err.category}>
          <select id="category" name="category" required value={draft.category} onChange={(e) => set("category", e.target.value)} className={inputClass}>
            <option value="">—</option>
            {PROCEDURE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      {suggestionNote ? <p className="text-xs text-blue-800 dark:text-blue-300" role="status">💡 {suggestionNote}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
{mode === "create" ? (
          <>
        <Field label="Hora de início" name="start" error={err.start}>
          <input id="start" name="start" type="time" step={300} value={draft.start} onChange={(e) => set("start", e.target.value)} className={inputClass} aria-invalid={Boolean(err.start)} />
        </Field>
        <Field label="Hora de fim" name="end" error={err.end} hint={durationMinutes !== null && durationMinutes > 0 ? `Duração: ${durationMinutes} min` : "Opcional; sem horas o €/h fica sem dados."}>
          <input id="end" name="end" type="time" step={300} value={draft.end} onChange={(e) => set("end", e.target.value)} className={inputClass} aria-invalid={Boolean(err.end)} />
        </Field>
          </>
        ) : null}
        <Field label="Valor faturado (€)" name="billed" error={err.billed}>
          <input id="billed" name="billed" inputMode="decimal" required value={draft.billed} onChange={(e) => set("billed", e.target.value)} className={inputClass} aria-invalid={Boolean(err.billed)} placeholder="600" />
        </Field>
        <Field label="Valor tabelado (€)" name="listPrice" error={err.listPrice} hint="Vazio = igual ao faturado.">
          <input id="listPrice" name="listPrice" inputMode="decimal" value={draft.listPrice} onChange={(e) => set("listPrice", e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Pagador" name="payerType" error={err.payerType}>
          <select id="payerType" name="payerType" value={draft.payerType} onChange={(e) => set("payerType", e.target.value)} className={inputClass}>
            {PAYER_TYPES.map((p) => (
              <option key={p} value={p}>{PAYER_LABELS[p]}</option>
            ))}
          </select>
        </Field>
        <Field label="Seguradora / convenção" name="payerName" error={err.payerName}>
          <input id="payerName" name="payerName" list="payer-names" disabled={draft.payerType === "PRIVATE"} value={draft.payerType === "PRIVATE" ? "" : draft.payerName} onChange={(e) => set("payerName", e.target.value)} className={inputClass} aria-invalid={Boolean(err.payerName)} />
          <datalist id="payer-names">
            {payerNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field label="Case ID (opcional)" name="caseCode" error={err.caseCode} hint="Agrupa consultas e atos do mesmo tratamento. Nunca nomes.">
          <div className="flex gap-1.5">
            <input id="caseCode" name="caseCode" list="case-codes" autoComplete="off" value={draft.caseCode} onChange={(e) => set("caseCode", e.target.value.toUpperCase())} className={inputClass} aria-invalid={Boolean(err.caseCode)} placeholder="DC-2026-001" />
            <button type="button" onClick={() => set("caseCode", nextCaseCode)} className={`${btnSecondary} px-2 text-xs`} title={`Novo: ${nextCaseCode}`} aria-label="Gerar novo Case ID">
              Novo
            </button>
          </div>
          <datalist id="case-codes">
            {caseCodes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Consultas necessárias" name="plannedVisits" error={err.plannedVisits}>
          <input id="plannedVisits" name="plannedVisits" type="number" min={1} max={30} value={draft.plannedVisits} onChange={(e) => set("plannedVisits", e.target.value)} className={inputClass} />
        </Field>
      </div>

      <details className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800" open={mode === "edit" || Boolean(err.labCost || err.otherCost || err.note)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">Custos, observação e estado</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Custo de laboratório (€)" name="labCost" error={err.labCost}>
            <input id="labCost" name="labCost" inputMode="decimal" value={draft.labCost} onChange={(e) => set("labCost", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Outros custos diretos (€)" name="otherCost" error={err.otherCost}>
            <input id="otherCost" name="otherCost" inputMode="decimal" value={draft.otherCost} onChange={(e) => set("otherCost", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Observação operacional" name="note" error={err.note} hint="Sem nomes, contactos ou dados clínicos." className="sm:col-span-2">
            <input id="note" name="note" maxLength={200} value={draft.note} onChange={(e) => set("note", e.target.value)} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" name="completed" checked={draft.completed} onChange={(e) => set("completed", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Procedimento concluído
          </label>
        </div>
      </details>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={btnPrimary} onClick={() => (keepAdding.current = true)}>
          {pending ? "A gravar…" : mode === "create" ? "Gravar e novo" : "Gravar alterações"}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">⌘/Ctrl + Enter</span>
      </div>
    </form>
  );
}
