"use client";

/**
 * Evolução mensal das consultas, por desfecho.
 *
 * Barras empilhadas: cada mês mostra o total marcado e como se repartiu. Uma só
 * escala vertical — nunca dois eixos.
 *
 * As cores são as quatro primeiras da paleta categórica validada (ordem fixa,
 * nunca ciclada), com passos próprios para o tema escuro. Em tema claro, o aqua
 * e o amarelo ficam abaixo de 3:1 contra a superfície; a identidade nunca
 * depende só da cor: há legenda e a tabela resumida por baixo do gráfico.
 */
import { useId, useState } from "react";

export interface MonthlyChartPoint {
  readonly month: string;
  readonly completed: number;
  readonly noShow: number;
  readonly cancelled: number;
  readonly scheduled: number;
}

const SERIES = [
  { key: "completed", label: "Realizadas", cssVar: "--series-1" },
  { key: "noShow", label: "Faltas", cssVar: "--series-2" },
  { key: "cancelled", label: "Canceladas", cssVar: "--series-3" },
  { key: "scheduled", label: "Por realizar", cssVar: "--series-4" },
] as const;

const MONTH_NAMES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  const index = Number(monthNumber) - 1;
  return `${MONTH_NAMES[index] ?? month} ${String(year).slice(2)}`;
}

function pointTotal(point: MonthlyChartPoint): number {
  return point.completed + point.noShow + point.cancelled + point.scheduled;
}

/** Escala "bonita" para o topo do eixo: 1, 2 ou 5 vezes uma potência de 10. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 16, right: 12, bottom: 32, left: 40 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
/** Folga de 2px entre segmentos empilhados, para a fronteira se ler. */
const SEGMENT_GAP = 2;

export function MonthlyAppointmentsChart({
  points,
}: {
  readonly points: readonly MonthlyChartPoint[];
}) {
  const titleId = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length === 0) {
    return null;
  }

  const maxTotal = Math.max(...points.map(pointTotal));
  const ceiling = niceCeiling(maxTotal);
  const ticks = [0, ceiling / 2, ceiling];

  const slotWidth = PLOT_WIDTH / points.length;
  const barWidth = Math.min(48, slotWidth * 0.6);
  const toY = (value: number): number => PADDING.top + PLOT_HEIGHT * (1 - value / ceiling);

  const hoveredPoint = hovered === null ? null : points[hovered];

  return (
    <figure className="viz-root m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={titleId}
        className="w-full"
        onMouseLeave={() => setHovered(null)}
      >
        <title id={titleId}>
          Consultas por mês e por desfecho. Os valores exatos estão na tabela seguinte.
        </title>

        {/* grelha recessiva */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={toY(tick)}
              y2={toY(tick)}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={toY(tick) + 4}
              textAnchor="end"
              className="fill-slate-500 text-[11px] tabular-nums dark:fill-slate-400"
            >
              {tick}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const x = PADDING.left + slotWidth * index + (slotWidth - barWidth) / 2;
          const total = pointTotal(point);
          let cursor = 0;

          return (
            <g
              key={point.month}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              tabIndex={0}
              role="button"
              aria-label={`${formatMonth(point.month)}: ${total} consultas`}
              className="cursor-default focus:outline-none"
            >
              {/* alvo de rato maior do que as barras */}
              <rect
                x={PADDING.left + slotWidth * index}
                y={PADDING.top}
                width={slotWidth}
                height={PLOT_HEIGHT}
                fill="transparent"
              />

              {SERIES.map((series) => {
                const value = point[series.key];
                if (value === 0) return null;

                const height = (value / ceiling) * PLOT_HEIGHT;
                const y = toY(cursor + value);
                cursor += value;
                const drawnHeight = Math.max(height - SEGMENT_GAP, 1);

                return (
                  <rect
                    key={series.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={drawnHeight}
                    rx={3}
                    fill={`var(${series.cssVar})`}
                    opacity={hovered === null || hovered === index ? 1 : 0.35}
                  />
                );
              })}

              <text
                x={x + barWidth / 2}
                y={HEIGHT - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[11px] dark:fill-slate-400"
              >
                {formatMonth(point.month)}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
        {SERIES.map((series) => (
          <span key={series.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `var(${series.cssVar})` }}
            />
            {series.label}
          </span>
        ))}
        {hoveredPoint ? (
          <span className="ml-auto tabular-nums" data-testid="chart-hover">
            {formatMonth(hoveredPoint.month)}: {hoveredPoint.completed} realizadas ·{" "}
            {hoveredPoint.noShow} faltas · {hoveredPoint.cancelled} canceladas ·{" "}
            {hoveredPoint.scheduled} por realizar
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
