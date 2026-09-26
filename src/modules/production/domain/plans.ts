/**
 * Planos de tratamento: follow-up e funil.
 *
 * A aplicação apenas indica o que deve ser seguido. Nunca envia mensagens a
 * pacientes (nem existem contactos na base).
 */
import { safeDivide, type Ratio } from "@/modules/kpis/domain/ratio";

import type { PlanRecord } from "./monthly";
import { daysBetween } from "./time";

export interface FollowUpRules {
  /** Plano acima deste valor sem próxima consulta marcada → follow-up. */
  readonly minCents: number;
  /** Plano acima deste valor → follow-up prioritário. */
  readonly priorityCents: number;
  readonly firstAlertDays: number;
  readonly secondAlertDays: number;
}

export const DEFAULT_FOLLOW_UP_RULES: FollowUpRules = {
  minCents: 50_000,
  priorityCents: 150_000,
  firstAlertDays: 7,
  secondAlertDays: 30,
};

/** Planos que ainda podem avançar. */
const OPEN_STATUSES = new Set(["PRESENTED", "PENDING", "PARTIALLY_ACCEPTED", "ACCEPTED"]);
/** Planos ainda sem decisão do paciente ("sem resposta"). */
const UNDECIDED_STATUSES = new Set(["PRESENTED", "PENDING"]);

export interface FollowUpItem {
  readonly planId: string;
  readonly caseCode: string;
  readonly status: string;
  readonly totalCents: number;
  /** Valor que ainda pode avançar: por aceitar (sem decisão) ou por realizar (aceite). */
  readonly openCents: number;
  readonly priority: "PRIORITY" | "NORMAL";
  /** 0 = sem alerta de tempo, 1 = primeiro alerta, 2 = segundo alerta. */
  readonly alertLevel: 0 | 1 | 2;
  readonly daysSinceContact: number;
  readonly reasons: string[];
}

/**
 * Regras (editáveis nas Definições):
 *  1. plano > mínimo e sem próxima consulta marcada → follow-up;
 *  2. plano > limiar prioritário (sem consulta marcada) → prioritário;
 *  3. plano sem resposta há ≥ 7 dias → alerta; ≥ 30 dias → segundo alerta.
 * "Dias sem resposta" contam desde o último contacto, ou desde a apresentação.
 * Um plano com próxima consulta marcada não precisa de follow-up: já está a avançar.
 */
export function followUpList(
  plans: readonly PlanRecord[],
  today: string,
  rules: FollowUpRules = DEFAULT_FOLLOW_UP_RULES,
): FollowUpItem[] {
  const items: FollowUpItem[] = [];
  for (const plan of plans) {
    if (!OPEN_STATUSES.has(plan.status) || plan.nextAppointmentBooked) continue;
    const undecided = UNDECIDED_STATUSES.has(plan.status);
    const openCents = undecided
      ? plan.totalCents
      : Math.max(0, plan.acceptedCents - plan.performedCents);
    // Aceite e totalmente realizado: nada a seguir.
    if (!undecided && openCents <= 0) continue;

    const since = plan.lastContactDate ?? plan.presentedDate;
    const days = Math.max(0, daysBetween(since, today));
    const reasons: string[] = [];

    if (plan.totalCents > rules.minCents) {
      reasons.push(
        undecided
          ? "Valor acima do limiar e sem próxima consulta marcada"
          : "Tratamento aceite por realizar, sem próxima consulta marcada",
      );
    }
    let alertLevel: 0 | 1 | 2 = 0;
    if (undecided && days >= rules.secondAlertDays) {
      alertLevel = 2;
      reasons.push(`Sem resposta há ${days} dias (segundo alerta)`);
    } else if (undecided && days >= rules.firstAlertDays) {
      alertLevel = 1;
      reasons.push(`Sem resposta há ${days} dias`);
    }
    if (reasons.length === 0) continue;

    items.push({
      planId: plan.id,
      caseCode: plan.caseCode,
      status: plan.status,
      totalCents: plan.totalCents,
      openCents,
      priority: plan.totalCents > rules.priorityCents ? "PRIORITY" : "NORMAL",
      alertLevel,
      daysSinceContact: days,
      reasons,
    });
  }
  return items.sort(
    (a, b) =>
      (a.priority === b.priority ? 0 : a.priority === "PRIORITY" ? -1 : 1) ||
      b.alertLevel - a.alertLevel ||
      b.openCents - a.openCents,
  );
}

export interface FunnelStage {
  readonly key: "diagnosed" | "presented" | "accepted" | "started" | "completed";
  readonly label: string;
  readonly count: number;
  readonly cents: number;
  /** Fração do valor do passo anterior que chegou a este. */
  readonly conversionFromPrevious: Ratio;
  /** Valor perdido face ao passo anterior. */
  readonly lossFromPreviousCents: number;
}

export interface Funnel {
  readonly stages: FunnelStage[];
  /** Passo com maior perda em euros (null se não houver perdas). */
  readonly biggestLossStage: FunnelStage["key"] | null;
}

/**
 * Funil de tratamento, em valor e em número de casos:
 *  diagnosticado (valor diagnosticado) → apresentado (valor do plano) →
 *  aceite (valor aceite) → iniciado (valor aceite dos planos com realização > 0) →
 *  concluído (valor realizado dos planos concluídos).
 */
export function treatmentFunnel(plans: readonly PlanRecord[]): Funnel {
  const accepted = plans.filter((p) => p.acceptedCents > 0);
  const started = accepted.filter((p) => p.performedCents > 0);
  const completed = plans.filter((p) => p.status === "COMPLETED");
  const raw: Array<Pick<FunnelStage, "key" | "label" | "count" | "cents">> = [
    { key: "diagnosed", label: "Diagnóstico", count: plans.length, cents: plans.reduce((s, p) => s + Math.max(p.diagnosedCents, p.totalCents), 0) },
    { key: "presented", label: "Plano apresentado", count: plans.length, cents: plans.reduce((s, p) => s + p.totalCents, 0) },
    { key: "accepted", label: "Plano aceite", count: accepted.length, cents: accepted.reduce((s, p) => s + p.acceptedCents, 0) },
    { key: "started", label: "Tratamento iniciado", count: started.length, cents: started.reduce((s, p) => s + p.acceptedCents, 0) },
    { key: "completed", label: "Tratamento concluído", count: completed.length, cents: completed.reduce((s, p) => s + p.performedCents, 0) },
  ];
  const stages: FunnelStage[] = raw.map((stage, i) => {
    const prev = i === 0 ? null : raw[i - 1]!;
    return {
      ...stage,
      conversionFromPrevious: prev === null ? null : safeDivide(stage.cents, prev.cents),
      lossFromPreviousCents: prev === null ? 0 : Math.max(0, prev.cents - stage.cents),
    };
  });
  let biggest: FunnelStage | null = null;
  for (const s of stages) {
    if (s.lossFromPreviousCents > 0 && (biggest === null || s.lossFromPreviousCents > biggest.lossFromPreviousCents)) {
      biggest = s;
    }
  }
  return { stages, biggestLossStage: biggest?.key ?? null };
}

/** Valor ainda em aberto: por decidir (planos sem decisão) ou por realizar (aceites). */
export function openPlanCents(plans: readonly PlanRecord[]): number {
  return plans
    .filter((p) => OPEN_STATUSES.has(p.status))
    .reduce(
      (s, p) =>
        s + (UNDECIDED_STATUSES.has(p.status) ? p.totalCents : Math.max(0, p.acceptedCents - p.performedCents)),
      0,
    );
}
