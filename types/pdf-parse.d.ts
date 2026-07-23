/**
 * Minimal type declarations for `pdf-parse` v1.x, which ships without its own
 * TypeScript definitions. Only the surface used by the app is declared.
 */
declare module "pdf-parse" {
  interface PdfParseResult {
    /** Extracted text content of the document. */
    text: string;
    /** Number of pages. */
    numpages: number;
    /** Raw PDF metadata info. */
    info: unknown;
    /** PDF metadata, if present. */
    metadata: unknown;
    /** pdf.js version used. */
    version: string;
  }

  /** Parse a PDF buffer and extract its text and metadata. */
  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;

  export = pdfParse;
}

/** Direct entry to the library implementation, bypassing the debug wrapper. */
declare module "pdf-parse/lib/pdf-parse.js" {
  import pdfParse = require("pdf-parse");
  export = pdfParse;
}
