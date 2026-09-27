/**
 * Gráficos em SVG próprio (sem biblioteca): leves e nítidos no iPhone.
 * Regras: um só eixo, cores por série em ordem fixa (paleta validada da app
 * Next), valores exatos em tabela ou etiqueta — nunca só cor.
 */
import { formatNumber } from "@/modules/production/domain/format";

import { esc, html, raw, type Safe } from "./ui";

export type Kind = "euros" | "eurosPerHour" | "percent" | "hours" | "count";

export function fmt(value: number | null | undefined, kind: Kind, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "sem dados";
  switch (kind) {
    case "euros":
      return compact && Math.abs(value) >= 1000 ? `€${formatNumber(value / 1000, 1)}k` : `€${formatNumber(value, 0)}`;
    case "eurosPerHour":
      return `${formatNumber(value, 0)} €/h`;
    case "percent":
      return `${formatNumber(value * 100, compact ? 0 : 1)}%`;
    case "hours":
      return `${formatNumber(value, 1)} h`;
    case "count":
      return formatNumber(value, 0);
  }
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const W = 640;

/** Barras empilhadas: produção real + perdida com faltas (= potencial). */
export function stackedBars(points: ReadonlyArray<{ label: string; a: number; b: number }>, names: [string, string]): Safe {
  const H = 220;
  const pad = { l: 52, r: 8, t: 10, b: 26 };
  const max = niceMax(Math.max(1, ...points.map((p) => p.a + p.b)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = Math.min(56, (iw / Math.max(1, points.length)) * 0.6);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const bars = points.map((p, i) => {
    const cx = pad.l + (iw / points.length) * (i + 0.5);
    const x = cx - bw / 2;
    return `<g><title>${esc(p.label)}: ${esc(names[0])} ${esc(fmt(p.a, "euros"))}; ${esc(names[1])} ${esc(fmt(p.b, "euros"))}</title>
      <rect x="${x}" y="${y(p.a)}" width="${bw}" height="${Math.max(0, y(0) - y(p.a))}" fill="var(--s1)"/>
      <rect x="${x}" y="${y(p.a + p.b)}" width="${bw}" height="${Math.max(0, y(p.a) - y(p.a + p.b))}" fill="var(--s2)" rx="3"/>
      <text x="${cx}" y="${H - 8}" text-anchor="middle" class="ax">${esc(p.label)}</text></g>`;
  });
  return html`<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${names[0]} e ${names[1]} por mês">
    ${raw(ticks.map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${esc(fmt(t, "euros", true))}</text>`).join(""))}
    ${raw(bars.join(""))}
  </svg><figcaption class="legend"><span><i style="background:var(--s1)"></i>${names[0]}</span><span><i style="background:var(--s2)"></i>${names[1]}</span></figcaption></figure>`;
}

/** Linha mensal + média móvel (tracejada). Meses sem dados interrompem a linha. */
export function lineChart(points: ReadonlyArray<{ label: string; value: number | null; avg: number | null }>, kind: Kind, name: string): Safe {
  const H = 170;
  const pad = { l: 52, r: 10, t: 10, b: 24 };
  const vals = points.flatMap((p) => [p.value, p.avg]).filter((v): v is number => v !== null);
  const max = niceMax(Math.max(kind === "percent" ? 0.01 : 1, ...vals));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (iw / (points.length - 1)) * i);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = (key: "value" | "avg") => {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const dots = points
    .map((p, i) => (p.value === null ? "" : `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="var(--s1)"><title>${esc(p.label)}: ${esc(fmt(p.value, kind))}</title></circle>`))
    .join("");
  const labels = points
    .map((p, i) => (i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ax">${esc(p.label)}</text>` : ""))
    .join("");
  return html`<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${name}: evolução mensal e média móvel de 3 meses">
    ${raw(ticks.map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${esc(fmt(t, kind, true))}</text>`).join(""))}
    <path d="${path("avg")}" fill="none" stroke="var(--s4)" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="${path("value")}" fill="none" stroke="var(--s1)" stroke-width="2.5"/>
    ${raw(dots)}${raw(labels)}
  </svg><figcaption class="legend"><span><i style="background:var(--s1)"></i>${name}</span><span><i class="dash"></i>Média 3 meses</span></figcaption></figure>`;
}

/** Barras horizontais de uma série (ex.: €/h por categoria), com valor escrito. */
export function hbars(rows: ReadonlyArray<{ label: string; value: number }>, kind: Kind, reference?: number | null): Safe {
  const max = Math.max(1, ...rows.map((r) => r.value), reference ?? 0);
  return html`<ul class="hbars">${rows.map(
    (r) => html`<li><span class="hb-label">${r.label}</span><span class="hb-track"><span class="hb-bar" style="width:${((r.value / max) * 100).toFixed(1)}%"></span>${reference ? html`<span class="hb-ref" style="left:${((reference / max) * 100).toFixed(1)}%"></span>` : ""}</span><span class="hb-val">${fmt(r.value, kind)}</span></li>`,
  )}</ul>${reference ? html`<p class="hint-text">Linha vertical: média global (${fmt(reference, kind)}).</p>` : ""}`;
}
