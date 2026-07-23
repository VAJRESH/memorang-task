import { NextRequest } from "next/server";
import { Command } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";

import { agentGraph } from "@/lib/agent/graph";
import { setActiveProvider, type AIProvider } from "@/lib/agent/nodes";
import type { AgentState } from "@/lib/agent/state";
import { sanitizeError } from "@/lib/errors";

/**
 * LangGraph learning-agent driver endpoint.
 *
 * The compiled graph uses a `MemorySaver` checkpointer keyed by `thread_id`,
 * so the client can start a lesson and later resume the graph past its HITL
 * `interrupt()` pauses (plan approval, answer submissions) by re-invoking with
 * the same thread id.
 */
export const runtime = "nodejs";

/** Shape of a pending interrupt surfaced to the client. */
type InterruptPayload = {
  id: string;
  value: unknown;
};

/** Request body accepted by this endpoint. */
type AgentRequest =
  | {
      action: "start";
      threadId: string;
      pdfText: string;
      provider?: AIProvider;
    }
  | {
      action: "resume";
      threadId: string;
      resume: unknown;
      provider?: AIProvider;
    };

/**
 * Normalize a graph invocation result into a stable client-facing payload:
 * the current public state plus any pending interrupt.
 */
function buildResponse(result: Record<string, unknown>) {
  const interrupts = (result.__interrupt__ as InterruptPayload[]) ?? [];
  const pending = interrupts.length > 0 ? interrupts[0] : null;

  const state = result as unknown as AgentState;

  return {
    interrupt: pending ? { id: pending.id, value: pending.value } : null,
    state: {
      lessonPlan: state.lessonPlan ?? null,
      isPlanApproved: state.isPlanApproved ?? false,
      currentObjectiveIndex: state.currentObjectiveIndex ?? 0,
      questions: state.questions ?? [],
      currentQuestionIndex: state.currentQuestionIndex ?? 0,
      userAttempts: state.userAttempts ?? {},
      feedback: state.feedback ?? null,
      summary: state.summary ?? null,
      isCompleted: state.isCompleted ?? false,
    },
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: AgentRequest;
  try {
    body = (await req.json()) as AgentRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("action" in body)) {
    return Response.json({ error: "Missing 'action'" }, { status: 400 });
  }
  if (!("threadId" in body) || !body.threadId) {
    return Response.json({ error: "Missing 'threadId'" }, { status: 400 });
  }

  // Resolve and validate provider selection.
  const provider: AIProvider = body.provider === "groq" ? "groq" : "gemini";

  if (provider === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "Gemini is not configured. Please add a GEMINI_API_KEY or switch to Groq.",
      },
      { status: 503 },
    );
  }
  if (provider === "groq" && !process.env.GROQ_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "Groq is not configured. Please add a GROQ_API_KEY or switch to Gemini.",
      },
      { status: 503 },
    );
  }

  // Set the provider so graph nodes use the correct model.
  setActiveProvider(provider);

  const config: RunnableConfig = {
    configurable: { thread_id: body.threadId },
  };

  try {
    let result: Record<string, unknown>;

    if (body.action === "start") {
      if (!body.pdfText?.trim()) {
        return Response.json(
          { error: "Missing 'pdfText' for start" },
          { status: 400 },
        );
      }
      result = (await agentGraph.invoke(
        { pdfText: body.pdfText },
        config,
      )) as Record<string, unknown>;
    } else if (body.action === "resume") {
      result = (await agentGraph.invoke(
        new Command({ resume: body.resume }),
        config,
      )) as Record<string, unknown>;
    } else {
      return Response.json({ error: "Unknown 'action'" }, { status: 400 });
    }

    return Response.json(buildResponse(result), { status: 200 });
  } catch (error) {
    // On failure, try to return the latest checkpointed state so the UI
    // reflects partial progress (e.g. plan approved but MCQ generation failed).
    try {
      const snapshot = await agentGraph.getState(config);
      if (snapshot?.values && Object.keys(snapshot.values).length > 0) {
        const stateValues = snapshot.values as Record<string, unknown>;
        const { message } = sanitizeError(error);
        return Response.json(
          { ...buildResponse(stateValues), error: message },
          { status: 200 },
        );
      }
    } catch {
      // Couldn't retrieve state — fall through to plain error.
    }

    const { message, status } = sanitizeError(error);
    return Response.json({ error: message }, { status });
  }
}
