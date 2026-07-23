import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { chunkText, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE } from "./parser";

describe("chunkText", () => {
  // Feature: project-scaffolding, Property 3: Chunking is well-formed and lossless
  // For any text string and any valid chunk size in [1, 100000], chunkText(text, size)
  // produces an ordered collection such that (a) concatenating the chunks in order
  // exactly reproduces the input text, (b) every chunk is non-empty and no longer than
  // size, and (c) when the input text is empty the collection is empty.
  //
  // Validates: Requirements 4.4, 4.7, 4.8
  it("produces well-formed, lossless chunks for arbitrary text and valid chunk sizes", () => {
    fc.assert(
      fc.property(
        // Arbitrary strings including empty and non-ASCII. In fast-check v4,
        // `string({ unit: "binary" })` spans the full Unicode range, exercising
        // multi-code-unit characters (the v3 `fullUnicodeString` equivalent).
        fc.string({ unit: "binary" }),
        // Valid chunk sizes: integers within the inclusive [MIN, MAX] range.
        fc.integer({ min: MIN_CHUNK_SIZE, max: MAX_CHUNK_SIZE }),
        (text, chunkSize) => {
          const chunks = chunkText(text, chunkSize);

          // (c) Empty input -> empty output.
          if (text.length === 0) {
            expect(chunks).toEqual([]);
            return;
          }

          // (a) Round-trip: concatenation in order reproduces the input exactly.
          expect(chunks.join("")).toBe(text);

          // (b) Every chunk is non-empty and no longer than chunkSize.
          for (const chunk of chunks) {
            expect(chunk.length).toBeGreaterThan(0);
            expect(chunk.length).toBeLessThanOrEqual(chunkSize);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
