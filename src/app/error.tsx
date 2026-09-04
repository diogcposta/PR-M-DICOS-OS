"use client";

/**
 * Erro do dashboard.
 *
 * Tem de ser componente de cliente — é uma exigência do App Router para
 * limites de erro. Mostra uma mensagem compreensível e um botão para tentar de
 * novo; nunca a stack trace nem detalhe interno, que podia conter algo que não
 * deveria ir para o ecrã (CLAUDE.md: nunca registar conteúdo sensível em locais
 * visíveis ao utilizador final).
 */
import { useEffect } from "react";

import { PageHeader } from "@/components/ui/PageHeader";

export default function DashboardError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // Só o digest (um identificador opaco) vai para a consola — nunca a
    // mensagem completa, que pode incluir detalhes de infraestrutura.
    console.error("Erro no dashboard", { digest: error.digest });
  }, [error]);

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Não foi possível calcular os indicadores." />
      <div
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-6 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <p className="font-medium">Ocorreu um erro ao carregar o dashboard.</p>
        <p className="mt-2">
          Os dados importados não foram afetados. Tente novamente; se o problema persistir,
          verifique a ligação à base de dados.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 rounded-md bg-red-900 px-4 py-2 text-sm font-medium text-white dark:bg-red-100 dark:text-red-950"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
