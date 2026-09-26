/**
 * Simulador "What if?".
 *
 * Modelo explícito (mostrado no ecrã):
 *  - o €/h introduzido é por hora clínica disponível, tal como no dashboard, e
 *    já reflete a taxa de faltas atual (`baselineNoShowRate`);
 *  - mudar a taxa de faltas escala o €/h pela fração de agenda efetivamente
 *    utilizada: €/h' = €/h × (1 − faltas') / (1 − faltas atual);
 *  - planos: valor aceite/mês = planos apresentados × valor médio × taxa de
 *    aceitação. É mostrado à parte e NÃO é somado à produção — executá-los
 *    consome as mesmas horas; somá-los contaria duas vezes.
 */
import { feeFromBase } from "./metrics";

export interface SimulatorInput {
  readonly hoursPerMonth: number;
  readonly centsPerHour: number;
  readonly feeBps: number;
  readonly baselineNoShowRate: number;
  readonly noShowRate: number;
  readonly acceptanceRate: number;
  readonly avgPlanCents: number;
  readonly plansPerMonth: number;
  /** Meses de trabalho por ano (férias excluídas). */
  readonly workingMonths: number;
}

export interface SimulatorResult {
  readonly effectiveCentsPerHour: number;
  readonly monthlyProductionCents: number;
  readonly monthlyFeeCents: number;
  readonly annualProductionCents: number;
  readonly annualFeeCents: number;
  readonly monthlyAcceptedPlanCents: number;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.min(0.95, Math.max(0, rate));
}

export function simulate(input: SimulatorInput): SimulatorResult {
  const hours = Math.max(0, Number.isFinite(input.hoursPerMonth) ? input.hoursPerMonth : 0);
  const baseRate = clampRate(input.baselineNoShowRate);
  const newRate = clampRate(input.noShowRate);
  const effective = Math.max(0, input.centsPerHour) * ((1 - newRate) / (1 - baseRate));
  const monthly = Math.round(effective * hours);
  const monthlyFee = feeFromBase(monthly, input.feeBps);
  const months = Math.max(0, Math.min(12, input.workingMonths));
  return {
    effectiveCentsPerHour: effective,
    monthlyProductionCents: monthly,
    monthlyFeeCents: monthlyFee,
    annualProductionCents: Math.round(monthly * months),
    annualFeeCents: Math.round(monthlyFee * months),
    monthlyAcceptedPlanCents: Math.round(
      Math.max(0, input.plansPerMonth) * Math.max(0, input.avgPlanCents) * clampRate(input.acceptanceRate),
    ),
  };
}

/** Tabela rápida: mesmas horas, vários €/h. */
export function ladder(hoursPerMonth: number, centsPerHourList: readonly number[], feeBps: number) {
  return centsPerHourList.map((cph) => {
    const production = Math.round(cph * hoursPerMonth);
    return { centsPerHour: cph, productionCents: production, feeCents: feeFromBase(production, feeBps) };
  });
}
