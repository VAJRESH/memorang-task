import { describe, expect, it } from "vitest";
import { cn } from "./utils";

/**
 * Example unit tests for well-known Tailwind conflicts resolved by `cn`.
 * _Requirements: 2.7_
 */
describe("cn - well-known conflict resolution", () => {
  it("resolves conflicting horizontal padding to the last value", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("resolves conflicting text size to the last value", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("resolves conflicting padding to the last value", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("keeps both classes when they do not conflict", () => {
    const result = cn("flex", "items-center");
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
  });
});

describe("cn - falsy and conditional inputs", () => {
  it("ignores undefined, null, false, and empty string inputs", () => {
    expect(cn(undefined, null, false, "")).toBe("");
  });

  it("ignores falsy values interspersed with real classes", () => {
    expect(cn("px-2", undefined, "px-4", null, false, "")).toBe("px-4");
  });

  it("includes only the truthy branch of a conditional", () => {
    const isActive = false;
    const result = cn("flex", isActive && "hidden");
    expect(result).toBe("flex");
  });
});
