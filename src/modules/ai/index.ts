/**
 * Seleção do fornecedor de análise por configuração.
 *
 * `disabled` é o único fornecedor do MVP. Uma futura implementação OpenAI viverá
 * em `modules/ai/providers/openai` e será acrescentada aqui — sem que o domínio,
 * os KPIs ou a importação passem a conhecer qualquer SDK.
 */
import type { AIAnalysisProvider } from "@/modules/ai/domain/AIAnalysisProvider";
import { DisabledAIProvider } from "@/modules/ai/providers/disabled/DisabledAIProvider";

export type AIProviderId = "disabled";

export function createAIAnalysisProvider(providerId: AIProviderId): AIAnalysisProvider {
  switch (providerId) {
    case "disabled":
      return new DisabledAIProvider();
  }
}

export type {
  AIAnalysisProvider,
  AnalysisInput,
  AnalysisResult,
} from "@/modules/ai/domain/AIAnalysisProvider";
