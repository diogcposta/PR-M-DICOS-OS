/**
 * Peças visuais do Clinical Production Dashboard. Sem estado: servem páginas de
 * servidor e componentes cliente. Estética sóbria — neutros slate, um acento
 * azul, estados sempre com ícone + texto (nunca só cor).
 */
import Link from "next/link";
import type { ReactNode } from "react";

export const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`;
export const btnGhost = `${btn} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`;
export const btnDanger = `${btn} text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950`;

export const inputClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 aria-invalid:border-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export const card = "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

export function PageTitle({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  id,
}: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly id?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export type Tone = "neutral" | "good" | "warning" | "critical";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-slate-500 dark:text-slate-400",
  good: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  critical: "text-red-700 dark:text-red-400",
};

const TONE_ICON: Record<Tone, string> = { neutral: "•", good: "▲", warning: "!", critical: "▼" };

/** Número grande com legenda; `hint` explica a definição (tooltip nativo + texto acessível). */
export function StatCard({
  label,
  value,
  sub,
  delta,
  tone = "neutral",
  hint,
  testId,
  emphasis = false,
  direction,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: ReactNode;
  readonly delta?: string | null;
  readonly tone?: Tone;
  readonly hint?: string;
  readonly testId?: string;
  readonly emphasis?: boolean;
  /** Sentido da variação (a cor diz se é bom ou mau; a seta diz se subiu ou desceu). */
  readonly direction?: "up" | "down";
}) {
  const icon = direction === "up" ? "▲" : direction === "down" ? "▼" : TONE_ICON[tone];
  return (
    <div data-testid={testId} className={`${card} flex flex-col justify-between p-4 sm:p-5 ${emphasis ? "ring-1 ring-slate-900/5 dark:ring-white/10" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {hint ? (
          <span title={hint} className="cursor-help select-none text-xs text-slate-400" aria-label={`Definição: ${hint}`}>
            ⓘ
          </span>
        ) : null}
      </div>
      <p
        data-testid={testId ? `${testId}-value` : undefined}
        className={`mt-2 font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white ${emphasis ? "text-3xl sm:text-4xl" : "text-2xl sm:text-[28px]"}`}
      >
        {value}
      </p>
      {sub || delta ? (
        <p className={`mt-1.5 text-xs ${TONE_TEXT[tone]}`}>
          {delta ? (
            <span className="font-medium tabular-nums">
              <span aria-hidden="true">{icon} </span>
              {delta}
            </span>
          ) : null}
          {delta && sub ? <span className="text-slate-500 dark:text-slate-400"> · </span> : null}
          {sub ? <span className="text-slate-500 dark:text-slate-400">{sub}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function StatusBadge({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  const classes: Record<Tone, string> = {
    neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    good: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    warning: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    critical: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${classes[tone]}`}>
      <span aria-hidden="true">{TONE_ICON[tone]}</span>
      {children}
    </span>
  );
}

export function EmptyNote({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {children}
    </p>
  );
}

export function TableWrap({ children, label }: { readonly children: ReactNode; readonly label?: string }) {
  return (
    <div className={`${card} overflow-x-auto`} role={label ? "region" : undefined} aria-label={label} tabIndex={label ? 0 : undefined}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export const th = "whitespace-nowrap border-b border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";
export const td = "whitespace-nowrap border-b border-slate-100 px-3 py-2.5 tabular-nums dark:border-slate-800";

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className = "",
}: {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
  readonly hint?: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormMessage({ state }: { readonly state: { ok: boolean; message: string } | null }) {
  if (!state || !state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"}`}
    >
      {state.ok ? "✓ " : "⚠ "}
      {state.message}
    </p>
  );
}

export function TextLink({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">
      {children}
    </Link>
  );
}

/** Barra horizontal simples (0–1) com texto — usada em ocupação e partilhas. */
export function Meter({ value, label, tone = "neutral" }: { readonly value: number | null; readonly label: string; readonly tone?: Tone }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  const bar: Record<Tone, string> = {
    neutral: "bg-[#2a78d6] dark:bg-[#3987e5]",
    good: "bg-[#0ca30c]",
    warning: "bg-[#fab219]",
    critical: "bg-[#d03b3b]",
  };
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-full rounded-full ${bar[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
