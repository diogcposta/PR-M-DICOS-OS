"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/producao", label: "Produção clínica" },
  { href: "/", label: "Clínica" },
  { href: "/imports", label: "Importações" },
  { href: "/qualidade", label: "Qualidade dos dados" },
  { href: "/kpis", label: "Catálogo de KPIs" },
] as const;

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-wrap gap-1">
      {NAV_ITEMS.map((item) => {
        const isCurrent =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              isCurrent
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
