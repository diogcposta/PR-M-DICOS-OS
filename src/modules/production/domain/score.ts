/**
 * Clinical Efficiency Score (0–100).
 *
 * Indicador EXCLUSIVAMENTE operacional/económico. Não mede qualidade clínica e
 * não deve ser lido como tal — a interface repete este aviso junto do valor.
 *
 * Cada componente vale 0–1; componentes sem dados são excluídos e os pesos
 * restantes renormalizados (um mês sem planos não é penalizado nem premiado).
 */
import type { Ratio } from "@/modules/kpis/domain/ratio";

export interface ScoreInput {
  readonly centsPerHour: Ratio;
  readonly goalCentsPerHour: number;
  readonly realOccupancy: Ratio;
  readonly theoreticalOccupancy: Ratio;
  readonly missedRate: Ratio;
  readonly acceptanceRateByValue: Ratio;
  /** Fração do valor de planos em aberto que NÃO está em atraso de follow-up. */
  readonly followUpHealth: Ratio;
}

export interface ScoreComponent {
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly value: Ratio;
  readonly explanation: string;
}

export interface ScoreResult {
  readonly score: number | null;
  readonly components: ScoreComponent[];
}

/** Taxa de faltas a partir da qual o componente vale 0. */
const NO_SHOW_ZERO_POINT = 0.2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function efficiencyScore(input: ScoreInput): ScoreResult {
  const components: ScoreComponent[] = [
    {
      key: "cph",
      label: "€/hora vs objetivo",
      weight: 30,
      value: input.centsPerHour === null || input.goalCentsPerHour <= 0 ? null : clamp01(input.centsPerHour / input.goalCentsPerHour),
      explanation: "€/h do mês ÷ objetivo principal (máx. 100%).",
    },
    {
      key: "realOccupancy",
      label: "Ocupação real",
      weight: 20,
      value: input.realOccupancy === null ? null : clamp01(input.realOccupancy),
      explanation: "Horas de cadeira ÷ horas disponíveis.",
    },
    {
      key: "noShows",
      label: "Faltas",
      weight: 15,
      value: input.missedRate === null ? null : clamp01(1 - input.missedRate / NO_SHOW_ZERO_POINT),
      explanation: "0% faltas = 100 pontos; 20% ou mais = 0.",
    },
    {
      key: "acceptance",
      label: "Aceitação de planos",
      weight: 15,
      value: input.acceptanceRateByValue === null ? null : clamp01(input.acceptanceRateByValue),
      explanation: "Valor aceite ÷ valor apresentado.",
    },
    {
      key: "scheduleUse",
      label: "Utilização do horário",
      weight: 10,
      value: input.theoreticalOccupancy === null ? null : clamp01(input.theoreticalOccupancy),
      explanation: "Horas marcadas ÷ horas disponíveis.",
    },
    {
      key: "followUp",
      label: "Follow-up de planos",
      weight: 10,
      value: input.followUpHealth === null ? null : clamp01(input.followUpHealth),
      explanation: "Valor em aberto sem atraso de follow-up ÷ valor em aberto.",
    },
  ];
  const usable = components.filter((c) => c.value !== null);
  const totalWeight = usable.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return { score: null, components };
  const score = usable.reduce((s, c) => s + c.weight * (c.value ?? 0), 0) / totalWeight;
  return { score: Math.round(score * 100), components };
}
