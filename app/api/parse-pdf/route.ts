import { NextRequest } from "next/server";
import { extractText } from "@/lib/pdf/parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PDF_CONTENT_TYPE = "application/pdf";

export async function POST(req: NextRequest): Promise<Response> {
  const form = await req.formData();
  const file = form.get("file");

  // R5.5: no file -> 400
  if (!(file instanceof File)) {
    return Response.json({ error: "No file was provided" }, { status: 400 });
  }

  // R5.3 + R5.6: validate before parsing
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
    const text = await extractText(await file.arrayBuffer());
    // R5.8: validated PDF but no extractable text -> 422
    if (text.length === 0) {
      return Response.json(
        { error: "No extractable text was found" },
        { status: 422 },
      );
    }
    // R5.4: success -> 200 with text
    return Response.json({ text }, { status: 200 });
  } catch {
    // R5.7: parser failure -> 500, no partial text
    return Response.json({ error: "Failed to parse the PDF" }, { status: 500 });
  }
}
