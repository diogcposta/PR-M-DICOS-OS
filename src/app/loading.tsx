import { PageHeader } from "@/components/ui/PageHeader";

/**
 * Esqueleto do dashboard enquanto o servidor consulta a base de dados.
 *
 * O Next mostra isto automaticamente durante o `await` em `page.tsx`, sem
 * precisar de estado de carregamento no cliente.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <PageHeader title="Dashboard" description="A carregar indicadores…" />
      <div className="h-16 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <span className="sr-only">A carregar o dashboard</span>
    </div>
  );
}
