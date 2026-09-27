import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { MainNav } from "@/components/layout/MainNav";
import { THEME_SCRIPT, ThemeToggle } from "@/components/layout/ThemeToggle";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PR Médicos OS", template: "%s · PR Médicos OS" },
  description:
    "Gestão analítica para clínicas e Clinical Production Dashboard: produção, honorários, faltas, planos e eficiência da agenda.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

// Props explícitas em vez do global `LayoutProps` gerado pelo Next: assim
// `tsc --noEmit` funciona sem depender de um build prévio.
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="pt-PT" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar para o conteúdo
        </a>

        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <p className="text-base font-semibold tracking-tight">PR Médicos OS</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dados de demonstração sintéticos — sem dados identificáveis de pacientes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MainNav />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 sm:px-6 dark:text-slate-400">
            Indicadores operacionais e económicos. Não medem qualidade clínica; a decisão clínica
            pertence sempre ao médico.
          </div>
        </footer>
      </body>
    </html>
  );
}
