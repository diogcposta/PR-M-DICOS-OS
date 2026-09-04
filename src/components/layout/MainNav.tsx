"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/imports", label: "Importações" },
  { href: "/kpis", label: "Catálogo de KPIs" },
] as const;

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex gap-1">
      {NAV_ITEMS.map((item) => {
        const isCurrent =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
