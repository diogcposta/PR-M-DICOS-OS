/**
 * Leitura das listas editáveis das Definições (horário, objetivos, cenários),
 * enviadas como campos numerados de um formulário.
 */
import { isValidTime, parseTime } from "../domain/time";

import { InputError, parseEuros } from "./parse";

export function parseScheduleForm(form: Record<string, string>) {
  const blocks: Array<{ weekday: number; startMinute: number; endMinute: number }> = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    for (let i = 0; i < 2; i++) {
      const start = form[`s_${weekday}_${i}_start`]?.trim() ?? "";
      const end = form[`s_${weekday}_${i}_end`]?.trim() ?? "";
      if (start === "" && end === "") continue;
      if (!isValidTime(start) || !isValidTime(end)) {
        throw new InputError("Horário: use o formato HH:mm em todos os períodos preenchidos.");
      }
      const s = parseTime(start);
      const e = parseTime(end);
      if (e <= s) throw new InputError("Horário: o fim de cada período tem de ser posterior ao início.");
      blocks.push({ weekday, startMinute: s, endMinute: e });
    }
  }
  const byDay = new Map<number, typeof blocks>();
  for (const b of blocks) byDay.set(b.weekday, [...(byDay.get(b.weekday) ?? []), b]);
  for (const list of byDay.values()) {
    const [a, b] = list.sort((x, y) => x.startMinute - y.startMinute);
    if (a && b && b.startMinute < a.endMinute) {
      throw new InputError("Horário: os dois períodos do mesmo dia não se podem sobrepor.");
    }
  }
  return blocks;
}

export function parseGoalsForm(form: Record<string, string>) {
  const goals: Array<{ label: string; centsPerHour: number }> = [];
  for (let i = 0; i < 8; i++) {
    const label = form[`g_${i}_label`]?.trim() ?? "";
    const value = form[`g_${i}_value`]?.trim() ?? "";
    if (label === "" && value === "") continue;
    if (label === "") throw new InputError("Objetivos: cada objetivo precisa de um nome.");
    const cents = parseEuros(value);
    if (cents <= 0) throw new InputError("Objetivos: o valor tem de ser positivo.");
    goals.push({ label: label.slice(0, 40), centsPerHour: cents });
  }
  if (goals.length === 0) throw new InputError("Defina pelo menos um objetivo.");
  return goals.sort((a, b) => a.centsPerHour - b.centsPerHour);
}

export function parseScenariosForm(form: Record<string, string>) {
  const scenarios: Array<{ name: string; centsPerHour: number | null; hoursPerMonth: number }> = [];
  for (let i = 0; i < 6; i++) {
    const name = form[`c_${i}_name`]?.trim() ?? "";
    if (name === "") continue;
    const value = form[`c_${i}_value`]?.trim() ?? "";
    const hours = Number((form[`c_${i}_hours`] ?? "").replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0 || hours > 400) {
      throw new InputError(`Cenário "${name}": horas/mês inválidas.`);
    }
    scenarios.push({ name: name.slice(0, 40), centsPerHour: value === "" ? null : parseEuros(value), hoursPerMonth: hours });
  }
  return scenarios;
}
