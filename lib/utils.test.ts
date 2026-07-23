import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { cn } from "./utils";

/**
 * Feature: project-scaffolding, Property 1: Class merge resolves conflicts to the last value
 *
 * For any variadic list of class-name values, cn(...inputs) returns a single
 * string, and when two inputs specify conflicting TailwindCSS utilities of the
 * same category, the resulting string contains the last-specified value and not
 * the earlier conflicting one.
 *
 * Validates: Requirements 2.7
 */

// Groups of mutually-conflicting Tailwind utilities. Within a group, twMerge
// must resolve to the last-specified value.
const CONFLICT_GROUPS: string[][] = [
  ["px-2", "px-4", "px-8"], // padding-x
  ["text-sm", "text-lg", "text-xl"], // font-size
  ["text-red-500", "text-blue-500", "text-green-500"], // text color
];

// Filler classes that do NOT conflict with any of the groups above, so they
// never interfere with the last-wins assertion.
const FILLERS = ["flex", "rounded", "font-bold", "block", "border", "shadow"];

const tokens = (s: string): string[] => s.split(/\s+/).filter(Boolean);

describe("cn - Property 1: conflicts resolve to the last value", () => {
  it("keeps the last-specified conflicting utility and drops the earlier one", () => {
    fc.assert(
      fc.property(
        // Pick a conflict group.
        fc.integer({ min: 0, max: CONFLICT_GROUPS.length - 1 }),
        // Pick two distinct members (indices) of that group, ordered earlier/later.
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 2 }),
        // Random filler classes placed before, between, and after the pair.
        fc.array(fc.constantFrom(...FILLERS), { maxLength: 4 }),
        fc.array(fc.constantFrom(...FILLERS), { maxLength: 4 }),
        fc.array(fc.constantFrom(...FILLERS), { maxLength: 4 }),
        (groupIdx, aIdx, bIdx, before, middle, after) => {
          const group = CONFLICT_GROUPS[groupIdx];
          // Ensure the two indices are distinct.
          if (aIdx === bIdx) {
            bIdx = (bIdx + 1) % group.length;
          }
          const earlier = group[aIdx];
          const later = group[bIdx];

          const inputs = [...before, earlier, ...middle, later, ...after];

          const result = cn(...inputs);

          // (a) output is a single string
          expect(typeof result).toBe("string");
          expect(result).not.toContain("\n");

          const resultTokens = tokens(result);

          // (b) the last-specified conflicting value is present...
          expect(resultTokens).toContain(later);
          // ...and the earlier conflicting value of the same category is gone.
          expect(resultTokens).not.toContain(earlier);
        },
      ),
      { numRuns: 100 },
    );
  });
});
