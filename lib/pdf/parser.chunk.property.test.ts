import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { chunkText, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE } from "./parser";

// Feature: project-scaffolding, Property 3
// Property 3: Chunking is well-formed and lossless.
// For any text string and any valid chunk size in [1, 100000], chunkText(text, size)
// produces an ordered collection such that:
//   (a) concatenating the chunks in order exactly reproduces the input text with no
//       characters inserted or removed (round-trip),
//   (b) every chunk is non-empty and no longer than `size`,
//   (c) when the input text is empty the collection is empty.
// Validates: Requirements 4.4, 4.7, 4.8

describe("chunkText — Property 3: well-formed and lossless chunking", () => {
  it("round-trips, bounds every chunk, and stays contiguous for arbitrary text and valid sizes", () => {
    fc.assert(
      fc.property(
        // Arbitrary strings including empty and non-ASCII (fc.string covers the
        // full unicode space via string units).
        fc.string({ unit: "binary" }),
        // Valid chunk sizes across the whole permitted range. Keep the upper
        // bound of generation reasonable while still exercising large sizes.
        fc.integer({ min: MIN_CHUNK_SIZE, max: MAX_CHUNK_SIZE }),
        (text, size) => {
          const chunks = chunkText(text, size);

          // (a) Round-trip: concatenation exactly reproduces the input.
          expect(chunks.join("")).toBe(text);

          // (b) Every chunk is non-empty and no longer than `size`.
          for (const chunk of chunks) {
            expect(chunk.length).toBeGreaterThan(0);
            expect(chunk.length).toBeLessThanOrEqual(size);
          }

          // (c) Empty input yields an empty collection; non-empty input yields
          // at least one chunk.
          if (text.length === 0) {
            expect(chunks).toEqual([]);
          } else {
            expect(chunks.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("explicitly returns an empty collection for empty input across any valid size", () => {
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

  it("produces full-size chunks except possibly a shorter final chunk", () => {
    // Use smaller sizes so multi-chunk outputs are common and the contiguity /
    // boundary behavior is meaningfully exercised.
    fc.assert(
      fc.property(
        fc.string({ unit: "binary", minLength: 1 }),
        fc.integer({ min: MIN_CHUNK_SIZE, max: 50 }),
        (text, size) => {
          const chunks = chunkText(text, size);

          // All chunks but the last are exactly `size` long; the last is
          // between 1 and `size`.
          for (let i = 0; i < chunks.length - 1; i++) {
            expect(chunks[i].length).toBe(size);
          }
          const last = chunks[chunks.length - 1];
          expect(last.length).toBeGreaterThan(0);
          expect(last.length).toBeLessThanOrEqual(size);
        },
      ),
      { numRuns: 100 },
    );
  });
});
