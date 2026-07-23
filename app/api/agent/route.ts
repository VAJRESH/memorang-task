import { NextRequest } from "next/server";
import { Command } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";

import { agentGraph } from "@/lib/agent/graph";
import {
  generateMCQs,
  generateStudyTips,
  setActiveProvider,
  type AIProvider,
} from "@/lib/agent/nodes";
import type { AgentState } from "@/lib/agent/state";
import { sanitizeError } from "@/lib/errors";
import { storeQuestions, stripBatch } from "@/lib/agent/question-store";

/**
 * LangGraph learning-agent driver endpoint.
 *
 * The graph handles ONLY LLM-dependent work: planning + HITL approval + first
 * MCQ generation. Subsequent MCQ generation and study tips are handled via
 * standalone functions (no graph traversal needed).
 *
 * Answer evaluation, attempt tracking, and advancement are done client-side.
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
    }
  | {
      action: "generate-mcqs";
      pdfText: string;
      objective: { title: string; description: string };
      objectiveIndex: number;
      provider?: AIProvider;
    }
  | {
      action: "generate-tips";
      lessonTitle: string;
      totalQuestions: number;
      totalCorrect: number;
      totalAttempts: number;
      perObjective: { title: string; correct: number; total: number }[];
      provider?: AIProvider;
    };

/**
 * Normalize a graph invocation result into a stable client-facing payload.
 * Stores questions server-side and strips answer fields before sending.
 */
async function buildResponse(result: Record<string, unknown>) {
  const interrupts = (result.__interrupt__ as InterruptPayload[]) ?? [];
  const pending = interrupts.length > 0 ? interrupts[0] : null;

  const state = result as unknown as AgentState;

  // Store full questions server-side, send stripped versions to client.
  const fullQuestions = state.questions ?? [];
  if (fullQuestions.length > 0) {
    await storeQuestions(fullQuestions);
  }

  return {
    interrupt: pending ? { id: pending.id, value: pending.value } : null,
    state: {
      lessonPlan: state.lessonPlan ?? null,
      isPlanApproved: state.isPlanApproved ?? false,
      currentObjectiveIndex: state.currentObjectiveIndex ?? 0,
      questions: stripBatch(fullQuestions),
      currentQuestionIndex: state.currentQuestionIndex ?? 0,
      userAttempts: state.userAttempts ?? {},
      feedback: state.feedback ?? null,
      summary: state.summary ?? null,
      isCompleted: state.isCompleted ?? false,
    },
  };
}

/** Validate and resolve provider, checking API key availability. */
function resolveProvider(body: {
  provider?: AIProvider;
}): { provider: AIProvider } | Response {
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

  setActiveProvider(provider);
  return { provider };
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

  // --- Standalone MCQ generation (no graph needed) ---
  if (body.action === "generate-mcqs") {
    const providerResult = resolveProvider(body);
    if (providerResult instanceof Response) return providerResult;

    if (!body.pdfText?.trim()) {
      return Response.json({ error: "Missing 'pdfText'" }, { status: 400 });
    }
    if (!body.objective) {
      return Response.json({ error: "Missing 'objective'" }, { status: 400 });
    }

    try {
      const questions = await generateMCQs({
        pdfText: body.pdfText,
        objective: body.objective,
        objectiveIndex: body.objectiveIndex ?? 0,
      });
      // Store full questions server-side, return stripped to client.
      await storeQuestions(questions);
      return Response.json(
        { questions: stripBatch(questions) },
        { status: 200 },
      );
    } catch (error) {
      const { message, status } = sanitizeError(error);
      return Response.json({ error: message }, { status });
    }
  }

  // --- Standalone study-tips generation ---
  if (body.action === "generate-tips") {
    const providerResult = resolveProvider(body);
    if (providerResult instanceof Response) return providerResult;

    try {
      const tips = await generateStudyTips({
        lessonTitle: body.lessonTitle ?? "the lesson",
        totalQuestions: body.totalQuestions ?? 0,
        totalCorrect: body.totalCorrect ?? 0,
        totalAttempts: body.totalAttempts ?? 0,
        perObjective: body.perObjective ?? [],
      });
      return Response.json({ tips }, { status: 200 });
    } catch (error) {
      const { message, status } = sanitizeError(error);
      return Response.json({ error: message }, { status });
    }
  }

  // --- Graph-based actions (start / resume) ---
  if (!("threadId" in body) || !body.threadId) {
    return Response.json({ error: "Missing 'threadId'" }, { status: 400 });
  }

  const providerResult = resolveProvider(body);
  if (providerResult instanceof Response) return providerResult;

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

    return Response.json(await buildResponse(result), { status: 200 });
  } catch (error) {
    // On failure, try to return the latest checkpointed state.
    try {
      const snapshot = await agentGraph.getState(config);
      if (snapshot?.values && Object.keys(snapshot.values).length > 0) {
        const stateValues = snapshot.values as Record<string, unknown>;
        const { message } = sanitizeError(error);
        return Response.json(
          { ...(await buildResponse(stateValues)), error: message },
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
