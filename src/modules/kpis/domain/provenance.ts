/**
 * Proveniência de um resultado de KPI.
 *
 * Um número no dashboard tem de conseguir responder a "de onde veio isto?".
 * Esta estrutura carrega tudo o que é preciso para o justificar: a versão da
 * definição, o período, os filtros aplicados, o numerador e o denominador, os
 * lotes de importação que o originaram e quando esses dados entraram.
 *
 * Sem isto, um KPI é uma afirmação sem prova — e a gestão acaba a decidir com
 * base num número que ninguém consegue reconstruir.
 */
import type { CivilDate } from "@/modules/kpis/domain/period";

export interface AppliedFilters {
  /** Nome da clínica, ou `null` quando não há filtro. */
  readonly clinic: string | null;
  readonly practitioner: string | null;
}

export interface SourceBatch {
  readonly id: string;
  readonly originalFilename: string;
  /** Hash abreviado: identifica o ficheiro sem o expor. */
  readonly shortHash: string;
  readonly committedAt: Date | null;
  /** Verdadeiro enquanto o perfil de mapeamento for sintético. */
  readonly isSynthetic: boolean;
}

export interface KpiProvenance {
  readonly definitionVersion: number;
  readonly definitionApproved: boolean;
  readonly formula: string;
  readonly sources: readonly string[];
  readonly period: { readonly fromDate: CivilDate; readonly toDate: CivilDate };
  readonly comparisonPeriod: { readonly fromDate: CivilDate; readonly toDate: CivilDate };
  readonly timeZone: string;
  readonly filters: AppliedFilters;
  readonly numerator: number;
  readonly denominator: number | null;
  readonly batches: readonly SourceBatch[];
  /**
   * Momento em que o lote mais recente foi confirmado.
   * `null` quando não há dados — e nesse caso o ecrã diz "sem dados", não uma data.
   */
  readonly lastUpdatedAt: Date | null;
}

/** Resume os filtros em texto legível, para caber numa linha do ecrã. */
export function describeFilters(filters: AppliedFilters): string {
  const parts: string[] = [];
  parts.push(filters.clinic === null ? "todas as clínicas" : filters.clinic);
  parts.push(filters.practitioner === null ? "todos os médicos" : filters.practitioner);
  return parts.join(" · ");
}

/** Data em que os dados subjacentes foram atualizados pela última vez. */
export function lastCommittedAt(batches: readonly SourceBatch[]): Date | null {
  const dates = batches
    .map((batch) => batch.committedAt)
    .filter((date): date is Date => date !== null);

  if (dates.length === 0) {
    return null;
  }
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}

/** Verdadeiro se algum dos lotes de origem veio de um perfil sintético. */
export function hasSyntheticSource(batches: readonly SourceBatch[]): boolean {
  return batches.some((batch) => batch.isSynthetic);
}
