/**
 * Perfil do médico, horário, objetivos e cenários.
 * Há um único perfil por base local; é criado com os valores iniciais na primeira leitura.
 */
import { productionDb, type ProductionDb } from "@/lib/db/production";

import type { FeeSettings } from "../domain/metrics";
import type { FollowUpRules } from "../domain/plans";

import {
  DEFAULT_GOALS,
  DEFAULT_PROFILE,
  DEFAULT_SCENARIOS,
  DEFAULT_SCHEDULE,
  DEFAULT_TEMPLATES,
} from "./defaults";
import type { SettingsInput } from "./schemas";

export async function getOrCreateProfile(db: ProductionDb = productionDb) {
  const existing = await db.doctorProfile.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return db.$transaction(async (tx) => {
    const profile = await tx.doctorProfile.create({ data: { ...DEFAULT_PROFILE } });
    await tx.scheduleBlock.createMany({ data: DEFAULT_SCHEDULE.map((b) => ({ ...b, doctorId: profile.id })) });
    await tx.productionGoal.createMany({
      data: DEFAULT_GOALS.map((g, i) => ({ ...g, sortOrder: i, doctorId: profile.id })),
    });
    await tx.scenario.createMany({
      data: DEFAULT_SCENARIOS.map((s, i) => ({ ...s, sortOrder: i, doctorId: profile.id })),
    });
    await tx.procedureTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((t) => ({ ...t, doctorId: profile.id })),
    });
    return profile;
  });
}

export type Profile = Awaited<ReturnType<typeof getOrCreateProfile>>;

export function feeSettings(profile: Profile): FeeSettings {
  return { feeBps: profile.feeBps, feeBase: profile.feeBase === "NET" ? "NET" : "BILLED" };
}

export function followUpRules(profile: Profile): FollowUpRules {
  return {
    minCents: profile.followUpMinCents,
    priorityCents: profile.followUpPriorityCents,
    firstAlertDays: profile.followUpFirstAlertDays,
    secondAlertDays: profile.followUpSecondAlertDays,
  };
}

export async function getSettings(db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  const [schedule, goals, scenarios, templates] = await Promise.all([
    db.scheduleBlock.findMany({ where: { doctorId: profile.id }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    db.productionGoal.findMany({ where: { doctorId: profile.id }, orderBy: [{ sortOrder: "asc" }, { centsPerHour: "asc" }] }),
    db.scenario.findMany({ where: { doctorId: profile.id }, orderBy: { sortOrder: "asc" } }),
    db.procedureTemplate.findMany({ where: { doctorId: profile.id }, orderBy: [{ favorite: "desc" }, { name: "asc" }] }),
  ]);
  return { profile, schedule, goals, scenarios, templates };
}

export async function updateSettings(input: SettingsInput, db: ProductionDb = productionDb) {
  const profile = await getOrCreateProfile(db);
  return db.doctorProfile.update({
    where: { id: profile.id },
    data: {
      name: input.name,
      feeBps: input.feePercent,
      feeBase: input.feeBase,
      standardSlotMinutes: input.standardSlotMinutes,
      saturdayMinutes: input.saturdayMinutes,
      primaryGoalCentsPerHour: input.primaryGoal,
      targetNoShowBps: input.targetNoShowPercent,
      followUpMinCents: input.followUpMin,
      followUpPriorityCents: input.followUpPriority,
      followUpFirstAlertDays: input.followUpFirstAlertDays,
      followUpSecondAlertDays: input.followUpSecondAlertDays,
    },
  });
}

export async function replaceSchedule(
  blocks: ReadonlyArray<{ weekday: number; startMinute: number; endMinute: number }>,
  db: ProductionDb = productionDb,
) {
  const profile = await getOrCreateProfile(db);
  await db.$transaction([
    db.scheduleBlock.deleteMany({ where: { doctorId: profile.id } }),
    db.scheduleBlock.createMany({ data: blocks.map((b) => ({ ...b, doctorId: profile.id })) }),
  ]);
}

export async function replaceGoals(
  goals: ReadonlyArray<{ label: string; centsPerHour: number }>,
  db: ProductionDb = productionDb,
) {
  const profile = await getOrCreateProfile(db);
  await db.$transaction([
    db.productionGoal.deleteMany({ where: { doctorId: profile.id } }),
    db.productionGoal.createMany({
      data: goals.map((g, i) => ({ ...g, sortOrder: i, doctorId: profile.id })),
    }),
  ]);
}

export async function replaceScenarios(
  scenarios: ReadonlyArray<{ name: string; centsPerHour: number | null; hoursPerMonth: number }>,
  db: ProductionDb = productionDb,
) {
  const profile = await getOrCreateProfile(db);
  await db.$transaction([
    db.scenario.deleteMany({ where: { doctorId: profile.id } }),
    db.scenario.createMany({ data: scenarios.map((s, i) => ({ ...s, sortOrder: i, doctorId: profile.id })) }),
  ]);
}
