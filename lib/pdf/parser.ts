import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";

/**
 * PDF parsing and text-chunking utilities for the Memorang AI Learning Agent.
 *
 * This module exposes:
 * - Typed errors (`PdfParseError`, `InvalidChunkSizeError`).
 * - Chunk-size bounds (`MIN_CHUNK_SIZE`, `MAX_CHUNK_SIZE`).
 * - `chunkText`, a pure, dependency-free text chunker with a round-trip guarantee.
 *
 * NOTE: `extractText` (PDF byte extraction via `unpdf`) is added to this same
 * file by a later task and intentionally lives alongside these utilities.
 */

/** Thrown/returned when a PDF cannot be parsed. */
export class PdfParseError extends Error {
  constructor(message = "Failed to parse the PDF") {
    super(message);
    this.name = "PdfParseError";
    // Preserve prototype chain when targeting older/transpiled runtimes.
    Object.setPrototypeOf(this, PdfParseError.prototype);
  }
}

/** Thrown/returned when a chunk size is out of the allowed range. */
export class InvalidChunkSizeError extends Error {
  constructor(message = "Chunk size is out of the allowed range") {
    super(message);
    this.name = "InvalidChunkSizeError";
    Object.setPrototypeOf(this, InvalidChunkSizeError.prototype);
  }
}

/** Smallest permitted chunk size (inclusive). */
export const MIN_CHUNK_SIZE = 1;
/** Largest permitted chunk size (inclusive). */
export const MAX_CHUNK_SIZE = 100_000;

/**
 * Split `text` into an ordered collection of contiguous, non-empty chunks,
 * each no longer than `chunkSize` UTF-16 code units.
 *
 * Behavior:
 * - `chunkSize` not an integer, or `< MIN_CHUNK_SIZE`, or `> MAX_CHUNK_SIZE`
 *   -> throws `InvalidChunkSizeError` and returns no chunks.
 * - Empty `text` -> returns `[]`.
 * - Otherwise the chunks are contiguous and lossless: `chunks.join("") === text`.
 *   Every chunk is non-empty and `<= chunkSize`.
 *
 * Chunking operates consistently on JavaScript string units (UTF-16 code
 * units) for both slicing and length checks, so the round-trip equality holds
 * for any input string, including non-ASCII content.
 */
export function chunkText(text: string, chunkSize: number): string[] {
  if (
    !Number.isInteger(chunkSize) ||
    chunkSize < MIN_CHUNK_SIZE ||
    chunkSize > MAX_CHUNK_SIZE
  ) {
    throw new InvalidChunkSizeError(
      `Chunk size must be an integer between ${MIN_CHUNK_SIZE} and ${MAX_CHUNK_SIZE}, received: ${chunkSize}`,
    );
  }

  if (text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
}

/**
 * Extract the text content from a PDF byte buffer, preserving the original
 * character order of the document.
 *
 * Behavior:
 * - Valid PDF containing text -> the full extracted text as a single string,
 *   with pages joined in document order.
 * - Valid PDF with no extractable text -> `""` (empty string).
 * - Invalid/corrupt input -> throws `PdfParseError` and returns no partial
 *   text (R4.5).
 *
 * Accepts either a `Uint8Array` or an `ArrayBuffer`; the input is normalized to
 * a `Uint8Array` before being handed to `unpdf`.
 */
export async function extractText(
  data: Uint8Array | ArrayBuffer,
): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await unpdfExtractText(pdf, { mergePages: true });
    // `mergePages: true` yields a single string, but guard against an array
    // shape by joining pages in order to preserve character order.
    return Array.isArray(text) ? text.join("") : text;
  } catch (error) {
    if (error instanceof PdfParseError) {
      throw error;
    }
    throw new PdfParseError(
      error instanceof Error ? error.message : "Failed to parse the PDF",
    );
  }
}
