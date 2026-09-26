const MAX_DOCUMENT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 1_500_000;
const MAX_EXTRACTED_TEXT_BYTES = 250_000;
const MAX_ZIP_ENTRIES = 128;

export class UnsupportedResumeDocumentError extends Error {
  constructor(message = "The resume does not contain readable text.") {
    super(message);
    this.name = "UnsupportedResumeDocumentError";
  }
}

export async function extractResumeText(
  bytes: Uint8Array,
  contentType:
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
): Promise<string> {
  if (bytes.byteLength > MAX_DOCUMENT_FILE_BYTES)
    throw new UnsupportedResumeDocumentError(
      "The resume exceeds the extraction size limit.",
    );
  let text: string;
  try {
    text =
      contentType === "application/pdf"
        ? await extractPdfText(bytes)
        : await extractDocxText(bytes);
  } catch (error) {
    if (error instanceof UnsupportedResumeDocumentError) throw error;
    throw new UnsupportedResumeDocumentError(
      "The resume format or encoding is not supported.",
    );
  }
  const normalized = normalizeDocumentText(text);
  if (!normalized) throw new UnsupportedResumeDocumentError();
  if (
    new TextEncoder().encode(normalized).byteLength > MAX_EXTRACTED_TEXT_BYTES
  )
    throw new UnsupportedResumeDocumentError(
      "The extracted text exceeds the 250 KB limit.",
    );
  return normalized;
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const documentXml = await readZipEntry(bytes, "word/document.xml");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(documentXml);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new UnsupportedResumeDocumentError(
      "The document contains unsupported XML declarations.",
    );
  const output: string[] = [];
  let outputLength = 0;
  const pieces =
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:tab|br|cr)(?:\s[^>]*)?\/>|<\/w:p>/g;
  for (const match of xml.matchAll(pieces)) {
    const piece = match[1] !== undefined ? decodeXmlText(match[1]) : "\n";
    output.push(piece);
    outputLength += piece.length;
    if (outputLength > MAX_DECOMPRESSED_BYTES)
      throw new UnsupportedResumeDocumentError(
        "The extracted document text is too large.",
      );
  }
  return output.join("");
}

