"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atalhos globais (fora de campos de texto): N = novo procedimento, D = dashboard, A = agenda. */
const SHORTCUTS: Record<string, string> = { n: "/producao/procedimentos/novo", d: "/producao", a: "/producao/agenda" };

const ITEMS = [
  { href: "/producao", label: "Dashboard" },
  { href: "/producao/procedimentos/novo", label: "+ Registar", accent: true },
  { href: "/producao/dias", label: "Dias clínicos" },
  { href: "/producao/procedimentos", label: "Procedimentos" },
  { href: "/producao/rentabilidade", label: "Rentabilidade" },
  { href: "/producao/seguros", label: "Seguros" },
  { href: "/producao/faltas", label: "Faltas" },
  { href: "/producao/planos", label: "Planos" },
  { href: "/producao/agenda", label: "Agenda" },
  { href: "/producao/simulador", label: "What if?" },
  { href: "/producao/tendencias", label: "Tendências" },
  { href: "/producao/relatorio", label: "Relatório" },
  { href: "/producao/dados", label: "Importar/Exportar" },
  { href: "/producao/definicoes", label: "Definições" },
] as const;

export function SubNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const href = SHORTCUTS[e.key.toLowerCase()];
      if (href) {
        e.preventDefault();
        router.push(href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const current = (href: string) => {
    if (href === "/producao") return pathname === "/producao";
    if (href === "/producao/procedimentos") return pathname.startsWith(href) && !pathname.endsWith("/novo");
    return pathname.startsWith(href);
  };
  return (
    <nav aria-label="Secções do Clinical Production Dashboard" className="no-print -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-slate-200 pb-px dark:border-slate-800">
        {ITEMS.map((item) => {
          const active = current(item.href);
          const accent = "accent" in item && item.accent;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.href === "/producao/procedimentos/novo" ? "Atalho: N" : item.href === "/producao" ? "Atalho: D" : item.href === "/producao/agenda" ? "Atalho: A" : undefined}
                className={`-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                    : accent
                      ? "border-transparent text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
