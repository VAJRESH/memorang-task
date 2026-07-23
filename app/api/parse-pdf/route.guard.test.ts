import { beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import type { NextRequest } from "next/server";

// Spy on the parser so we can assert whether it is invoked per request.
vi.mock("@/lib/pdf/parser", () => ({ extractText: vi.fn() }));

import { extractText } from "@/lib/pdf/parser";
import { POST } from "./route";

const spyExtractText = vi.mocked(extractText);

/**
 * Feature: project-scaffolding, Property 6
 *
 * Property 6: Validation guards the parser and maps status codes.
 * For any uploaded file descriptor (varying presence, byte size, and declared
 * content type), the `/api/parse-pdf` handler invokes the PDF parser if and
 * only if the file is present, its size is greater than 0 and at most 10 MB,
 * and its content type is `application/pdf`. When the file is absent the
 * response status is 400; when the file is present but fails size or type
 * validation the response status is 422 — and in both failing cases the parser
 * is not invoked.
 *
 * Validates: Requirements 5.3, 5.5, 5.6
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PDF_CONTENT_TYPE = "application/pdf";

/**
 * Build a `File` whose reported `size` and `type` we fully control, without
 * allocating large buffers. The route reads only `file.size`, `file.type`, and
 * (on the valid path) `file.arrayBuffer()`, so a tiny backing buffer with an
 * overridden `size` getter faithfully models any descriptor.
 */
function makeFile(size: number, type: string): File {
  const file = new File([new Uint8Array(1)], "upload.pdf", { type });
  Object.defineProperty(file, "size", { value: size, configurable: true });
  return file;
}

/** A request whose only used surface is `formData()`, matching the handler. */
function makeRequest(form: FormData): NextRequest {
  return { formData: async () => form } as unknown as NextRequest;
}

// Descriptor for an absent file: either no field at all, or a non-File value.
const absentArb = fc.record({
  present: fc.constant(false as const),
  mode: fc.constantFrom("missing", "string"),
});

// Descriptor for a present file: a size category plus a declared content type.
const presentArb = fc.record({
  present: fc.constant(true as const),
  sizeCategory: fc.constantFrom("zero", "valid", "over"),
  validSize: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
  overSize: fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 3 }),
  type: fc.oneof(
    fc.constant(PDF_CONTENT_TYPE),
    // Content types that are NOT the exact `application/pdf` string.
    fc.constantFrom(
      "text/plain",
      "image/png",
      "application/json",
      "application/octet-stream",
      "application/PDF", // case mismatch -> invalid
      "",
    ),
  ),
});

type Descriptor =
  | { present: false; mode: string }
  | {
      present: true;
      sizeCategory: string;
      validSize: number;
      overSize: number;
      type: string;
    };

const descriptorArb: fc.Arbitrary<Descriptor> = fc.oneof(
  absentArb,
  presentArb,
) as fc.Arbitrary<Descriptor>;

/** Resolve a descriptor's concrete byte size from its category. */
function resolveSize(d: Extract<Descriptor, { present: true }>): number {
  if (d.sizeCategory === "zero") return 0;
  if (d.sizeCategory === "over") return d.overSize;
  return d.validSize;
}

/** A file is valid iff present, size in (0, MAX], and type is application/pdf. */
function isValid(d: Descriptor): boolean {
  if (!d.present) return false;
  const size = resolveSize(d);
  return size > 0 && size <= MAX_FILE_SIZE && d.type === PDF_CONTENT_TYPE;
}

/** Assemble the FormData body for a descriptor. */
function buildForm(d: Descriptor): FormData {
  const form = new FormData();
  if (!d.present) {
    if (d.mode === "string") {
      // A non-File value under the same field is treated as "no file".
      form.append("file", "not-a-file");
    }
    // mode === "missing": leave the field absent entirely.
    return form;
  }
  form.append("file", makeFile(resolveSize(d), d.type));
  return form;
}

describe("POST /api/parse-pdf validation guard (Property 6)", () => {
  beforeEach(() => {
    spyExtractText.mockReset();
    // Valid requests reach the parser; return non-empty text so the success
    // path is exercised. Failing requests must never call this.
    spyExtractText.mockResolvedValue("extracted text");
  });

  it("invokes the parser iff valid, and maps absent->400 / invalid->422", async () => {
    await fc.assert(
      fc.asyncProperty(descriptorArb, async (d) => {
        spyExtractText.mockClear();

        const res = await POST(makeRequest(buildForm(d)));

        if (isValid(d)) {
          // Valid: parser invoked exactly once and the success path is taken.
          expect(spyExtractText).toHaveBeenCalledTimes(1);
          expect(res.status).toBe(200);
        } else {
          // Invalid: parser must never be invoked (R5.3 guard).
          expect(spyExtractText).not.toHaveBeenCalled();
          if (!d.present) {
            // Absent file -> 400 (R5.5).
            expect(res.status).toBe(400);
          } else {
            // Present but failing size/type validation -> 422 (R5.6).
            expect(res.status).toBe(422);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
