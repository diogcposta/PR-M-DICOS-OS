import type { ReactNode } from "react";

interface CardProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function Card({ title, children, footer }: CardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h2>
      <div className="mt-3 text-slate-900 dark:text-slate-100">{children}</div>
      {footer ? (
        <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
