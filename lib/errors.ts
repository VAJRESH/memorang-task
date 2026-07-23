/**
 * Error sanitization utilities.
 *
 * Server-side errors (API auth failures, rate limits, internal exceptions) must
 * never be exposed verbatim to the client. This module maps known error
 * patterns to friendly, actionable messages and falls back to a generic one.
 */

/** User-friendly error messages keyed by detection pattern. */
const ERROR_MAP: Array<{ test: RegExp; message: string; status: number }> = [
  {
    test: /429|Too Many Requests|quota.*exceeded|rate.?limit/i,
    message:
      "The AI service is temporarily unavailable due to rate limits. Please wait a moment and try again.",
    status: 503,
  },
  {
    test: /403|CONSUMER_SUSPENDED|permission denied/i,
    message:
      "The AI service is not available. Please check the API key configuration.",
    status: 503,
  },
  {
    test: /401|UNAUTHENTICATED|invalid.*key|API key not valid/i,
    message:
      "The AI service credentials are invalid. Please update the API key.",
    status: 503,
  },
  {
    test: /404.*model|not found for API version|not supported/i,
    message:
      "The configured AI model is unavailable. Please check the model name.",
    status: 503,
  },
  {
    test: /GEMINI_API_KEY is not configured/i,
    message: "The AI service is not configured. Please set up the API key.",
    status: 503,
  },
  {
    test: /GROQ_API_KEY is not configured/i,
    message: "Groq is not configured. Please set up the GROQ_API_KEY.",
    status: 503,
  },
  {
    test: /network|ECONNREFUSED|ETIMEDOUT|fetch failed/i,
    message:
      "Unable to reach the AI service. Please check your internet connection and try again.",
    status: 503,
  },
];

/** A sanitized error response suitable for returning to the client. */
export interface SanitizedError {
  message: string;
  status: number;
}

/**
 * Map a server-side error to a user-friendly message. Raw error details are
 * logged server-side but never leaked to the client.
 */
export function sanitizeError(error: unknown): SanitizedError {
  const raw =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  // Log the full error server-side for debugging.
  console.error("[API Error]", raw);

  for (const { test, message, status } of ERROR_MAP) {
    if (test.test(raw)) {
      return { message, status };
    }
  }

  // Generic fallback — never expose internals.
  return {
    message: "Something went wrong. Please try again later.",
    status: 500,
  };
}
