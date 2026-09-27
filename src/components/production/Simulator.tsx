"use client";

import { useState } from "react";

import { euros, eurosPerHour, formatNumber } from "@/modules/production/domain/format";
import { ladder, simulate, type SimulatorInput } from "@/modules/production/domain/simulator";

import { card, inputClass } from "./ui";

export interface ScenarioInput {
  readonly name: string;
  readonly centsPerHour: number | null;
  readonly hoursPerMonth: number;
}

interface Props {
  readonly initial: SimulatorInput;
  readonly goals: ReadonlyArray<{ label: string; centsPerHour: number }>;
  readonly scenarios: readonly ScenarioInput[];
  readonly measuredCph: number | null;
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  step,
  min,
  max,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums text-slate-900 dark:text-white">{formatNumber(value, step < 1 ? 1 : 0)} {suffix}</span>
      </label>
      <div className="mt-1.5 flex items-center gap-3">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-slate-900 dark:accent-white" />
        <input aria-label={label} type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`${inputClass} w-24`} />
      </div>
    </div>
  );
}

export function Simulator({ initial, goals, scenarios, measuredCph }: Props) {
  const [hoursPerMonth, setHours] = useState(initial.hoursPerMonth);
  const [cph, setCph] = useState(Math.round(initial.centsPerHour / 100));
  const [feePct, setFeePct] = useState(initial.feeBps / 100);
  // A taxa de faltas é editada com 1 casa decimal; a base usa o mesmo arredondamento
  // para que, sem mexer nas faltas, o €/h efetivo seja exatamente o €/h introduzido.
  const baselineRate = Math.round(initial.baselineNoShowRate * 1000) / 1000;
  const [noShow, setNoShow] = useState(Math.round(initial.noShowRate * 1000) / 10);
  const [acceptance, setAcceptance] = useState(Math.round(initial.acceptanceRate * 100));
  const [avgPlan, setAvgPlan] = useState(Math.round(initial.avgPlanCents / 100));
  const [plans, setPlans] = useState(initial.plansPerMonth);
  const [months, setMonths] = useState(initial.workingMonths);

  const feeBps = Math.round(feePct * 100);
  const result = simulate({
    hoursPerMonth,
    centsPerHour: cph * 100,
    feeBps,
    baselineNoShowRate: baselineRate,
    noShowRate: noShow / 100,
    acceptanceRate: acceptance / 100,
    avgPlanCents: avgPlan * 100,
    plansPerMonth: plans,
    workingMonths: months,
  });
  const base = simulate({ ...initial, baselineNoShowRate: baselineRate, noShowRate: baselineRate });
  const diff = result.monthlyProductionCents - base.monthlyProductionCents;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className={`${card} space-y-5 p-5`}>
          <NumberInput id="h" label="Horas clínicas / mês" value={hoursPerMonth} onChange={setHours} step={0.5} min={0} max={250} suffix="h" />
          <NumberInput id="cph" label="Produção por hora" value={cph} onChange={setCph} step={1} min={0} max={300} suffix="€/h" />
          <NumberInput id="fee" label="Percentagem recebida" value={feePct} onChange={setFeePct} step={1} min={0} max={100} suffix="%" />
          <NumberInput id="ns" label="Taxa de faltas" value={noShow} onChange={setNoShow} step={0.5} min={0} max={50} suffix="%" />
          <NumberInput id="acc" label="Taxa de aceitação de planos" value={acceptance} onChange={setAcceptance} step={1} min={0} max={100} suffix="%" />
          <NumberInput id="avg" label="Valor médio dos planos" value={avgPlan} onChange={setAvgPlan} step={10} min={0} max={10000} suffix="€" />
          <NumberInput id="pl" label="Planos apresentados / mês" value={plans} onChange={setPlans} step={1} min={0} max={100} suffix="" />
          <NumberInput id="m" label="Meses de trabalho / ano" value={months} onChange={setMonths} step={0.5} min={1} max={12} suffix="meses" />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3" aria-live="polite">
            <Out label="Produção mensal" value={euros(result.monthlyProductionCents, { round: true })} testId="sim-monthly" big />
            <Out label="Honorários mensais" value={euros(result.monthlyFeeCents, { round: true })} testId="sim-fee" big />
            <Out label="Produção anual" value={euros(result.annualProductionCents, { round: true })} />
            <Out label="Honorários anuais" value={euros(result.annualFeeCents, { round: true })} />
            <Out label="€/h efetivo (com faltas)" value={eurosPerHour(result.effectiveCentsPerHour)} />
            <Out label="Valor aceite / mês (planos)" value={euros(result.monthlyAcceptedPlanCents, { round: true })} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Face ao ponto de partida ({euros(base.monthlyProductionCents, { round: true })}/mês):{" "}
            <strong className="tabular-nums text-slate-900 dark:text-white">{diff >= 0 ? "+" : ""}{euros(diff, { round: true })}/mês</strong>.
          </p>
          <details className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <summary className="cursor-pointer font-medium">Como é calculado</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Produção = horas × €/h efetivo; €/h efetivo = €/h × (1 − faltas) ÷ (1 − faltas atuais {formatNumber(baselineRate * 100, 1)}%).</li>
              <li>Honorários = produção × percentagem. Anual = mensal × meses de trabalho.</li>
              <li>Valor aceite/mês = planos × valor médio × aceitação. Mostrado à parte: executar esses planos usa as mesmas horas, por isso não se soma à produção.</li>
            </ul>
          </details>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold">Com {formatNumber(hoursPerMonth, 1)} h/mês</h3>
          <table className="mt-3 w-full text-sm tabular-nums">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">€/h</th><th className="text-right">Produção</th><th className="text-right">Honorários</th><th className="text-right">Anual (hon.)</th></tr></thead>
            <tbody>
              {ladder(hoursPerMonth, [cph * 100, ...goals.map((g) => g.centsPerHour)], feeBps).map((r, i) => (
                <tr key={i} className={`border-t border-slate-100 dark:border-slate-800 ${i === 0 ? "font-semibold" : ""}`}>
                  <td className="py-1.5">{i === 0 ? "Simulado · " : `${goals[i - 1]!.label} · `}{eurosPerHour(r.centsPerHour)}</td>
                  <td className="text-right">{euros(r.productionCents, { round: true })}</td>
                  <td className="text-right">{euros(r.feeCents, { round: true })}</td>
                  <td className="text-right">{euros(Math.round(r.feeCents * months), { round: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${card} p-5`} data-testid="scenarios">
          <h3 className="text-sm font-semibold">Cenários</h3>
          <table className="mt-3 w-full text-sm tabular-nums">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Cenário</th><th className="text-right">€/h</th><th className="text-right">Horas</th><th className="text-right">Produção/mês</th><th className="text-right">Honorários/ano</th></tr></thead>
            <tbody>
              {scenarios.map((s) => {
                const c = s.centsPerHour ?? measuredCph ?? 0;
                const r = simulate({ ...initial, hoursPerMonth: s.hoursPerMonth, centsPerHour: c, feeBps, baselineNoShowRate: baselineRate, noShowRate: baselineRate, workingMonths: months });
                return (
                  <tr key={s.name} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 font-medium">{s.name}{s.centsPerHour === null ? <span className="block text-xs font-normal text-slate-500">€/h medido</span> : null}</td>
                    <td className="text-right">{eurosPerHour(c)}</td>
                    <td className="text-right">{formatNumber(s.hoursPerMonth, 1)}</td>
                    <td className="text-right">{euros(r.monthlyProductionCents, { round: true })}</td>
                    <td className="text-right">{euros(r.annualFeeCents, { round: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">Editar cenários nas Definições.</p>
        </div>
      </div>
    </div>
  );
}

function Out({ label, value, big = false, testId }: { label: string; value: string; big?: boolean; testId?: string }) {
  return (
    <div className={`${card} p-4`} data-testid={testId}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums text-slate-900 dark:text-white ${big ? "text-3xl" : "text-xl"}`}>{value}</p>
    </div>
  );
}
