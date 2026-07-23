import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  GoogleGenerativeAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

/**
 * Names of environment variables the CopilotKit runtime requires to operate.
 * Documented in `.env.example` and validated on every request.
 */
export const REQUIRED_COPILOT_ENV_VARS = ["GEMINI_API_KEY"] as const;

/**
 * Return the subset of `required` environment variable names whose value is
 * undefined, empty, or whitespace-only. Pure function extracted for testing.
 */
export function findMissingEnvVars(
  env: NodeJS.ProcessEnv,
  required: readonly string[] = REQUIRED_COPILOT_ENV_VARS,
): string[] {
  return required.filter((name) => {
    const value = env[name];
    return value === undefined || value.trim() === "";
  });
}

/** LangChain / Gemini pull in Node built-ins, so run on the Node runtime. */
export const runtime = "nodejs";

/**
 * Construct the CopilotKit runtime endpoint handler backed by a Gemini tutor.
 *
 * `GoogleGenerativeAIAdapter` extends `LangChainAdapter` and provides model
 * information to CopilotKit, which resolves the "does not provide model
 * information" error that plain `LangChainAdapter` triggers in v1.63+.
 *
 * The adapter uses `@langchain/google-gauth` internally which reads
 * `GOOGLE_API_KEY` from the environment — we bridge from our `GEMINI_API_KEY`.
 */
function buildCopilotEndpoint() {
  // Bridge our env var name to what @langchain/google-gauth expects.
  if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
  }

  const copilotRuntime = new CopilotRuntime();

  const serviceAdapter = new GoogleGenerativeAIAdapter({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  });

  return copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
}

/**
 * POST handler for the CopilotKit runtime endpoint.
 *
 * Validates required environment variables before any runtime processing. If
 * any are missing/empty, responds 503 naming each missing variable and does no
 * partial work. Otherwise delegates to the CopilotKit runtime, which streams
 * the Gemini tutor's responses.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const missing = findMissingEnvVars(process.env);
  if (missing.length > 0) {
    return Response.json(
      {
        error:
          "The AI tutor service is not configured. Please contact the administrator.",
      },
      { status: 503 },
    );
  }

  const { handleRequest } = buildCopilotEndpoint();
  return handleRequest(req);
}
