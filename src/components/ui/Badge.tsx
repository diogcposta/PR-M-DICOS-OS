type BadgeTone = "neutral" | "pending" | "ready";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  ready: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly children: string;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
