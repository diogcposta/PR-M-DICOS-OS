import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

/**
 * Estado vazio honesto: diz que não há dados e porquê, em vez de mostrar um
 * zero que se confunde com um resultado real.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
