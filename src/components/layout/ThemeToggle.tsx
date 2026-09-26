"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

const LABELS: Record<Theme, string> = { system: "Tema do sistema", light: "Tema claro", dark: "Tema escuro" };
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const SHORT: Record<Theme, string> = { system: "Auto", light: "Claro", dark: "Escuro" };

function read(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return value === "light" || value === "dark" ? value : "system";
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Script inline que aplica o tema guardado antes da primeira pintura (sem flash). */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  function cycle() {
    const next = NEXT[theme];
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Sem localStorage (modo privado): o tema muda só nesta sessão.
    }
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
    listeners.forEach((l) => l());
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label={`${LABELS[theme]} (clicar para mudar)`}
      title={LABELS[theme]}
    >
      <span aria-hidden="true">{SHORT[theme]}</span>
    </button>
  );
}
