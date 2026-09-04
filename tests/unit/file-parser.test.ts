import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  FileRejectedError,
  assertAcceptableFile,
  hashFileContent,
  parseImportFile,
} from "@/modules/imports/infrastructure/file-parser";

const FIXTURES = path.join(process.cwd(), "tests/fixtures");

async function fixture(name: string): Promise<Buffer> {
  return readFile(path.join(FIXTURES, name));
}

describe("aceitação do ficheiro", () => {
  it("aceita .csv e .xlsx", () => {
    expect(assertAcceptableFile("agenda.csv", 100)).toBe("csv");
    expect(assertAcceptableFile("AGENDA.XLSX", 100)).toBe("xlsx");
  });

  it("recusa outros tipos, ficheiros vazios e demasiado grandes", () => {
    expect(() => assertAcceptableFile("agenda.pdf", 100)).toThrow(FileRejectedError);
    expect(() => assertAcceptableFile("agenda.csv", 0)).toThrow(/vazio/);
    expect(() => assertAcceptableFile("agenda.csv", 21 * 1024 * 1024)).toThrow(/limite/);
  });
});

describe("SHA-256", () => {
  it("é estável para o mesmo conteúdo e diferente para conteúdos diferentes", async () => {
    const a = await fixture("agenda-valida.csv");
    const b = await fixture("agenda-com-erros.csv");
    expect(hashFileContent(a)).toBe(hashFileContent(a));
    expect(hashFileContent(a)).not.toBe(hashFileContent(b));
    expect(hashFileContent(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parser CSV", () => {
  it("deteta o ponto e vírgula usado nas exportações portuguesas", async () => {
    const parsed = await parseImportFile("csv", await fixture("agenda-valida.csv"));
    expect(parsed.detectedDelimiter).toBe(";");
  });

  it("lê cabeçalhos e linhas", async () => {
    const parsed = await parseImportFile("csv", await fixture("agenda-valida.csv"));
    const sheet = parsed.sheets[0];
    expect(sheet?.headers).toEqual([
      "id_consulta",
      "data_hora",
      "id_clinica",
      "id_medico",
      "ref_paciente",
      "estado",
      "duracao_min",
    ]);
    expect(sheet?.rows).toHaveLength(6);
    expect(sheet?.rows[0]?.["id_consulta"]).toBe("SYN-0001");
  });
});

describe("parser XLSX", () => {
  it("lista todas as folhas do livro", async () => {
    const parsed = await parseImportFile("xlsx", await fixture("agenda-valida.xlsx"));
    expect(parsed.sheets.map((sheet) => sheet.name)).toEqual(["Agenda", "Notas"]);
  });

  it("lê o mesmo conteúdo que o CSV equivalente", async () => {
    const parsed = await parseImportFile("xlsx", await fixture("agenda-valida.xlsx"));
    const sheet = parsed.sheets[0];
    expect(sheet?.headers[0]).toBe("id_consulta");
    expect(sheet?.rows).toHaveLength(6);
    expect(sheet?.rows[5]?.["estado"]).toBe("Realizada");
  });

  it("recusa um ficheiro que não seja Excel", async () => {
    await expect(parseImportFile("xlsx", Buffer.from("isto não é um xlsx"))).rejects.toThrow(
      FileRejectedError,
    );
  });
});