async function readZipEntry(
  bytes: Uint8Array,
  wantedName: string,
): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endRecord = findEndOfCentralDirectory(bytes);
  const entryCount = view.getUint16(endRecord + 10, true);
  let cursor = view.getUint32(endRecord + 16, true);
  if (entryCount > MAX_ZIP_ENTRIES)
    throw new UnsupportedResumeDocumentError(
      "The Word document contains too many archive entries.",
    );

  for (let index = 0; index < entryCount; index += 1) {
    requireRange(bytes, cursor, 46);
    if (view.getUint32(cursor, true) !== 0x02014b50)
      throw new UnsupportedResumeDocumentError(
        "The Word document archive is invalid.",
      );
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    requireRange(bytes, cursor + 46, nameLength + extraLength + commentLength);
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    if (name === wantedName) {
      if ((flags & 0x1) !== 0)
        throw new UnsupportedResumeDocumentError(
          "Encrypted Word documents are not supported.",
        );
      if (
        uncompressedSize > MAX_DECOMPRESSED_BYTES ||
        compressedSize > bytes.byteLength
      )
        throw new UnsupportedResumeDocumentError(
          "The Word document text is too large.",
        );
      requireRange(bytes, localOffset, 30);
      if (view.getUint32(localOffset, true) !== 0x04034b50)
        throw new UnsupportedResumeDocumentError(
          "The Word document archive is invalid.",
        );
      const localFlags = view.getUint16(localOffset + 6, true);
      if (
        (localFlags & 0x1) !== 0 ||
        view.getUint16(localOffset + 8, true) !== method
      )
        throw new UnsupportedResumeDocumentError(
          "The Word document archive is invalid.",
        );
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      requireRange(bytes, dataStart, compressedSize);
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
      let result: Uint8Array;
      if (method === 0) result = compressed.slice();
      else if (method === 8)
        result = await decompress(compressed, "deflate-raw");
      else
        throw new UnsupportedResumeDocumentError(
          "The Word document uses an unsupported compression method.",
        );
      if (result.byteLength !== uncompressedSize)
        throw new UnsupportedResumeDocumentError(
          "The Word document archive is incomplete.",
        );
      if (crc32(result) !== crc)
        throw new UnsupportedResumeDocumentError(
          "The Word document archive failed its integrity check.",
        );
      return result;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new UnsupportedResumeDocumentError(
    "The Word document has no readable main document part.",
  );
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength !== bytes.byteLength) continue;
    if (
      view.getUint16(offset + 4, true) !== 0 ||
      view.getUint16(offset + 6, true) !== 0 ||
      view.getUint16(offset + 8, true) !== view.getUint16(offset + 10, true)
    )
      continue;
    return offset;
  }
  throw new UnsupportedResumeDocumentError(
    "The Word document archive is invalid.",
  );
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const source = decodeByteString(bytes);
  if (!source.startsWith("%PDF-"))
    throw new UnsupportedResumeDocumentError(
      "The uploaded file is not a readable PDF.",
    );
  if (/\/Encrypt\b/.test(source))
    throw new UnsupportedResumeDocumentError(
      "Encrypted PDFs are not supported.",
    );
  if (
    /\/ToUnicode\b|\/Subtype\s*\/Type0\b|\/Differences\b|\/BaseFont\s*\/(?:Symbol|ZapfDingbats)\b/.test(
      source,
    )
  )
    throw new UnsupportedResumeDocumentError(
      "The PDF uses a character map that cannot be read safely.",
    );
  const streams: string[] = [];
  const expression = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let extractedLength = 0;
  for (const match of source.matchAll(expression)) {
    const countBefore = streams.length;
    const dictionary = match[1] ?? "";
    const raw = match[2] ?? "";
    const filter = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(
      dictionary,
    )?.[1];
    const filters = filter?.startsWith("[")
      ? filter.slice(1, -1).trim().split(/\s+/).filter(Boolean)
      : filter
        ? [filter]
        : [];
    if (filters.length === 1 && filters[0] === "/FlateDecode") {
      try {
        const inflated = await decompress(latin1Bytes(raw), "deflate");
        streams.push(decodeByteString(inflated));
      } catch {
        // Other streams may still carry readable text; malformed streams are ignored.
      }
    } else if (filters.length === 0) {
      streams.push(raw);
    }
    if (streams.length > countBefore)
      extractedLength += streams[streams.length - 1]?.length ?? 0;
    if (extractedLength > MAX_DECOMPRESSED_BYTES)
      throw new UnsupportedResumeDocumentError("The PDF text is too large.");
  }
  if (streams.length === 0) streams.push(source);
  return streams.map(extractPdfTextOperators).filter(Boolean).join("\n");
}

function extractPdfTextOperators(stream: string): string {
  const output: string[] = [];
  let cursor = 0;
  while (cursor < stream.length) {
    const character = stream[cursor];
    if (character === "(") {
      const literal = readPdfLiteral(stream, cursor);
      if (literal) {
        const operatorEnd = skipWhitespace(stream, literal.end);
        const operator = stream[operatorEnd];
        if (
          (operator === "T" && stream[operatorEnd + 1] === "j") ||
          operator === "'" ||
          operator === '"'
        )
          output.push(decodePdfLiteral(literal.value));
        cursor = literal.end;
        continue;
      }
    } else if (character === "[") {
      const array = readPdfArray(stream, cursor);
      if (array) {
        const operatorEnd = skipWhitespace(stream, array.end);
        if (stream.slice(operatorEnd, operatorEnd + 2) === "TJ")
          output.push(array.value);
        cursor = array.end;
        continue;
      }
    } else if (character === "<" && stream[cursor + 1] !== "<") {
      const end = stream.indexOf(">", cursor + 1);
      if (end >= 0) {
        const operatorEnd = skipWhitespace(stream, end + 1);
        if (stream.slice(operatorEnd, operatorEnd + 2) === "Tj")
          output.push(decodePdfHex(stream.slice(cursor + 1, end)));
        cursor = end + 1;
        continue;
      }
    }
    cursor += 1;
  }
  return output.join("\n");
}

function readPdfLiteral(
  stream: string,
  start: number,
): { value: string; end: number } | null {
  let depth = 0;
  let escaped = false;
  for (let cursor = start; cursor < stream.length; cursor += 1) {
    const character = stream[cursor]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") {
      depth -= 1;
      if (depth === 0)
        return { value: stream.slice(start + 1, cursor), end: cursor + 1 };
    }
  }
  return null;
}

