/**
 * Blocos compostos partilhados por dashboard, planos e relatório.
 */
import type { Funnel } from "@/modules/production/domain/plans";
import type { GoalGap, GoalProjection } from "@/modules/production/domain/goals";
import type { Insight } from "@/modules/production/domain/insights";
import type { ScoreResult } from "@/modules/production/domain/score";
import { EMPTY, euros, eurosPerHour, formatNumber, percent } from "@/modules/production/domain/format";

import { card, Meter, StatusBadge, type Tone } from "./ui";

export function FunnelView({ funnel }: { readonly funnel: Funnel }) {
  const max = Math.max(1, ...funnel.stages.map((s) => s.cents));
  if (funnel.stages.every((s) => s.count === 0)) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Sem planos no período.</p>;
  }
  return (
    <ol className="space-y-3" aria-label="Funil de tratamento">
      {funnel.stages.map((stage, index) => {
        const biggest = funnel.biggestLossStage === stage.key;
        return (
          <li key={stage.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {index > 0 ? <span aria-hidden="true" className="mr-1 text-slate-400">↓</span> : null}
                {stage.label}
              </span>
              <span className="tabular-nums text-slate-900 dark:text-white">
                <strong className="font-semibold">{euros(stage.cents, { round: true })}</strong>
                <span className="text-slate-500 dark:text-slate-400"> · {stage.count} {stage.count === 1 ? "caso" : "casos"}</span>
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full rounded-sm bg-slate-100 dark:bg-slate-800">
              <div
                className="h-3 rounded-sm"
                style={{ width: `${(stage.cents / max) * 100}%`, background: biggest ? "var(--status-serious)" : "#2a78d6" }}
              />
            </div>
            {index > 0 ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {stage.conversionFromPrevious === null ? EMPTY : `${percent(stage.conversionFromPrevious, 0)} do passo anterior`}
                {stage.lossFromPreviousCents > 0 ? ` · perda de ${euros(stage.lossFromPreviousCents, { round: true })}` : ""}
                {biggest ? (
                  <span className="ml-2 align-middle">
                    <StatusBadge tone="warning">Maior perda</StatusBadge>
                  </span>
                ) : null}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

const INSIGHT_TONE: Record<Insight["tone"], Tone> = { positive: "good", neutral: "neutral", attention: "warning" };

export function InsightList({ insights }: { readonly insights: readonly Insight[] }) {
  if (insights.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não há dados suficientes para gerar insights.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800" data-testid="insights">
      {insights.map((insight) => (
        <li key={insight.key} className="flex gap-3 py-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <span className="mt-0.5 shrink-0">
            <StatusBadge tone={INSIGHT_TONE[insight.tone]}>
              {insight.tone === "positive" ? "Evolução" : insight.tone === "attention" ? "Atenção" : "Info"}
            </StatusBadge>
          </span>
          <span>{insight.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function GoalsPanel({
  currentCph,
  clinicalMinutes,
  goals,
  gap,
}: {
  readonly currentCph: number | null;
  readonly clinicalMinutes: number;
  readonly goals: readonly GoalProjection[];
  readonly gap: GoalGap | null;
}) {
  const max = Math.max(currentCph ?? 0, ...goals.map((g) => g.centsPerHour)) * 1.05;
  return (
    <div className={`${card} p-5 sm:p-6`} data-testid="goals">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Produção atual</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white" data-testid="current-cph">
            {eurosPerHour(currentCph)}
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            com {formatNumber(clinicalMinutes / 60, 1)} h clínicas no mês
          </p>
          {gap ? (
            <div className="mt-5 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60" data-testid="goal-gap">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Próximo objetivo</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {eurosPerHour(currentCph)} → <strong>{eurosPerHour(gap.nextGoal.centsPerHour)}</strong> ({gap.nextGoal.label})
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                +{eurosPerHour(gap.diffCentsPerHour)} <span className="text-base font-medium text-slate-500">+{percent(gap.diffShare)}</span>
              </p>
            </div>
          ) : currentCph !== null ? (
            <p className="mt-5"><StatusBadge tone="good">Todos os objetivos atingidos</StatusBadge></p>
          ) : null}
        </div>

        <div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Se mantiver as mesmas horas clínicas:</p>
          <div className="space-y-4">
            {currentCph !== null ? (
              <div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Atual</span><span className="tabular-nums">{eurosPerHour(currentCph)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-2 rounded-full bg-slate-900 dark:bg-white" style={{ width: `${(currentCph / max) * 100}%` }} />
                </div>
              </div>
            ) : null}
            {goals.map((g) => (
              <div key={g.label} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {g.label} · {eurosPerHour(g.centsPerHour)} {g.reached ? <StatusBadge tone="good">atingido</StatusBadge> : null}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded-full" style={{ width: `${(g.centsPerHour / max) * 100}%`, background: "#86b6ef" }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-xs tabular-nums sm:w-80">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Produção/mês</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{euros(g.projectedProductionCents, { round: true })}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Honorários</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{euros(g.projectedFeeCents, { round: true })}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Diferença</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {g.extraProductionCents === null ? EMPTY : `${g.extraProductionCents > 0 ? "+" : ""}${euros(g.extraProductionCents, { round: true })}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScorePanel({ score }: { readonly score: ScoreResult }) {
  const tone: Tone = score.score === null ? "neutral" : score.score >= 75 ? "good" : score.score >= 50 ? "warning" : "critical";
  return (
    <div className={`${card} p-5`} data-testid="score">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Clinical Efficiency Score</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {score.score === null ? EMPTY : score.score}
            {score.score !== null ? <span className="text-lg font-medium text-slate-400"> / 100</span> : null}
          </p>
        </div>
        <StatusBadge tone="neutral">Operacional</StatusBadge>
      </div>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
        Indicador exclusivamente operacional/económico. <strong>Não mede qualidade clínica</strong> nem
        substitui o juízo clínico.
      </p>
      <ul className="mt-4 space-y-2.5">
        {score.components.map((c) => (
          <li key={c.key} title={c.explanation}>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                {c.label} <span className="text-slate-400">({c.weight}%)</span>
              </span>
              <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                {c.value === null ? "sem dados — excluído" : `${Math.round(c.value * 100)}`}
              </span>
            </div>
            <div className="mt-1">
              <Meter value={c.value} label={c.label} tone={tone} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
