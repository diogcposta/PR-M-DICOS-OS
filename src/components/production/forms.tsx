"use client";

/**
 * Formulários curtos (dia clínico, consulta adicional, falta, plano).
 * Validação no servidor; em caso de erro os valores introduzidos mantêm-se.
 */
import type { ActionState } from "@/app/producao/actions";
import { ABSENCE_KINDS, ABSENCE_LABELS, PAYER_LABELS, PAYER_TYPES, PLAN_STATUSES, PLAN_STATUS_LABELS } from "@/modules/production/domain/constants";

import { SmallForm } from "./SmallForm";
import { Field, inputClass } from "./ui";

type Action = (state: ActionState | null, formData: FormData) => Promise<ActionState>;

function v(state: ActionState | null, key: string, fallback: string): string {
  return state && !state.ok && key in state.values ? (state.values[key] ?? fallback) : fallback;
}
function e(state: ActionState | null, key: string): string | undefined {
  return state && !state.ok ? state.errors[key] : undefined;
}

export function DayForm({
  action,
  defaults,
}: {
  readonly action: Action;
  readonly defaults: { date: string; start: string; end: string; breakMinutes: string; status?: string; note?: string };
}) {
  return (
    <SmallForm action={action} submitLabel="Gravar dia" label="Registar dia clínico">
      {(s) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Data" name="date" error={e(s, "date")}>
              <input id="date" name="date" type="date" required defaultValue={v(s, "date", defaults.date)} className={inputClass} />
            </Field>
            <Field label="Hora de início" name="start" error={e(s, "start")}>
              <input id="start" name="start" type="time" required defaultValue={v(s, "start", defaults.start)} className={inputClass} />
            </Field>
            <Field label="Hora de fim" name="end" error={e(s, "end")}>
              <input id="end" name="end" type="time" required defaultValue={v(s, "end", defaults.end)} className={inputClass} />
            </Field>
            <Field label="Pausa (min)" name="breakMinutes" error={e(s, "breakMinutes")}>
              <input id="breakMinutes" name="breakMinutes" type="number" min={0} max={600} step={5} defaultValue={v(s, "breakMinutes", defaults.breakMinutes)} className={inputClass} />
            </Field>
            <Field label="Estado" name="status" error={e(s, "status")}>
              <select id="status" name="status" defaultValue={v(s, "status", defaults.status ?? "WORKED")} className={inputClass}>
                <option value="WORKED">Realizado</option>
                <option value="PLANNED">Previsto</option>
              </select>
            </Field>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Horas clínicas disponíveis = fim − início − pausa. Dias previstos só entram na projeção de fim de mês. Gravar
            uma data existente atualiza-a.
          </p>
        </>
      )}
    </SmallForm>
  );
}

export function SessionForm({ action, defaults }: { readonly action: Action; readonly defaults: { date: string; start: string; end: string } }) {
  return (
    <SmallForm action={action} submitLabel="Adicionar consulta" label="Adicionar consulta" className="flex flex-wrap items-end gap-3">
      {(s) => (
        <>
          <Field label="Data" name="s-date" error={e(s, "date")}>
            <input id="s-date" name="date" type="date" required defaultValue={v(s, "date", defaults.date)} className={inputClass} />
          </Field>
          <Field label="Início" name="s-start" error={e(s, "start")}>
            <input id="s-start" name="start" type="time" required defaultValue={v(s, "start", defaults.start)} className={inputClass} />
          </Field>
          <Field label="Fim" name="s-end" error={e(s, "end")}>
            <input id="s-end" name="end" type="time" required defaultValue={v(s, "end", defaults.end)} className={inputClass} />
          </Field>
        </>
      )}
    </SmallForm>
  );
}

