/**
 * Utilitários de interface do cliente Apps Script: HTML escapado e componentes
 * simples (cartões, badges, tabelas, campos). Sem framework: o HtmlService serve
 * uma página estática e o iPhone agradece um bundle pequeno.
 */

/** Escapa texto para HTML. Todo o conteúdo dinâmico passa por aqui. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** HTML já seguro (resultado de outro helper). */
export class Safe {
  constructor(readonly html: string) {}
  toString(): string {
    return this.html;
  }
}

export const raw = (s: string) => new Safe(s);

/** Template literal com escape automático: html`<p>${valor}</p>`. Arrays e Safe não são escapados de novo. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Safe {
  let out = strings[0] ?? "";
  values.forEach((v, i) => {
    out += render(v) + (strings[i + 1] ?? "");
  });
  return new Safe(out);
}

function render(v: unknown): string {
  if (v === null || v === undefined || v === false) return "";
  if (v instanceof Safe) return v.html;
  if (Array.isArray(v)) return v.map(render).join("");
  return esc(v);
}

export type Tone = "neutral" | "good" | "warn" | "crit";
const ICON: Record<Tone, string> = { neutral: "•", good: "▲", warn: "!", crit: "▼" };

export function badge(text: string, tone: Tone = "neutral"): Safe {
  return html`<span class="badge ${tone}"><span aria-hidden="true">${ICON[tone]}</span> ${text}</span>`;
}

export interface StatOptions {
  readonly label: string;
  readonly value: string;
  readonly sub?: string | null;
  readonly delta?: string | null;
  readonly tone?: Tone;
  readonly direction?: "up" | "down";
  readonly hint?: string;
  readonly big?: boolean;
  readonly id?: string;
}

export function stat(o: StatOptions): Safe {
  const icon = o.direction === "up" ? "▲" : o.direction === "down" ? "▼" : ICON[o.tone ?? "neutral"];
  return html`<div class="card stat${o.big ? " big" : ""}" ${o.id ? raw(`data-testid="${esc(o.id)}"`) : ""}>
    <div class="stat-head"><span class="label">${o.label}</span>${o.hint ? html`<button type="button" class="hint" data-hint="${o.hint}" aria-label="Definição: ${o.hint}">ⓘ</button>` : ""}</div>
    <div class="value" ${o.id ? raw(`data-testid="${esc(o.id)}-value"`) : ""}>${o.value}</div>
    ${o.delta || o.sub ? html`<div class="sub">${o.delta ? html`<span class="delta ${o.tone ?? "neutral"}"><span aria-hidden="true">${icon}</span> ${o.delta}</span>` : ""}${o.delta && o.sub ? " · " : ""}${o.sub ?? ""}</div>` : ""}
  </div>`;
}

export function section(title: string, body: Safe | string, opts: { desc?: string; actions?: Safe; id?: string } = {}): Safe {
  return html`<section class="section" ${opts.id ? raw(`id="${esc(opts.id)}"`) : ""}>
    <div class="section-head"><div><h2>${title}</h2>${opts.desc ? html`<p class="desc">${opts.desc}</p>` : ""}</div>${opts.actions ?? ""}</div>
    ${typeof body === "string" ? raw(body) : body}
  </section>`;
}

export function pageTitle(title: string, desc?: string, actions?: Safe): Safe {
  return html`<div class="page-title"><div><h1>${title}</h1>${desc ? html`<p class="desc">${desc}</p>` : ""}</div>${actions ? html`<div class="actions">${actions}</div>` : ""}</div>`;
}

export function empty(text: string): Safe {
  return html`<p class="empty">${text}</p>`;
}

export interface Col<T> {
  readonly head: string;
  readonly cell: (row: T) => unknown;
  readonly num?: boolean;
}

export function table<T>(rows: readonly T[], cols: readonly Col<T>[], label: string): Safe {
  return html`<div class="tw" role="region" aria-label="${label}" tabindex="0"><table class="t">
    <thead><tr>${cols.map((c) => html`<th class="${c.num ? "num" : ""}">${c.head}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr>${cols.map((c) => html`<td class="${c.num ? "num" : ""}">${c.cell(r)}</td>`)}</tr>`)}</tbody>
  </table></div>`;
}

export interface FieldOptions {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly value?: string | number | null;
  readonly required?: boolean;
  readonly hint?: string;
  readonly attrs?: string;
  readonly options?: ReadonlyArray<{ value: string; label: string }>;
  readonly list?: string;
  readonly wide?: boolean;
  readonly inputmode?: string;
}

/** Campo de formulário com etiqueta e zona de erro (preenchida pelo servidor). */
export function field(o: FieldOptions): Safe {
  const id = `f-${o.name}-${Math.random().toString(36).slice(2, 7)}`;
  const common = `id="${id}" name="${esc(o.name)}" ${o.required ? "required" : ""} ${o.attrs ?? ""}`;
  const control = o.options
    ? html`<select ${raw(common)}>${o.options.map((opt) => html`<option value="${opt.value}" ${String(o.value ?? "") === opt.value ? raw("selected") : ""}>${opt.label}</option>`)}</select>`
    : html`<input ${raw(common)} type="${o.type ?? "text"}" value="${o.value ?? ""}" ${o.list ? raw(`list="${esc(o.list)}"`) : ""} ${o.inputmode ? raw(`inputmode="${esc(o.inputmode)}"`) : ""} autocomplete="off" />`;
  return html`<div class="field${o.wide ? " wide" : ""}">
    <label for="${id}">${o.label}</label>${control}
    <p class="err" data-err="${o.name}" role="alert"></p>${o.hint ? html`<p class="hint-text">${o.hint}</p>` : ""}
  </div>`;
}

export function checkbox(name: string, label: string, checked: boolean): Safe {
  return html`<label class="check"><input type="checkbox" name="${name}" ${checked ? raw("checked") : ""} /> ${label}</label>`;
}

export function meter(value: number | null, label: string): Safe {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return html`<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="${label}"><div style="width:${pct.toFixed(1)}%"></div></div>`;
}

/** Link interno (hash router). */
export function link(route: string, text: unknown, cls = ""): Safe {
  return html`<a href="#${route}" class="${cls}">${text}</a>`;
}
