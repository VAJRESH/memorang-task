import { describe, expect, it } from "vitest";
import { cn } from "./utils";

/**
 * Example unit tests for `cn` covering well-known TailwindCSS conflict
 * resolution and general merge behavior.
 *
 * These are concrete example-based assertions (complementing the property test
 * for Property 1) that document the last-wins semantics of `cn` for specific,
 * well-known Tailwind utility conflicts.
 *
 * _Requirements: 2.7_
 */

describe("cn - well-known conflicting utilities resolve to the last value", () => {
  it("resolves horizontal padding (px-*) to the last value", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("resolves vertical padding (py-*) to the last value", () => {
    expect(cn("py-1", "py-8")).toBe("py-8");
  });

  it("resolves all-sides padding (p-*) to the last value", () => {
    expect(cn("p-2", "p-6")).toBe("p-6");
  });

  it("resolves margin (m-*) to the last value", () => {
    expect(cn("m-1", "m-4")).toBe("m-4");
  });

  it("resolves font size (text-*) to the last value", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("resolves text color to the last value", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("resolves background color (bg-*) to the last value", () => {
    expect(cn("bg-red-500", "bg-green-500")).toBe("bg-green-500");
  });

  it("resolves width (w-*) to the last value", () => {
    expect(cn("w-4", "w-full")).toBe("w-full");
  });

  it("resolves display utilities to the last value", () => {
    expect(cn("flex", "block")).toBe("block");
  });

  it("keeps the last value across three conflicting inputs", () => {
    expect(cn("px-2", "px-4", "px-8")).toBe("px-8");
  });
});

describe("cn - non-conflicting utilities are preserved", () => {
  it("keeps distinct utilities from different categories", () => {
    const result = cn("flex", "items-center", "rounded", "shadow");
    expect(result).toBe("flex items-center rounded shadow");
  });

  it("keeps a non-conflicting utility alongside a resolved conflict", () => {
    const result = cn("flex", "px-2", "px-4");
    const tokens = result.split(" ");
    expect(tokens).toContain("flex");
    expect(tokens).toContain("px-4");
    expect(tokens).not.toContain("px-2");
  });

  it("does not treat different padding axes as conflicting", () => {
    const result = cn("px-2", "py-4");
    const tokens = result.split(" ");
    expect(tokens).toContain("px-2");
    expect(tokens).toContain("py-4");
  });
});

describe("cn - clsx-style conditional and falsy inputs", () => {
  it("returns an empty string when all inputs are falsy", () => {
    expect(cn(undefined, null, false, "")).toBe("");
  });

  it("ignores falsy values interspersed with real classes", () => {
    expect(cn("px-2", undefined, "px-4", null, false, "")).toBe("px-4");
  });

  it("includes only the truthy branch of a conditional", () => {
    const isActive = false;
    expect(cn("flex", isActive && "hidden")).toBe("flex");
  });

  it("supports array inputs", () => {
    expect(cn(["px-2", "px-4"])).toBe("px-4");
  });

  it("returns an empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
