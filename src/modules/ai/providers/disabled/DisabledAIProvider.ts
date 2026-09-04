/**
 * Fornecedor de IA desativado — a implementação usada no MVP.
 *
 * Não faz rede, não lança exceções e não degrada o dashboard: devolve um
 * resultado estruturado a dizer que a análise está desligada. O dashboard tem
 * de funcionar na íntegra com este fornecedor.
 */
import type {
  AIAnalysisProvider,
  AnalysisInput,
  AnalysisResult,
} from "@/modules/ai/domain/AIAnalysisProvider";

export class DisabledAIProvider implements AIAnalysisProvider {
  readonly id = "disabled";
  readonly isEnabled = false;

  analyze(_input: AnalysisInput): Promise<AnalysisResult> {
    void _input;
    return Promise.resolve({
      status: "DISABLED",
      providerId: this.id,
      observations: [],
      warnings: [
        "A análise assistida por IA está desativada nesta instalação. Os KPIs são calculados de forma determinística e não dependem deste fornecedor.",
      ],
      generatedAt: new Date(),
    });
  }
}
