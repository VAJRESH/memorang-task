import { NextRequest } from "next/server";
import { extractText } from "@/lib/pdf/parser";

/**
 * PDF ingestion endpoint (used by the learning agent client flow).
 *
 * Accepts a `multipart/form-data` POST containing a single `file` field with a
 * PDF upload, extracts its text content via `unpdf` (through the shared
 * `extractText` helper), normalizes whitespace, and returns a clean JSON
 * payload of the shape `{ text: string }`.
 *
 * This route is functionally equivalent to `/api/parse-pdf` but exists as a
 * dedicated endpoint for the upload flow (Phase 4 spec requirement). Both
 * routes delegate to the same battle-tested extraction logic.
 */
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PDF_CONTENT_TYPE = "application/pdf";

/** Collapse noisy whitespace produced by PDF extraction into clean text. */
function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      { error: "Request body must be multipart/form-data" },
      { status: 400 },
    );
  }

  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file was provided" }, { status: 400 });
  }

  if (file.size === 0) {
    return Response.json(
      { error: "Uploaded file is empty (0 bytes)" },
      { status: 422 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "File exceeds the 10 MB limit" },
      { status: 422 },
    );
  }
  if (file.type !== PDF_CONTENT_TYPE) {
    return Response.json(
      { error: "File is not application/pdf" },
      { status: 422 },
    );
  }

  try {
    const raw = await extractText(await file.arrayBuffer());
    const text = normalizeText(raw);

    if (text.length === 0) {
      return Response.json(
        { error: "No extractable text was found" },
        { status: 422 },
      );
    }

    return Response.json({ text }, { status: 200 });
  } catch {
    return Response.json({ error: "Failed to parse the PDF" }, { status: 500 });
  }
}
