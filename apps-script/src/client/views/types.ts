import { parsePeriod, type SelectedPeriod } from "@/modules/production/application/period";
import { latestMonth } from "@/modules/production/domain/views";

import type { State } from "../state";
import { html, raw, type Safe } from "../ui";

export interface Ctx {
  readonly state: State;
  readonly path: string;
  readonly segments: readonly string[];
  readonly params: URLSearchParams;
  go(route: string): void;
  rerender(): void;
}

export interface View {
  readonly title: string;
  readonly body: Safe;
  mount?(root: HTMLElement, ctx: Ctx): void;
}

/** Período do URL (`?mes=2026-09&periodo=3m`), por omissão o mês mais recente com dados. */
export function periodOf(ctx: Ctx, defaultPreset = "mes"): SelectedPeriod {
  const params: Record<string, string | undefined> = { periodo: defaultPreset };
  ctx.params.forEach((v, k) => (params[k] = v));
  return parsePeriod(params, latestMonth(ctx.state.procedures, ctx.state.today));
}

/** Seletor de mês/período (muda o URL, sem ida ao servidor). */
export function periodPicker(period: SelectedPeriod, presets = true): Safe {
  return html`<form class="period" data-period>
    <label>Mês <input type="month" name="mes" value="${period.month}" /></label>
    ${presets
      ? html`<label>Período <select name="periodo">${[
          ["mes", "Mês"],
          ["3m", "3 meses"],
          ["6m", "6 meses"],
          ["12m", "12 meses"],
        ].map(([v, l]) => html`<option value="${v}" ${period.key === v ? raw("selected") : ""}>${l}</option>`)}</select></label>`
      : ""}
  </form>`;
}
