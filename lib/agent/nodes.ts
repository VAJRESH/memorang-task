import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { interrupt } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import type { AgentState, AgentStateUpdate } from "./state";
import {
  LessonPlanSchema,
  MCQQuestionBatchSchema,
  StudyTipsSchema,
  type MCQQuestion,
} from "./schemas";
import {
  MCQ_GENERATOR_SYSTEM_PROMPT,
  PLANNER_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  buildMcqHumanPrompt,
  buildPlannerHumanPrompt,
  buildSummaryHumanPrompt,
} from "./prompts";
import type { LearningObjective } from "./schemas";

/** Number of MCQs generated per learning objective. */
const QUESTIONS_PER_OBJECTIVE = 2;

/** Supported AI providers. */
export type AIProvider = "gemini" | "groq";

/** Default models per provider. */
const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
};

/**
 * The active provider for the current request. Set by the agent route before
 * invoking the graph so nodes use the correct model. Defaults to "gemini".
 */
let activeProvider: AIProvider = "gemini";

/** Set the active AI provider. Called by the agent route per-request. */
export function setActiveProvider(provider: AIProvider): void {
  activeProvider = provider;
}

/**
 * Construct a chat model for the active provider.
 *
 * API keys are read at call time (not module load) so the graph can be imported
 * in environments where keys are not yet set (e.g. tests) without throwing.
 */
function createModel(): BaseChatModel {
  if (activeProvider === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("GROQ_API_KEY is not configured");
    }
    return new ChatGroq({
      apiKey,
      model: process.env.GROQ_MODEL ?? DEFAULT_MODELS.groq,
      temperature: 0.3,
    });
  }

  // Default: Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new ChatGoogleGenerativeAI({
    apiKey,
    model: process.env.GEMINI_MODEL ?? DEFAULT_MODELS.gemini,
    temperature: 0.3,
  });
}

/**
 * Wrap `withStructuredOutput` with the correct method per provider.
 * Groq/Llama models fail with the default function-calling method (they produce
 * malformed `<function=...>` XML tags). Using `jsonMode` forces raw JSON output.
 */
function structuredOutput<T extends Record<string, unknown>>(
  model: BaseChatModel,
  schema: import("zod").ZodType<T>,
  name: string,
) {
  if (activeProvider === "groq") {
    return model.withStructuredOutput<T>(schema, { name, method: "jsonMode" });
  }
  return model.withStructuredOutput<T>(schema, { name });
}

/** Suffix appended to system prompts when using Groq's JSON mode. */
const JSON_MODE_SUFFIX =
  "\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanation, no wrapping key. Output the object directly at the top level matching the requested schema exactly. Do not add extra fields beyond what is requested.";

/** Return the system prompt, with JSON instruction appended for Groq. */
function sysPrompt(prompt: string): string {
  return activeProvider === "groq" ? prompt + JSON_MODE_SUFFIX : prompt;
}

/**
 * Planner node: analyzes `pdfText` and produces a structured `LessonPlan`
 * using structured-output (JSON) mode.
 */
export async function plannerNode(
  state: AgentState,
): Promise<AgentStateUpdate> {
  const pdfText = state.pdfText?.trim();
  if (!pdfText) {
    throw new Error("Cannot draft a lesson plan: pdfText is empty");
  }

  const model = createModel();
  const structured = structuredOutput(model, LessonPlanSchema, "lesson_plan");

  const lessonPlan = await structured.invoke([
    { role: "system", content: sysPrompt(PLANNER_SYSTEM_PROMPT) },
    { role: "user", content: buildPlannerHumanPrompt(pdfText) },
  ]);

  return {
    lessonPlan,
    isPlanApproved: false,
    currentObjectiveIndex: 0,
    currentQuestionIndex: 0,
    questions: [],
    userAttempts: {},
    isCompleted: false,
  };
}

/**
 * Approval node: pauses execution via `interrupt()` so a human can review the
 * lesson plan through the HITL flow.
 *
 * Accepts `{ approved: boolean, feedback?: string, revise?: boolean }`.
 *
 * - `approved: true` (with optional feedback) → proceed to MCQ generation.
 * - `revise: true` with `feedback` → regenerate the plan and loop back.
 * - `approved: false` → reject / end the lesson.
 */
