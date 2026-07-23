import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { cn } from "./utils";

// Feature: project-scaffolding, Property 1
// Property 1: Class merge resolves conflicts to the last value.
// For any variadic list of class-name values, cn(...inputs) returns a single
// string, and when two inputs specify conflicting TailwindCSS utilities of the
// same category, the resulting string contains the last-specified value and not
// the earlier conflicting one.
// Validates: Requirements 2.7

// Known conflicting Tailwind utility families. Each family is a set of classes
// that occupy the same style "slot" — tailwind-merge must keep only the last.
const CONFLICT_FAMILIES: Record<string, readonly string[]> = {
  px: ["px-0", "px-1", "px-2", "px-4", "px-8", "px-12"],
  py: ["py-0", "py-1", "py-2", "py-4", "py-8", "py-12"],
  p: ["p-0", "p-1", "p-2", "p-4", "p-8", "p-12"],
  m: ["m-0", "m-1", "m-2", "m-4", "m-8", "m-12"],
  text: ["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl"],
  bg: ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-gray-200"],
  w: ["w-1", "w-2", "w-4", "w-full", "w-1/2"],
  h: ["h-1", "h-2", "h-4", "h-full", "h-1/2"],
};

const FAMILY_KEYS = Object.keys(CONFLICT_FAMILIES);

describe("cn — Property 1: conflicts resolve to the last value", () => {
  it("returns a single string and keeps the last-specified value within a conflict family", () => {
    fc.assert(
      fc.property(
        // Pick a conflict family, then a non-empty ordered list of members of
        // that family (repeats allowed) — every member conflicts with the rest.
        fc.constantFrom(...FAMILY_KEYS).chain((family) =>
          fc
            .array(fc.constantFrom(...CONFLICT_FAMILIES[family]), {
              minLength: 2,
              maxLength: 8,
            })
            .map((members) => ({ family, members })),
        ),
        ({ members }) => {
          const result = cn(...members);

          // Single-string output.
          expect(typeof result).toBe("string");

          // Last-wins: the merged output equals exactly the last member, and
          // none of the earlier (distinct) conflicting members survive.
          const last = members[members.length - 1];
          expect(result).toBe(last);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("resolves the last value even when conflicting classes are interleaved with non-conflicting ones", () => {
    // Non-conflicting decorations that should always survive alongside the
    // resolved conflict class.
    const nonConflicting = ["flex", "items-center", "rounded", "shadow"];

    fc.assert(
      fc.property(
        fc.constantFrom(...FAMILY_KEYS).chain((family) =>
          fc.record({
            conflicts: fc.array(fc.constantFrom(...CONFLICT_FAMILIES[family]), {
              minLength: 2,
              maxLength: 6,
            }),
            decoration: fc.constantFrom(...nonConflicting),
          }),
        ),
        ({ conflicts, decoration }) => {
          // decoration first, then the conflicting sequence.
          const result = cn(decoration, ...conflicts);

          expect(typeof result).toBe("string");

          const tokens = result.split(" ");
          const last = conflicts[conflicts.length - 1];

          // The non-conflicting class survives.
          expect(tokens).toContain(decoration);
          // The last conflicting value survives.
          expect(tokens).toContain(last);

          // No earlier, distinct conflicting value from the same family survives.
          for (const earlier of conflicts.slice(0, -1)) {
            if (earlier !== last) {
              expect(tokens).not.toContain(earlier);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
