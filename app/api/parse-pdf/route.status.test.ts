import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the parser module so we control extractText's behavior per test.
vi.mock("@/lib/pdf/parser", () => ({ extractText: vi.fn() }));

import { extractText } from "@/lib/pdf/parser";
import { POST } from "./route";

const mockedExtractText = vi.mocked(extractText);

/**
 * Example unit tests for the PDF ingestion endpoint's status-mapping behavior.
 *
 * These cover the post-validation branches of the handler where a valid PDF
 * reaches the parser:
 *  - parser returns text        -> 200 { text }        (R5.4)
 *  - parser throws              -> 500 "parsing failed" (R5.7)
 *  - parser returns ""          -> 422 "no extractable text" (R5.8)
 *
 * Requirements: 5.4, 5.7, 5.8
 */

/** Build a minimal, valid `application/pdf` File of small non-zero size. */
function makePdfFile(): File {
  // A tiny but non-empty byte payload; content is irrelevant because the
  // parser is mocked. What matters is size > 0 and type application/pdf.
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
  return new File([bytes], "sample.pdf", { type: "application/pdf" });
}

/** Build a POST Request carrying the given file as multipart form data. */
function makeRequest(file: File): Request {
  const form = new FormData();
  form.append("file", file);
  // The route only uses req.formData(); a real Request satisfies that.
  return new Request("http://localhost/api/parse-pdf", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/parse-pdf - status scenarios", () => {
  beforeEach(() => {
    mockedExtractText.mockReset();
  });

  it("returns 200 with the extracted text when extractText resolves to text (R5.4)", async () => {
    mockedExtractText.mockResolvedValueOnce("some text");

    const res = await POST(makeRequest(makePdfFile()) as any);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ text: "some text" });
    expect(mockedExtractText).toHaveBeenCalledTimes(1);
  });

  it("returns 500 with a parsing-failed message when extractText throws (R5.7)", async () => {
    mockedExtractText.mockRejectedValueOnce(new Error("boom"));

    const res = await POST(makeRequest(makePdfFile()) as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/parse/i);
    // No partial text content is returned on failure.
    expect(body).not.toHaveProperty("text");
  });

  it("returns 422 with a no-extractable-text message when extractText resolves to empty string (R5.8)", async () => {
    mockedExtractText.mockResolvedValueOnce("");

    const res = await POST(makeRequest(makePdfFile()) as any);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/no extractable text/i);
  });
});