export async function approvalNode(
  state: AgentState,
): Promise<AgentStateUpdate> {
  const decision = interrupt({
    type: "plan-approval",
    lessonPlan: state.lessonPlan,
    message: "Please review the proposed lesson plan and approve to continue.",
  });

  // Normalize the decision payload.
  const approved =
    typeof decision === "boolean"
      ? decision
      : Boolean(
          decision && typeof decision === "object" && "approved" in decision
            ? (decision as { approved: unknown }).approved
            : false,
        );

  const revise =
    decision && typeof decision === "object" && "revise" in decision
      ? Boolean((decision as { revise: unknown }).revise)
      : false;

  const feedback =
    decision && typeof decision === "object" && "feedback" in decision
      ? String((decision as { feedback: unknown }).feedback || "")
      : "";

  // Revise flow: regenerate the plan with feedback but do NOT approve it.
  if (revise && feedback.trim()) {
    const model = createModel();
    const structured = structuredOutput(model, LessonPlanSchema, "lesson_plan");

    const revisedPlan = await structured.invoke([
      { role: "system", content: sysPrompt(PLANNER_SYSTEM_PROMPT) },
      { role: "user", content: buildPlannerHumanPrompt(state.pdfText) },
      {
        role: "assistant",
        content: `Here is the initial plan: ${JSON.stringify(state.lessonPlan)}`,
      },
      {
        role: "user",
        content: `Please revise the plan based on this feedback: ${feedback}`,
      },
    ]);

    return { isPlanApproved: false, lessonPlan: revisedPlan };
  }

  // If approved with feedback, regenerate plan incorporating changes.
  if (approved && feedback.trim()) {
    const model = createModel();
    const structured = structuredOutput(model, LessonPlanSchema, "lesson_plan");

    const revisedPlan = await structured.invoke([
      { role: "system", content: sysPrompt(PLANNER_SYSTEM_PROMPT) },
      { role: "user", content: buildPlannerHumanPrompt(state.pdfText) },
      {
        role: "assistant",
        content: `Here is the initial plan: ${JSON.stringify(state.lessonPlan)}`,
      },
      {
        role: "user",
        content: `Please revise the plan based on this feedback: ${feedback}`,
      },
    ]);

    return { isPlanApproved: true, lessonPlan: revisedPlan };
  }

  // Reject: set lessonPlan to null so the router ends the graph.
  if (!approved) {
    return { isPlanApproved: false, lessonPlan: null };
  }

  return { isPlanApproved: approved };
}

/**
 * MCQ generator node: produces MCQs for the current objective.
 * Used both within the graph (first objective) and standalone (subsequent).
 */
export async function mcqGeneratorNode(
  state: AgentState,
): Promise<AgentStateUpdate> {
  const plan = state.lessonPlan;
  if (!plan) {
    throw new Error("Cannot generate MCQs: no lesson plan is present");
  }

  const objectiveIndex = state.currentObjectiveIndex;
  const objective = plan.objectives[objectiveIndex];
  if (!objective) {
    return { isCompleted: true };
  }

  const model = createModel();
  const structured = structuredOutput(
    model,
    MCQQuestionBatchSchema,
    "mcq_batch",
  );

  const batch = await structured.invoke([
    { role: "system", content: sysPrompt(MCQ_GENERATOR_SYSTEM_PROMPT) },
    {
      role: "user",
      content: buildMcqHumanPrompt({
        pdfText: state.pdfText,
        objective,
        objectiveIndex,
        count: QUESTIONS_PER_OBJECTIVE,
      }),
    },
  ]);

  // Normalise ids for deterministic grouping in the summary.
  const questions: MCQQuestion[] = batch.questions.map((q, i) => ({
    ...q,
    id: `obj${objectiveIndex}-q${i}`,
    objectiveIndex,
  }));

  return {
    questions,
    currentQuestionIndex: 0,
  };
}

/**
 * Standalone MCQ generation function (not a graph node).
 * Called directly by the API route for subsequent objectives after the first.
 */
export async function generateMCQs(params: {
  pdfText: string;
  objective: LearningObjective;
  objectiveIndex: number;
}): Promise<MCQQuestion[]> {
  const { pdfText, objective, objectiveIndex } = params;

  const model = createModel();
  const structured = structuredOutput(
    model,
    MCQQuestionBatchSchema,
    "mcq_batch",
  );

  const batch = await structured.invoke([
    { role: "system", content: sysPrompt(MCQ_GENERATOR_SYSTEM_PROMPT) },
    {
      role: "user",
      content: buildMcqHumanPrompt({
        pdfText,
        objective,
        objectiveIndex,
        count: QUESTIONS_PER_OBJECTIVE,
      }),
    },
  ]);

  return batch.questions.map((q, i) => ({
    ...q,
    id: `obj${objectiveIndex}-q${i}`,
    objectiveIndex,
  }));
}

/**
 * Standalone study-tips generation function.
 * Called by the API route to generate personalized tips at lesson end.
 */
export async function generateStudyTips(params: {
  lessonTitle: string;
  totalQuestions: number;
  totalCorrect: number;
  totalAttempts: number;
  perObjective: { title: string; correct: number; total: number }[];
}): Promise<string[]> {
  try {
    const model = createModel();
    const structured = structuredOutput(model, StudyTipsSchema, "study_tips");
    const result = await structured.invoke([
      { role: "system", content: sysPrompt(SUMMARY_SYSTEM_PROMPT) },
      { role: "user", content: buildSummaryHumanPrompt(params) },
    ]);
    return result.tips;
  } catch {
    return [
      "Review the objectives where you needed multiple attempts.",
      "Re-read the source material and try the lesson again to reinforce it.",
    ];
  }
}
