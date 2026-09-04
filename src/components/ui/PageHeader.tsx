interface PageHeaderProps {
  readonly title: string;
  readonly description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="border-b border-slate-200 pb-6 dark:border-slate-800">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </header>
  );
}
