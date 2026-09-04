"use client";

/**
 * Filtros do dashboard.
 *
 * O estado vive no URL, não em React: um dashboard filtrado é partilhável,
 * marcável e sobrevive ao refresh. Submete como formulário GET normal, por isso
 * também funciona sem JavaScript.
 */
import Link from "next/link";

import type { FilterOption } from "@/modules/kpis/infrastructure/appointment-queries";

export function DashboardFilters({
  fromDate,
  toDate,
  clinicId,
  practitionerId,
  clinics,
  practitioners,
}: {
  readonly fromDate: string;
  readonly toDate: string;
  readonly clinicId: string | undefined;
  readonly practitionerId: string | undefined;
  readonly clinics: readonly FilterOption[];
  readonly practitioners: readonly FilterOption[];
}) {
  return (
    <form
      method="get"
      action="/"
      data-testid="dashboard-filters"
      className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <label htmlFor="de" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          De
        </label>
        <input
          id="de"
          name="de"
          type="date"
          defaultValue={fromDate}
          data-testid="filter-from"
          className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <div>
        <label htmlFor="ate" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Até
        </label>
        <input
          id="ate"
          name="ate"
          type="date"
          defaultValue={toDate}
          data-testid="filter-to"
          className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <div>
        <label
          htmlFor="clinica"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Clínica
        </label>
        <select
          id="clinica"
          name="clinica"
          defaultValue={clinicId ?? ""}
          data-testid="filter-clinic"
          className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Todas</option>
          {clinics.map((clinic) => (
            <option key={clinic.id} value={clinic.id}>
              {clinic.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="medico"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Médico
        </label>
        <select
          id="medico"
          name="medico"
          defaultValue={practitionerId ?? ""}
          data-testid="filter-practitioner"
          className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Todos</option>
          {practitioners.map((practitioner) => (
            <option key={practitioner.id} value={practitioner.id}>
              {practitioner.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        data-testid="apply-filters"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Aplicar
      </button>

      <Link
        href="/"
        className="text-sm text-slate-600 underline underline-offset-4 dark:text-slate-400"
      >
        Limpar
      </Link>
    </form>
  );
}
