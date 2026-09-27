"use client";

/**
 * Gráficos do Clinical Production Dashboard (Recharts).
 *
 * Regras de visualização: cores por entidade e em ordem fixa (paleta validada em
 * globals.css, com passos próprios para o tema escuro), um único eixo Y, linhas
 * de 2px, grelha recessiva, tooltip em todos os gráficos, legenda sempre que há
 * mais de uma série e tabela com os valores exatos por baixo.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


const AXIS = { fontSize: 12, fill: "var(--viz-axis)" };

import { formatValue, type ValueKind } from "./chart-format";

export type { ValueKind };

interface TooltipPayload {
  readonly name?: string;
  readonly value?: number | null;
  readonly color?: string;
  readonly dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
  kind,
}: {
  active?: boolean;
  payload?: readonly TooltipPayload[];
  label?: string | number;
  kind: ValueKind;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border px-3 py-2 text-xs shadow-sm" style={{ background: "var(--viz-tooltip-bg)", borderColor: "var(--viz-tooltip-border)" }}>
      <p className="mb-1 font-medium text-slate-900 dark:text-white">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums text-slate-900 dark:text-white">{formatValue(p.value, kind)}</span>
        </p>
      ))}
    </div>
  );
}

export interface ProductionPotentialPoint {
  readonly label: string;
  readonly production: number;
  readonly lost: number;
}

/** Produção real vs produção potencial sem faltas (barras empilhadas: real + perdida). */
export function ProductionPotentialChart({ data }: { readonly data: readonly ProductionPotentialPoint[] }) {
  return (
    <div className="viz-root h-64 w-full" role="img" aria-label="Produção real e receita perdida com faltas por mês">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatValue(v, "euros", true)} />
          <Tooltip cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }} content={<ChartTooltip kind="euros" />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--viz-axis)" }} />
          <Bar dataKey="production" name="Produção real" stackId="p" fill="var(--series-1)" stroke="var(--viz-tooltip-bg)" strokeWidth={1} />
          <Bar dataKey="lost" name="Perdida com faltas (líquida)" stackId="p" fill="var(--series-2)" stroke="var(--viz-tooltip-bg)" strokeWidth={1} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface TrendPoint {
  readonly label: string;
  readonly value: number | null;
  readonly average: number | null;
}

/** Série mensal com média móvel de 3 meses (tracejado). */
export function TrendChart({
  data,
  kind,
  name,
  height = 176,
}: {
  readonly data: readonly TrendPoint[];
  readonly kind: ValueKind;
  readonly name: string;
  readonly height?: number;
}) {
  return (
    <div className="viz-root w-full" style={{ height }} role="img" aria-label={`${name}: evolução mensal e média móvel de 3 meses`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatValue(v, kind, true)} />
          <Tooltip content={<ChartTooltip kind={kind} />} />
          <Line type="monotone" dataKey="value" name={name} stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3, fill: "var(--series-1)" }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="average" name="Média móvel 3 meses" stroke="var(--series-4)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface HBarPoint {
  readonly label: string;
  readonly value: number;
}

/** Barras horizontais de uma só série (ex.: €/h por procedimento). */
export function HorizontalBars({
  data,
  kind,
  name,
  reference,
}: {
  readonly data: readonly HBarPoint[];
  readonly kind: ValueKind;
  readonly name: string;
  readonly reference?: number | null;
}) {
  const height = Math.max(120, data.length * 34 + 24);
  return (
    <div className="viz-root w-full" style={{ height }} role="img" aria-label={name}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatValue(v, kind, true)} />
          <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={150} />
          <Tooltip cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }} content={<ChartTooltip kind={kind} />} />
          <Bar dataKey="value" name={name} fill="var(--series-1)" radius={[0, 4, 4, 0]} />
          {reference !== undefined && reference !== null ? (
            <ReferenceLine x={reference} stroke="var(--viz-axis)" strokeDasharray="4 4" label={{ value: "média", position: "top", fontSize: 11, fill: "var(--viz-axis)" }} />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
