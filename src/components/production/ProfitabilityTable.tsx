"use client";

import { useState } from "react";

import { EMPTY, euros, eurosPerHour, hours, percent } from "@/modules/production/domain/format";
import { sortMatrix, type MatrixSort, type ProfitabilityRow } from "@/modules/production/domain/metrics";

import { StatusBadge, TableWrap, td, th } from "./ui";

const SORTS: Array<{ key: MatrixSort; label: string }> = [
  { key: "cph_desc", label: "Maior €/h" },
  { key: "cph_asc", label: "Menor €/h" },
  { key: "revenue_desc", label: "Maior faturação" },
  { key: "cases_desc", label: "Mais casos" },
];

/** Matriz de rentabilidade ordenável (a ordenação é do domínio, aqui só o estado). */
export function ProfitabilityTable({
  rows,
  lowestGoalCph,
  referenceCph,
}: {
  readonly rows: readonly ProfitabilityRow[];
  readonly lowestGoalCph: number | null;
  readonly referenceCph: number | null;
}) {
  const [sort, setSort] = useState<MatrixSort>("cph_desc");
  const sorted = sortMatrix(rows, sort);
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Ordenar" className="flex flex-wrap gap-1.5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={sort === s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${sort === s.key ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <TableWrap label="Matriz de rentabilidade">
        <thead>
          <tr>
            <th className={th}>Procedimento</th>
            <th className={`${th} text-right`}>Casos</th>
            <th className={`${th} text-right`}>Receita</th>
            <th className={`${th} text-right`}>Tempo total</th>
            <th className={`${th} text-right`}>€/hora</th>
            <th className={`${th} text-right`}>Honorários/h</th>
            <th className={`${th} text-right`}>Custos</th>
            <th className={`${th} text-right`}>Margem</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const low = r.centsPerHour !== null && lowestGoalCph !== null && r.centsPerHour < lowestGoalCph;
            const vsRef = r.centsPerHour !== null && referenceCph ? r.centsPerHour / referenceCph - 1 : null;
            return (
              <tr key={r.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className={`${td} font-medium`}>
                  {r.key}
                  <span className="block text-xs font-normal text-slate-500">{r.category}{r.untimedCases ? ` · ${r.untimedCases} sem tempo` : ""}</span>
                </td>
                <td className={`${td} text-right`}>{r.cases}</td>
                <td className={`${td} text-right`}>{euros(r.revenueCents, { round: true })}</td>
                <td className={`${td} text-right`}>{r.chairMinutes ? hours(r.chairMinutes) : EMPTY}</td>
                <td className={`${td} text-right font-semibold`}>
                  {eurosPerHour(r.centsPerHour)}
                  {vsRef !== null ? <span className="block text-xs font-normal text-slate-500">{vsRef >= 0 ? "+" : ""}{percent(vsRef, 0)} vs média</span> : null}
                  {low ? <span className="mt-0.5 block"><StatusBadge tone="warning">Abaixo do objetivo</StatusBadge></span> : null}
                </td>
                <td className={`${td} text-right`}>{eurosPerHour(r.feeCentsPerHour)}</td>
                <td className={`${td} text-right`}>{r.costsCents ? euros(r.costsCents, { round: true }) : "—"}</td>
                <td className={`${td} text-right`}>{euros(r.marginCents, { round: true })}<span className="block text-xs text-slate-500">{percent(r.marginShare, 0)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}
