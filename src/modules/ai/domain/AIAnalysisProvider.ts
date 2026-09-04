/**
 * Contrato neutro de análise por IA.
 *
 * Este ficheiro não importa — e nunca pode importar — qualquer SDK de IA. A
 * escolha do fornecedor é de infraestrutura, feita por configuração.
 *
 * Minimização de dados por construção: `AnalysisInput` só aceita métricas já
 * agregadas. Não há aqui espaço para nomes, contactos, notas clínicas ou linhas
 * brutas de pacientes — não é uma regra a lembrar, é o tipo que não o permite.
 */
import { z } from "zod";

export const analysisMetricSchema = z.object({
  /** Chave do KPI no catálogo. */
  key: z.string().min(1),
  name: z.string().min(1),
  /** Valor agregado. `null` significa "sem dados", nunca zero. */
  value: z.number().nullable(),
  unit: z.enum(["COUNT", "PERCENTAGE", "CURRENCY_CENTS"]),
  /** Valor do período anterior de duração equivalente. */
  previousValue: z.number().nullable(),
  definitionVersion: z.int().positive(),
});

export const analysisInputSchema = z.object({
  period: z.object({
    fromDate: z.string(),
    toDate: z.string(),
    timeZone: z.string(),
  }),
  previousPeriod: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  filters: z.object({
    /** Identificadores internos, não nomes de clínica. */
    clinicIds: z.array(z.string()).default([]),
    practitionerIds: z.array(z.string()).default([]),
  }),
  metrics: z.array(analysisMetricSchema),
});

export const analysisObservationSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  /** Chaves de KPI que sustentam a observação. */
  evidenceKeys: z.array(z.string()),
  severity: z.enum(["INFO", "ATTENTION", "CRITICAL"]),
});

export const analysisResultSchema = z.object({
  status: z.enum(["OK", "DISABLED", "UNAVAILABLE"]),
  providerId: z.string().min(1),
  observations: z.array(analysisObservationSchema),
  /** Limitações e ressalvas que o utilizador tem de ver junto ao resultado. */
  warnings: z.array(z.string()),
  generatedAt: z.date(),
});

export type AnalysisMetric = z.infer<typeof analysisMetricSchema>;
export type AnalysisInput = z.infer<typeof analysisInputSchema>;
export type AnalysisObservation = z.infer<typeof analysisObservationSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export interface AIAnalysisProvider {
  readonly id: string;
  readonly isEnabled: boolean;
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
}