function readPdfArray(
  stream: string,
  start: number,
): { value: string; end: number } | null {
  const pieces: string[] = [];
  let cursor = start + 1;
  while (cursor < stream.length) {
    const character = stream[cursor]!;
    if (/\s|\d/.test(character)) {
      cursor += 1;
      continue;
    }
    if (character === "]") return { value: pieces.join(""), end: cursor + 1 };
    if (character === "(") {
      const literal = readPdfLiteral(stream, cursor);
      if (!literal) return null;
      pieces.push(decodePdfLiteral(literal.value));
      cursor = literal.end;
      continue;
    }
    if (character === "<" && stream[cursor + 1] !== "<") {
      const end = stream.indexOf(">", cursor + 1);
      if (end < 0) return null;
      pieces.push(decodePdfHex(stream.slice(cursor + 1, end)));
      cursor = end + 1;
      continue;
    }
    cursor += 1;
  }
  return null;
}

function skipWhitespace(value: string, start: number): number {
  let cursor = start;
  while (cursor < value.length && /\s/.test(value[cursor]!)) cursor += 1;
  return cursor;
}

function decodePdfLiteral(value: string): string {
  const decoded = value
    .replace(
      /\\([nrtbf()\\])/g,
      (_all, escape: string) =>
        ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" })[escape] ?? escape,
    )
    .replace(/\\([0-7]{1,3})/g, (_all, octal: string) =>
      String.fromCharCode(parseInt(octal, 8)),
    )
    .replace(/\\\r?\n/g, "")
    .replace(/\\([^nrtbf()\\0-7\r\n])/g, "$1");
  if ([...decoded].some((character) => character.codePointAt(0)! > 0x7e))
    throw new UnsupportedResumeDocumentError(
      "The PDF uses a character encoding that cannot be read safely.",
    );
  return decoded;
}

function decodePdfHex(value: string): string {
  const hex = value.replace(/\s/g, "");
  const evenHex = hex.length % 2 === 0 ? hex : `${hex}0`;
  const bytes = Uint8Array.from(evenHex.match(/../g) ?? [], (part) =>
    parseInt(part, 16),
  );
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const words: number[] = [];
    for (let index = 2; index + 1 < bytes.length; index += 2)
      words.push((bytes[index]! << 8) | bytes[index + 1]!);
    return codeUnitsToString(words);
  }
  if (bytes.some((byte) => byte > 0x7e))
    throw new UnsupportedResumeDocumentError(
      "The PDF uses a character encoding that cannot be read safely.",
    );
  return decodeByteString(bytes);
}

function decodeXmlText(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_all, entity: string) => {
      if (entity[0] !== "#")
        return (
          { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[
            entity.toLowerCase()
          ] ?? ""
        );
      const code =
        entity[1]?.toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    },
  );
}

function normalizeDocumentText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

async function decompress(
  bytes: Uint8Array,
  format: "deflate" | "deflate-raw",
): Promise<Uint8Array> {
  const copy = bytes.slice();
  const stream = new Blob([copy.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream(format as CompressionFormat));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DECOMPRESSED_BYTES) {
      await reader.cancel();
      throw new UnsupportedResumeDocumentError(
        "The extracted document text is too large.",
      );
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function latin1Bytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
}

function decodeByteString(value: Uint8Array): string {
  const chunks: string[] = [];
  const size = 8_192;
  for (let offset = 0; offset < value.byteLength; offset += size) {
    const bytes = value.subarray(
      offset,
      Math.min(offset + size, value.byteLength),
    );
    chunks.push(String.fromCharCode(...bytes));
  }
  return chunks.join("");
}

function codeUnitsToString(units: number[]): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < units.length; offset += 8_192)
    chunks.push(String.fromCharCode(...units.slice(offset, offset + 8_192)));
  return chunks.join("");
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function requireRange(bytes: Uint8Array, offset: number, length: number): void {
  if (offset < 0 || length < 0 || offset + length > bytes.byteLength)
    throw new UnsupportedResumeDocumentError(
      "The document file is incomplete.",
    );
}
