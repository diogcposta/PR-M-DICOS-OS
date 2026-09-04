import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MainNav } from "@/components/layout/MainNav";

import "./globals.css";

export const metadata: Metadata = {
  title: "PR Médicos OS",
  description:
    "Gestão analítica para clínicas: importação manual de exportações, histórico preservado e KPIs com definição explícita.",
};

// Props explícitas em vez do global `LayoutProps` gerado pelo Next: assim
// `tsc --noEmit` funciona sem depender de um build prévio.
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="pt-PT" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar para o conteúdo
        </a>

        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-base font-semibold tracking-tight">PR Médicos OS</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ambiente de desenvolvimento — apenas dados sintéticos
              </p>
            </div>
            <MainNav />
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
            Fase 4A — demonstração com dados sintéticos avançados. A adaptação aos ficheiros reais
            do Newsoft (Fase 4) está pendente de amostras anonimizadas.
          </div>
        </footer>
      </body>
    </html>
  );
}
