/**
 * Exames complementares (ortopantomografia, CBCT…) pedidos pelo médico e feitos
 * pelos seus pacientes na clínica.
 *
 * O médico recebe sobre o valor do exame a mesma percentagem dos atos (D-059).
 * Os exames ficam à parte da produção clínica: não usam tempo de cadeira do
 * médico, por isso não entram na produção do mês nem no €/hora.
 */
import { feeFromBase } from "./metrics";

export interface ExamRecord {
  readonly id: string;
  /** Data civil `aaaa-mm-dd`. */
  readonly date: string;
  readonly examType: string;
  readonly caseCode: string | null;
  readonly billedCents: number;
}

export interface ExamTypeTotals {
  readonly examType: string;
  readonly count: number;
  readonly billedCents: number;
  readonly feeCents: number;
}

export interface ExamTotals {
  readonly count: number;
  readonly billedCents: number;
  /** Soma dos honorários de cada exame (um arredondamento ao cêntimo por exame, como nos atos). */
  readonly feeCents: number;
  /** Por tipo, do maior valor faturado para o menor. */
  readonly byType: readonly ExamTypeTotals[];
}

/** Totais dos exames com data entre `from` e `to` (inclusive). */
export function examTotals(exams: readonly ExamRecord[], from: string, to: string, feeBps: number): ExamTotals {
  const byType = new Map<string, { count: number; billedCents: number; feeCents: number }>();
  let count = 0;
  let billedCents = 0;
  let feeCents = 0;
  for (const exam of exams) {
    if (exam.date < from || exam.date > to) continue;
    const fee = feeFromBase(exam.billedCents, feeBps);
    count += 1;
    billedCents += exam.billedCents;
    feeCents += fee;
    const acc = byType.get(exam.examType) ?? { count: 0, billedCents: 0, feeCents: 0 };
    acc.count += 1;
    acc.billedCents += exam.billedCents;
    acc.feeCents += fee;
    byType.set(exam.examType, acc);
  }
  return {
    count,
    billedCents,
    feeCents,
    byType: [...byType.entries()]
      .map(([examType, t]) => ({ examType, ...t }))
      .sort((a, b) => b.billedCents - a.billedCents || a.examType.localeCompare(b.examType, "pt")),
  };
}
