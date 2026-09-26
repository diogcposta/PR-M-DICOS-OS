/** Formatação dos valores dos gráficos (partilhada por servidor e cliente). */
import { formatNumber } from "@/modules/production/domain/format";

export type ValueKind = "euros" | "eurosPerHour" | "percent" | "hours" | "count";

/** Formatação compacta para eixos e tooltips (valores já em euros/horas/frações). */
export function formatValue(value: number | null | undefined, kind: ValueKind, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "sem dados";
  switch (kind) {
    case "euros":
      return compact && Math.abs(value) >= 1000 ? `€${formatNumber(value / 1000, 1)}k` : `€${formatNumber(value, 0)}`;
    case "eurosPerHour":
      return `${formatNumber(value, 0)} €/h`;
    case "percent":
      return `${formatNumber(value * 100, compact ? 0 : 1)}%`;
    case "hours":
      return `${formatNumber(value, 1)} h`;
    case "count":
      return formatNumber(value, 0);
  }
}

