import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mock the PDF parser so we control extractText's behavior per scenario.
vi.mock("@/lib/pdf/parser", () => ({
  extractText: vi.fn(),
}));

import { POST } from "./route";
import { extractText } from "@/lib/pdf/parser";

const mockedExtractText = vi.mocked(extractText);

/** Build a POST request carrying a single validated PDF file. */
function pdfRequest(): NextRequest {
  const form = new FormData();
  const file = new File(
    [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
    "test.pdf",
    {
      type: "application/pdf",
    },
  );
  form.set("file", file);
  return new Request("http://localhost/api/parse-pdf", {
    method: "POST",
    body: form,
  }) as unknown as NextRequest;
}

describe("POST /api/parse-pdf status scenarios", () => {
  beforeEach(() => {
    mockedExtractText.mockReset();
  });

  it("returns 200 with { text } when the parser returns text (R5.4)", async () => {
    mockedExtractText.mockResolvedValue("Hello from the PDF");

    const res = await POST(pdfRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ text: "Hello from the PDF" });
    expect(mockedExtractText).toHaveBeenCalledTimes(1);
  });

  it("returns 500 'parsing failed' with no partial text when the parser throws (R5.7)", async () => {
    mockedExtractText.mockRejectedValue(new Error("boom"));

    const res = await POST(pdfRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/pars/i);
    // No partial text content is returned on failure.
    expect(body).not.toHaveProperty("text");
  });

  it("returns 422 'no extractable text' when the parser returns an empty string (R5.8)", async () => {
    mockedExtractText.mockResolvedValue("");

    const res = await POST(pdfRequest());

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/no extractable text/i);
    expect(body).not.toHaveProperty("text");
  });
});
