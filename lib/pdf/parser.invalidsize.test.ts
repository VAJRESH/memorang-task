import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { chunkText, InvalidChunkSizeError } from "./parser";

/**
 * Feature: project-scaffolding, Property 4
 *
 * Property 4: Invalid chunk sizes are rejected.
 * For any chunkSize that is not an integer within [1, 100000] (values <= 0,
 * values > 100000, or non-integer floats such as 1.5, NaN, Infinity),
 * `chunkText` throws `InvalidChunkSizeError` and returns no chunks.
 *
 * Validates: Requirements 4.6
 */
describe("chunkText invalid chunk-size rejection (Property 4)", () => {
  const SAMPLE_TEXT = "some text";

  it("rejects integers at or below the lower bound", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 0 }), (size) => {
        expect(() => chunkText(SAMPLE_TEXT, size)).toThrow(
          InvalidChunkSizeError,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("rejects integers above the upper bound", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100_001, max: 10_000_000 }), (size) => {
        expect(() => chunkText(SAMPLE_TEXT, size)).toThrow(
          InvalidChunkSizeError,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("rejects non-integer floating-point sizes", () => {
    fc.assert(
      fc.property(
        fc
          .double({ noNaN: true, noDefaultInfinity: true })
          .filter((n) => !Number.isInteger(n)),
        (size) => {
          expect(() => chunkText(SAMPLE_TEXT, size)).toThrow(
            InvalidChunkSizeError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects explicit non-finite / non-integer edge cases", () => {
    const edgeCases = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      1.5,
      -1.5,
      0.5,
      100000.5,
    ];
    for (const size of edgeCases) {
      expect(() => chunkText(SAMPLE_TEXT, size)).toThrow(InvalidChunkSizeError);
    }
  });
});