export function AbsenceForm({ action, defaultDate, procedureTypes }: { readonly action: Action; readonly defaultDate: string; readonly procedureTypes: readonly string[] }) {
  return (
    <SmallForm action={action} submitLabel="Registar falta" label="Registar falta ou cancelamento">
      {(s) => (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Data" name="a-date" error={e(s, "date")}>
            <input id="a-date" name="date" type="date" required defaultValue={v(s, "date", defaultDate)} className={inputClass} />
          </Field>
          <Field label="Hora" name="a-start" error={e(s, "start")}>
            <input id="a-start" name="start" type="time" required defaultValue={v(s, "start", "09:30")} className={inputClass} />
          </Field>
          <Field label="Duração prevista (min)" name="a-duration" error={e(s, "durationMinutes")}>
            <input id="a-duration" name="durationMinutes" type="number" min={5} max={480} step={5} defaultValue={v(s, "durationMinutes", "45")} className={inputClass} />
          </Field>
          <Field label="Tipo" name="a-kind" error={e(s, "kind")}>
            <select id="a-kind" name="kind" defaultValue={v(s, "kind", "NO_SHOW")} className={inputClass}>
              {ABSENCE_KINDS.map((k) => (
                <option key={k} value={k}>{ABSENCE_LABELS[k]}</option>
              ))}
            </select>
          </Field>
          <Field label="Procedimento previsto" name="a-procedure" error={e(s, "plannedProcedure")}>
            <input id="a-procedure" name="plannedProcedure" list="absence-types" defaultValue={v(s, "plannedProcedure", "")} className={inputClass} />
            <datalist id="absence-types">
              {procedureTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Valor estimado (€)" name="a-value" error={e(s, "estimatedValue")}>
            <input id="a-value" name="estimatedValue" inputMode="decimal" defaultValue={v(s, "estimatedValue", "")} className={inputClass} />
          </Field>
          <Field label="Pagador" name="a-payer" error={e(s, "payerType")}>
            <select id="a-payer" name="payerType" defaultValue={v(s, "payerType", "PRIVATE")} className={inputClass}>
              {PAYER_TYPES.map((p) => (
                <option key={p} value={p}>{PAYER_LABELS[p]}</option>
              ))}
            </select>
          </Field>
          <div className="space-y-2">
            <label className="flex items-center gap-2 pt-5 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" name="slotRecovered" defaultChecked={v(s, "slotRecovered", "") === "on"} className="h-4 w-4" />
              Slot recuperado por outro paciente
            </label>
          </div>
          <Field label="Receita recuperada (€)" name="a-recovered" error={e(s, "recoveredValue")} hint="Só se o slot foi ocupado.">
            <input id="a-recovered" name="recoveredValue" inputMode="decimal" defaultValue={v(s, "recoveredValue", "")} className={inputClass} />
          </Field>
        </div>
      )}
    </SmallForm>
  );
}

export interface PlanDefaults {
  caseCode: string;
  presentedDate: string;
  diagnosed: string;
  total: string;
  phases: string;
  status: string;
  accepted: string;
  performed: string;
  lastContactDate: string;
  nextAppointmentBooked: boolean;
  note: string;
}

export function PlanForm({ action, defaults, submitLabel, caseCodes }: { readonly action: Action; readonly defaults: PlanDefaults; readonly submitLabel: string; readonly caseCodes: readonly string[] }) {
  return (
    <SmallForm action={action} submitLabel={submitLabel} label="Plano de tratamento">
      {(s) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Case ID" name="p-case" error={e(s, "caseCode")}>
              <input id="p-case" name="caseCode" list="plan-cases" required defaultValue={v(s, "caseCode", defaults.caseCode)} className={inputClass} placeholder="DC-2026-001" />
              <datalist id="plan-cases">
                {caseCodes.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Data de apresentação" name="p-date" error={e(s, "presentedDate")}>
              <input id="p-date" name="presentedDate" type="date" required defaultValue={v(s, "presentedDate", defaults.presentedDate)} className={inputClass} />
            </Field>
            <Field label="Estado" name="p-status" error={e(s, "status")}>
              <select id="p-status" name="status" defaultValue={v(s, "status", defaults.status)} className={inputClass}>
                {PLAN_STATUSES.map((st) => (
                  <option key={st} value={st}>{PLAN_STATUS_LABELS[st]}</option>
                ))}
              </select>
            </Field>
            <Field label="Número de fases" name="p-phases" error={e(s, "phases")}>
              <input id="p-phases" name="phases" type="number" min={1} max={20} defaultValue={v(s, "phases", defaults.phases)} className={inputClass} />
            </Field>
            <Field label="Valor total (€)" name="p-total" error={e(s, "total")}>
              <input id="p-total" name="total" inputMode="decimal" required defaultValue={v(s, "total", defaults.total)} className={inputClass} />
            </Field>
            <Field label="Valor diagnosticado (€)" name="p-diagnosed" error={e(s, "diagnosed")} hint="Vazio = igual ao total.">
              <input id="p-diagnosed" name="diagnosed" inputMode="decimal" defaultValue={v(s, "diagnosed", defaults.diagnosed)} className={inputClass} />
            </Field>
            <Field label="Valor aceite (€)" name="p-accepted" error={e(s, "accepted")}>
              <input id="p-accepted" name="accepted" inputMode="decimal" defaultValue={v(s, "accepted", defaults.accepted)} className={inputClass} />
            </Field>
            <Field label="Valor realizado (€)" name="p-performed" error={e(s, "performed")}>
              <input id="p-performed" name="performed" inputMode="decimal" defaultValue={v(s, "performed", defaults.performed)} className={inputClass} />
            </Field>
            <Field label="Último contacto" name="p-contact" error={e(s, "lastContactDate")}>
              <input id="p-contact" name="lastContactDate" type="date" defaultValue={v(s, "lastContactDate", defaults.lastContactDate)} className={inputClass} />
            </Field>
            <Field label="Observação" name="p-note" error={e(s, "note")} className="sm:col-span-2" hint="Sem nomes nem contactos.">
              <input id="p-note" name="note" maxLength={200} defaultValue={v(s, "note", defaults.note)} className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 pt-5 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" name="nextAppointmentBooked" defaultChecked={s && !s.ok ? s.values.nextAppointmentBooked === "on" : defaults.nextAppointmentBooked} className="h-4 w-4" />
              Próxima consulta marcada
            </label>
          </div>
        </>
      )}
    </SmallForm>
  );
}

export interface SettingsDefaults {
  name: string;
  feePercent: string;
  feeBase: string;
  standardSlotMinutes: string;
  saturdayMinutes: string;
  primaryGoal: string;
  targetNoShowPercent: string;
  followUpMin: string;
  followUpPriority: string;
  followUpFirstAlertDays: string;
  followUpSecondAlertDays: string;
  /** Chave `s_{dia}_{i}_{start|end}` → "HH:mm". */
  schedule: Record<string, string>;
  goals: Array<{ label: string; value: string }>;
  scenarios: Array<{ name: string; value: string; hours: string }>;
}

const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function SettingsForm({ action, defaults }: { readonly action: Action; readonly defaults: SettingsDefaults }) {
  const goals = [...defaults.goals, ...Array.from({ length: Math.max(0, 6 - defaults.goals.length) }, () => ({ label: "", value: "" }))];
  const scenarios = [...defaults.scenarios, ...Array.from({ length: Math.max(0, 4 - defaults.scenarios.length) }, () => ({ name: "", value: "", hours: "" }))];
  return (
    <SmallForm action={action} submitLabel="Gravar definições" label="Definições" className="space-y-8">
      {(s) => (
        <>
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold">Perfil do médico</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Nome" name="name" error={e(s, "name")}>
                <input id="name" name="name" defaultValue={v(s, "name", defaults.name)} className={inputClass} />
              </Field>
              <Field label="Percentagem da produção recebida (%)" name="feePercent" error={e(s, "feePercent")}>
                <input id="feePercent" name="feePercent" inputMode="decimal" defaultValue={v(s, "feePercent", defaults.feePercent)} className={inputClass} />
              </Field>
              <Field label="Base dos honorários" name="feeBase" error={e(s, "feeBase")} hint="Por omissão: valor faturado (pedido).">
                <select id="feeBase" name="feeBase" defaultValue={v(s, "feeBase", defaults.feeBase)} className={inputClass}>
                  <option value="BILLED">Valor faturado × %</option>
                  <option value="NET">(Faturado − custos diretos) × %</option>
                </select>
              </Field>
              <Field label="Consulta standard (min)" name="standardSlotMinutes" error={e(s, "standardSlotMinutes")}>
                <input id="standardSlotMinutes" name="standardSlotMinutes" type="number" min={10} max={240} defaultValue={v(s, "standardSlotMinutes", defaults.standardSlotMinutes)} className={inputClass} />
              </Field>
              <Field label="Sábados ocasionais (min)" name="saturdayMinutes" error={e(s, "saturdayMinutes")} hint="≈ 3,5 h = 210 min">
                <input id="saturdayMinutes" name="saturdayMinutes" type="number" min={0} max={720} defaultValue={v(s, "saturdayMinutes", defaults.saturdayMinutes)} className={inputClass} />
              </Field>
              <Field label="Objetivo principal (€/h)" name="primaryGoal" error={e(s, "primaryGoal")} hint="Usado no Efficiency Score.">
                <input id="primaryGoal" name="primaryGoal" inputMode="decimal" defaultValue={v(s, "primaryGoal", defaults.primaryGoal)} className={inputClass} />
              </Field>
              <Field label="Taxa de faltas de referência (%)" name="targetNoShowPercent" error={e(s, "targetNoShowPercent")}>
                <input id="targetNoShowPercent" name="targetNoShowPercent" inputMode="decimal" defaultValue={v(s, "targetNoShowPercent", defaults.targetNoShowPercent)} className={inputClass} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-base font-semibold">Horário habitual</legend>
            <p className="text-xs text-slate-500">Até dois períodos por dia. Deixe vazio nos dias sem consulta.</p>
            <div className="grid gap-2">
              {WEEKDAYS.map((name, i) => {
                const d = i + 1;
                return (
                  <div key={d} className="grid grid-cols-[90px_repeat(4,minmax(0,1fr))] items-center gap-2 text-sm">
                    <span className="font-medium">{name}</span>
                    {[0, 1].flatMap((p) => ["start", "end"].map((k) => {
                      const key = `s_${d}_${p}_${k}`;
                      return <input key={key} name={key} type="time" aria-label={`${name} período ${p + 1} ${k === "start" ? "início" : "fim"}`} defaultValue={v(s, key, defaults.schedule[key] ?? "")} className={inputClass} />;
                    }))}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-base font-semibold">Objetivos de produção (€/hora)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {goals.map((g, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px] gap-2">
                  <input name={`g_${i}_label`} aria-label={`Objetivo ${i + 1} nome`} placeholder="Nome" defaultValue={v(s, `g_${i}_label`, g.label)} className={inputClass} />
                  <input name={`g_${i}_value`} aria-label={`Objetivo ${i + 1} €/h`} placeholder="€/h" inputMode="decimal" defaultValue={v(s, `g_${i}_value`, g.value)} className={inputClass} />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-base font-semibold">Cenários do simulador</legend>
            <p className="text-xs text-slate-500">€/h vazio = usar o €/h medido no mês mais recente.</p>
            <div className="grid gap-2">
              {scenarios.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_110px] gap-2">
                  <input name={`c_${i}_name`} aria-label={`Cenário ${i + 1} nome`} placeholder="Nome" defaultValue={v(s, `c_${i}_name`, c.name)} className={inputClass} />
                  <input name={`c_${i}_value`} aria-label={`Cenário ${i + 1} €/h`} placeholder="€/h" inputMode="decimal" defaultValue={v(s, `c_${i}_value`, c.value)} className={inputClass} />
                  <input name={`c_${i}_hours`} aria-label={`Cenário ${i + 1} horas/mês`} placeholder="h/mês" inputMode="decimal" defaultValue={v(s, `c_${i}_hours`, c.hours)} className={inputClass} />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-base font-semibold">Regras de follow-up</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Follow-up acima de (€)" name="followUpMin" error={e(s, "followUpMin")}>
                <input id="followUpMin" name="followUpMin" inputMode="decimal" defaultValue={v(s, "followUpMin", defaults.followUpMin)} className={inputClass} />
              </Field>
              <Field label="Prioritário acima de (€)" name="followUpPriority" error={e(s, "followUpPriority")}>
                <input id="followUpPriority" name="followUpPriority" inputMode="decimal" defaultValue={v(s, "followUpPriority", defaults.followUpPriority)} className={inputClass} />
              </Field>
              <Field label="1.º alerta sem resposta (dias)" name="followUpFirstAlertDays" error={e(s, "followUpFirstAlertDays")}>
                <input id="followUpFirstAlertDays" name="followUpFirstAlertDays" type="number" min={1} defaultValue={v(s, "followUpFirstAlertDays", defaults.followUpFirstAlertDays)} className={inputClass} />
              </Field>
              <Field label="2.º alerta sem resposta (dias)" name="followUpSecondAlertDays" error={e(s, "followUpSecondAlertDays")}>
                <input id="followUpSecondAlertDays" name="followUpSecondAlertDays" type="number" min={1} defaultValue={v(s, "followUpSecondAlertDays", defaults.followUpSecondAlertDays)} className={inputClass} />
              </Field>
            </div>
          </fieldset>
        </>
      )}
    </SmallForm>
  );
}

export function TemplateForm({ action, categories }: { readonly action: Action; readonly categories: readonly string[] }) {
  return (
    <SmallForm action={action} submitLabel="Gravar template" label="Novo template" className="space-y-3">
      {(s) => (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <Field label="Nome" name="t-name" error={e(s, "name")} className="lg:col-span-2">
            <input id="t-name" name="name" defaultValue={v(s, "name", "")} className={inputClass} />
          </Field>
          <Field label="Categoria" name="t-cat" error={e(s, "category")}>
            <select id="t-cat" name="category" defaultValue={v(s, "category", "Dentisteria")} className={inputClass}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Preço (€)" name="t-price" error={e(s, "price")}>
            <input id="t-price" name="price" inputMode="decimal" defaultValue={v(s, "price", "")} className={inputClass} />
          </Field>
          <Field label="Duração (min)" name="t-dur" error={e(s, "durationMinutes")}>
            <input id="t-dur" name="durationMinutes" type="number" min={5} defaultValue={v(s, "durationMinutes", "45")} className={inputClass} />
          </Field>
          <Field label="Consultas" name="t-visits" error={e(s, "plannedVisits")}>
            <input id="t-visits" name="plannedVisits" type="number" min={1} defaultValue={v(s, "plannedVisits", "1")} className={inputClass} />
          </Field>
          <Field label="Laboratório (€)" name="t-lab" error={e(s, "labCost")}>
            <input id="t-lab" name="labCost" inputMode="decimal" defaultValue={v(s, "labCost", "")} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="favorite" className="h-4 w-4" /> Favorito</label>
        </div>
      )}
    </SmallForm>
  );
}
