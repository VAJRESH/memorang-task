import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { chunkText, MAX_CHUNK_SIZE, MIN_CHUNK_SIZE } from "./parser";

/**
 * Feature: project-scaffolding, Property 3
 *
 * Property 3: Chunking is well-formed and lossless.
 * For any text string (including empty and non-ASCII) and any valid chunk size
 * in [1, 100000], `chunkText(text, size)` produces an ordered collection such
 * that:
 *   (a) concatenating the chunks in order exactly reproduces the input text
 *       with no characters inserted or removed (round-trip),
 *   (b) every chunk is non-empty and no longer than `size`, and
 *   (c) when the input text is empty the collection is empty.
 *
 * Validates: Requirements 4.4, 4.7, 4.8
 */
describe("chunkText well-formedness and losslessness (Property 3)", () => {
  // Bias the chunk-size generator toward the small end of the valid range so
  // that generated texts are actually split into many chunks, while still
  // occasionally exercising large sizes up to the maximum.
  const validChunkSize = fc.oneof(
    { weight: 9, arbitrary: fc.integer({ min: MIN_CHUNK_SIZE, max: 50 }) },
    {
      weight: 1,
      arbitrary: fc.integer({ min: MIN_CHUNK_SIZE, max: MAX_CHUNK_SIZE }),
    },
  );

  // fullUnicode covers non-ASCII content, including code points outside the
  // Basic Multilingual Plane (which occupy two UTF-16 code units).
  const anyText = fc.string({ unit: "binary" });
  const nonEmptyText = fc.string({ unit: "binary", minLength: 1 });

  it("round-trips: joining chunks reproduces the input exactly", () => {
    fc.assert(
      fc.property(anyText, validChunkSize, (text, size) => {
        const chunks = chunkText(text, size);
        expect(chunks.join("")).toBe(text);
      }),
      { numRuns: 100 },
    );
  });

  it("produces non-empty chunks that never exceed the chunk size", () => {
    fc.assert(
      fc.property(anyText, validChunkSize, (text, size) => {
        const chunks = chunkText(text, size);
        for (const chunk of chunks) {
          expect(chunk.length).toBeGreaterThan(0);
          expect(chunk.length).toBeLessThanOrEqual(size);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("splits non-empty text into at least one chunk", () => {
    fc.assert(
      fc.property(nonEmptyText, validChunkSize, (text, size) => {
        const chunks = chunkText(text, size);
        expect(chunks.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("returns an empty collection for empty input at any valid chunk size", () => {
    fc.assert(
      fc.property(validChunkSize, (size) => {
        expect(chunkText("", size)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});
