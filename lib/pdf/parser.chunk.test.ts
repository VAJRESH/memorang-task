import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { chunkText, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE } from "./parser";

// Feature: project-scaffolding, Property 3
// Property 3: Chunking is well-formed and lossless.
// For any text string (including empty and non-ASCII) and any valid chunk size
// in [1, 100000], chunkText produces an ordered collection such that:
//   (a) concatenating the chunks in order exactly reproduces the input text,
//   (b) every chunk is non-empty and no longer than the chunk size, and
//   (c) empty input text yields an empty collection.
// Validates: Requirements 4.4, 4.7, 4.8
describe("chunkText — Property 3: well-formed and lossless", () => {
  it("is lossless, well-formed, and handles empty input across arbitrary text and valid sizes", () => {
    fc.assert(
      fc.property(
        // Unicode-inclusive text (grapheme units cover non-ASCII/emoji clusters).
        fc.string({ unit: "grapheme" }),
        fc.integer({ min: MIN_CHUNK_SIZE, max: MAX_CHUNK_SIZE }),
        (text, size) => {
          const chunks = chunkText(text, size);

          // (c) Empty input -> empty collection.
          if (text.length === 0) {
            expect(chunks).toEqual([]);
            return;
          }

          // (a) Round-trip: concatenation reproduces the input exactly.
          expect(chunks.join("")).toBe(text);

          // (b) Every chunk is non-empty and no longer than `size`.
          for (const chunk of chunks) {
            expect(chunk.length).toBeGreaterThan(0);
            expect(chunk.length).toBeLessThanOrEqual(size);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns an empty array for empty input text at any valid chunk size", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_CHUNK_SIZE, max: MAX_CHUNK_SIZE }),
        (size) => {
          expect(chunkText("", size)).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns [] for empty input at a specific valid size", () => {
    expect(chunkText("", 42)).toEqual([]);
  });
});
