"use client";

/**
 * Formulário simples com validação no servidor (useActionState).
 * Os campos são filhos normais; os erros chegam por `renderFields(state)`.
 */
import { useActionState, type ReactNode } from "react";

import type { ActionState } from "@/app/producao/actions";

import { btnPrimary, FormMessage } from "./ui";

export function SmallForm({
  action,
  submitLabel,
  children,
  className = "space-y-4",
  label,
}: {
  readonly action: (state: ActionState | null, formData: FormData) => Promise<ActionState>;
  readonly submitLabel: string;
  readonly children: (state: ActionState | null) => ReactNode;
  readonly className?: string;
  readonly label: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className} aria-label={label} key={state?.ok ? state.nonce : undefined}>
      {children(state)}
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "A gravar…" : submitLabel}
      </button>
    </form>
  );
}
