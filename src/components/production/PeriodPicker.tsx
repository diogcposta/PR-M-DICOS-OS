import { PERIOD_PRESETS, type SelectedPeriod } from "@/modules/production/application/period";

import { btnSecondary, inputClass } from "./ui";

/** Formulário GET: mês de referência + amplitude. Funciona sem JavaScript. */
export function PeriodPicker({
  period,
  presets = true,
}: {
  readonly period: SelectedPeriod;
  readonly presets?: boolean;
}) {
  return (
    <form method="get" className="no-print flex flex-wrap items-end gap-2" aria-label="Escolher período">
      <div>
        <label htmlFor="mes" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Mês
        </label>
        <input id="mes" name="mes" type="month" defaultValue={period.month} className={`${inputClass} w-40`} />
      </div>
      {presets ? (
        <div>
          <label htmlFor="periodo" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Período
          </label>
          <select id="periodo" name="periodo" defaultValue={period.key} className={`${inputClass} w-32`}>
            {PERIOD_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button type="submit" className={btnSecondary}>
        Ver
      </button>
    </form>
  );
}
