/**
 * Produção atual vs objetivos de €/hora.
 * Projeções mantêm as mesmas horas clínicas: só muda o €/h.
 */
import { safeDivide, type Ratio } from "@/modules/kpis/domain/ratio";

import { feeFromBase } from "./metrics";

export interface GoalInput {
  readonly label: string;
  readonly centsPerHour: number;
}

export interface GoalProjection {
  readonly label: string;
  readonly centsPerHour: number;
  readonly projectedProductionCents: number;
  readonly projectedFeeCents: number;
  /** Produção adicional face à atual, nas mesmas horas. */
  readonly extraProductionCents: number | null;
  readonly reached: boolean;
}

export interface GoalGap {
  readonly nextGoal: GoalInput;
  readonly diffCentsPerHour: number;
  /** Aumento relativo necessário: 0,288 = +28,8%. */
  readonly diffShare: Ratio;
}

export function projectGoals(
  goals: readonly GoalInput[],
  currentCentsPerHour: number | null,
  clinicalMinutes: number,
  feeBps: number,
): GoalProjection[] {
  const hoursFactor = clinicalMinutes / 60;
  const current = currentCentsPerHour === null ? null : Math.round(currentCentsPerHour * hoursFactor);
  return [...goals]
    .sort((a, b) => a.centsPerHour - b.centsPerHour)
    .map((goal) => {
      const projected = Math.round(goal.centsPerHour * hoursFactor);
      return {
        label: goal.label,
        centsPerHour: goal.centsPerHour,
        projectedProductionCents: projected,
        projectedFeeCents: feeFromBase(projected, feeBps),
        extraProductionCents: current === null ? null : projected - current,
        reached: currentCentsPerHour !== null && currentCentsPerHour >= goal.centsPerHour,
      };
    });
}

/** Distância ao próximo objetivo ainda não atingido (null se todos atingidos ou sem dados). */
export function gapToNextGoal(
  goals: readonly GoalInput[],
  currentCentsPerHour: number | null,
): GoalGap | null {
  if (currentCentsPerHour === null) return null;
  const next = [...goals]
    .sort((a, b) => a.centsPerHour - b.centsPerHour)
    .find((g) => g.centsPerHour > currentCentsPerHour);
  if (!next) return null;
  const diff = next.centsPerHour - currentCentsPerHour;
  return { nextGoal: next, diffCentsPerHour: diff, diffShare: safeDivide(diff, currentCentsPerHour) };
}
