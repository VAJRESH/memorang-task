import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration/unit tests for the CopilotKit runtime endpoint POST handler.
 * _Requirements: 3.2, 3.3, 3.4_
 *
 * The `@copilotkit/runtime` package is mocked so the handler's delegation
 * behavior can be exercised without a real runtime or network calls.
 */
vi.mock("@copilotkit/runtime", () => ({
  CopilotRuntime: class {},
  GoogleGenerativeAIAdapter: class {
    constructor(_opts: unknown) {}
  },
  copilotRuntimeNextJSAppRouterEndpoint: () => ({
    handleRequest: async () => new Response("ok", { status: 200 }),
  }),
}));

// Mock the compiled LangGraph agent so the handler can be exercised without
// constructing the real graph or calling Gemini.
vi.mock("@/lib/agent/graph", () => ({
  AGENT_NAME: "memorang_learning_agent",
  agentGraph: {
    invoke: async () => ({
      lessonPlan: null,
      isPlanApproved: false,
      isCompleted: false,
      currentObjectiveIndex: 0,
    }),
  },
}));

import { POST } from "./route";

describe("CopilotKit endpoint POST handler", () => {
  let savedApiKey: string | undefined;

  beforeEach(() => {
    savedApiKey = process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (savedApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = savedApiKey;
    }
  });

  // R3.2: POST is exported as a function returning a Response.
  it("exports POST as a function that returns a Response instance", async () => {
    expect(typeof POST).toBe("function");

    process.env.GEMINI_API_KEY = "test-key";
    const req = new Request("http://localhost/api/copilotkit", {
      method: "POST",
    });
    const res = await POST(req as any);
    expect(res).toBeInstanceOf(Response);
  });

  // R3.3 + R3.4: with required env vars present, delegates to the runtime and
  // responds with a 2xx status within the timeout.
  it("responds with a 2xx status when required env vars are present", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const req = new Request("http://localhost/api/copilotkit", {
      method: "POST",
    });
    const res = await POST(req as any);

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  }, 30000);

  // R3.6: with a required env var missing, the handler rejects with a 5xx
  // (503) and an error body naming each missing variable, without delegating
  // to the runtime.
  it("responds with 503 and names missing vars when env is absent", async () => {
    delete process.env.GEMINI_API_KEY;

    const req = new Request("http://localhost/api/copilotkit", {
      method: "POST",
    });
    const res = await POST(req as any);

    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; missing: string[] };
    expect(body.missing).toContain("GEMINI_API_KEY");
  });
});
