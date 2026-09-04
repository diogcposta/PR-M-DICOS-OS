/**
 * Normaliza os carimbos temporais de um ficheiro ZIP (e portanto de um .xlsx).
 *
 * Porquê: o conteúdo que o ExcelJS produz é determinístico, mas o contentor ZIP
 * grava a hora de escrita em cada entrada. Isso muda os bytes — e com eles o
 * SHA-256 — a cada geração, o que faria o importador ver um ficheiro "novo" de
 * cada vez e tornaria impossível demonstrar o bloqueio de reimportação.
 *
 * Percorremos o diretório central em vez de procurar assinaturas no ficheiro
 * inteiro: uma sequência `PK\x03\x04` pode aparecer por acaso dentro de dados
 * comprimidos, e corrigi-la corromperia o ficheiro.
 */
import { readFile, writeFile } from "node:fs/promises";

/** 1980-01-01 00:00:00 — o instante mais antigo que o formato DOS representa. */
const DOS_EPOCH_TIME = 0x0000;
const DOS_EPOCH_DATE = 0x0021;

const EOCD_SIGNATURE = 0x0605_4b50;
const CENTRAL_SIGNATURE = 0x0201_4b50;
const LOCAL_SIGNATURE = 0x0403_4b50;

/** Localiza o "End of Central Directory", que vive no fim do ficheiro. */
function findEndOfCentralDirectory(buffer: Buffer): number {
  // Mínimo 22 bytes; o comentário final pode ter até 64 KiB.
  const start = Math.max(0, buffer.length - (22 + 0xffff));
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("ZIP inválido: não foi encontrado o End of Central Directory.");
}

/** Reescreve o ficheiro com todos os carimbos temporais fixos. Idempotente. */
export async function normalizeZipTimestamps(filePath: string): Promise<void> {
  const buffer = await readFile(filePath);
  const eocd = findEndOfCentralDirectory(buffer);

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error(`ZIP inválido: entrada ${index} do diretório central corrompida.`);
    }

    // Carimbo na entrada do diretório central.
    buffer.writeUInt16LE(DOS_EPOCH_TIME, cursor + 12);
    buffer.writeUInt16LE(DOS_EPOCH_DATE, cursor + 14);

    // E o mesmo carimbo no cabeçalho local correspondente.
    const localOffset = buffer.readUInt32LE(cursor + 42);
    if (buffer.readUInt32LE(localOffset) === LOCAL_SIGNATURE) {
      buffer.writeUInt16LE(DOS_EPOCH_TIME, localOffset + 10);
      buffer.writeUInt16LE(DOS_EPOCH_DATE, localOffset + 12);
    }

    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  await writeFile(filePath, buffer);
}
