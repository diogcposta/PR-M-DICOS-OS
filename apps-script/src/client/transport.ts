/**
 * Chamadas ao servidor Apps Script (`google.script.run`). Uma única função de
 * servidor (`api`) recebe o nome da operação; a resposta vem em JSON.
 */
import type { ApiResult, Operation } from "../server/api";

interface ScriptRun {
  withSuccessHandler(fn: (value: string) => void): ScriptRun;
  withFailureHandler(fn: (error: Error) => void): ScriptRun;
  api(name: string, args: unknown[]): void;
}

declare const google: { script: { run: ScriptRun } };

export function call(name: Operation, ...args: unknown[]): Promise<ApiResult> {
  return new Promise((resolve) => {
    google.script.run
      .withSuccessHandler((json) => {
        try {
          resolve(JSON.parse(json) as ApiResult);
        } catch {
          resolve({ ok: false, message: "Resposta inválida do servidor.", errors: {} });
        }
      })
      .withFailureHandler((error) =>
        resolve({
          ok: false,
          message: `Sem ligação ao Google Apps Script (${error?.message ?? "erro desconhecido"}). Verifique a internet e tente de novo.`,
          errors: {},
        }),
      )
      .api(name, args);
  });
}
