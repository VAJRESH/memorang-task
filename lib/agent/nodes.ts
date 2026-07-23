import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { interrupt } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import type { AgentState, AgentStateUpdate } from "./state";
import {
  LessonPlanSchema,
  MCQQuestionBatchSchema,
  StudyTipsSchema,
  type LessonPlan,
  type LessonSummary,
  type MCQQuestion,
  type ObjectiveScore,
} from "./schemas";
import {
  MCQ_GENERATOR_SYSTEM_PROMPT,
  PLANNER_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  buildMcqHumanPrompt,
  buildPlannerHumanPrompt,
  buildSummaryHumanPrompt,
} from "./prompts";

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
 * Planner node: analyzes `pdfText` and produces a structured `LessonPlan`
 * using Gemini's structured-output (JSON) mode.
 */
export async function plannerNode(
  state: AgentState,
): Promise<AgentStateUpdate> {
  const pdfText = state.pdfText?.trim();
  if (!pdfText) {
    throw new Error("Cannot draft a lesson plan: pdfText is empty");
  }

  const model = createModel();
  const structured = model.withStructuredOutput<LessonPlan>(LessonPlanSchema, {
    name: "lesson_plan",
  });

  const lessonPlan = await structured.invoke([
    { role: "system", content: PLANNER_SYSTEM_PROMPT },
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
 * lesson plan through the CopilotKit HITL flow.
 *
 * The value passed to `interrupt()` is surfaced to the client; the value the
 * client resumes with (via `Command({ resume })`) becomes the return value.
 * Accepts `{ approved: boolean, feedback?: string, revise?: boolean }`.
 *
 * - `approved: true` (with optional feedback) → proceed to quizzing.
 * - `revise: true` with `feedback` → regenerate the plan and loop back for review.
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
  // The graph will route back to this node for another review cycle.
  if (revise && feedback.trim()) {
    const model = createModel();
    const structured = model.withStructuredOutput<LessonPlan>(
      LessonPlanSchema,
      { name: "lesson_plan" },
    );

    const revisedPlan = await structured.invoke([
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
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

  // If approved with feedback, regenerate the plan incorporating changes
  // and proceed to quizzing.
  if (approved && feedback.trim()) {
    const model = createModel();
    const structured = model.withStructuredOutput<LessonPlan>(
      LessonPlanSchema,
      { name: "lesson_plan" },
    );

    const revisedPlan = await structured.invoke([
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
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
 * MCQ generator node: produces 4-choice MCQs for the current objective, each
 * with a correct option id, an explanation, and a subtle hint.
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
    // No objective at this index -> nothing left to teach.
    return { isCompleted: true };
  }

  const model = createModel();
  const structured = model.withStructuredOutput(MCQQuestionBatchSchema, {
    name: "mcq_batch",
  });

  const batch = await structured.invoke([
    { role: "system", content: MCQ_GENERATOR_SYSTEM_PROMPT },
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

  // Normalise: always use stable deterministic ids so the summary node can
  // group questions by objective reliably (regardless of what the LLM returns).
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
 * Evaluator node: validates the user's selected option id for the current
 * question, updates attempt counters, and advances through questions and
 * objectives.
 *
 * The selection is collected via `interrupt()` so the client widget can submit
 * an answer. The resume payload is expected to be `{ selectedOptionId: string }`.
 */
export async function evaluatorNode(
  state: AgentState,
): Promise<AgentStateUpdate> {
  const question = state.questions[state.currentQuestionIndex];
  if (!question) {
    // Defensive: no current question -> advance objective handling.
    return advanceAfterQuestions(state);
  }

  const submission = interrupt({
    type: "answer-question",
    question,
    message: "Select an answer to continue.",
  });

  const selectedOptionId =
    submission &&
    typeof submission === "object" &&
    "selectedOptionId" in submission
      ? String((submission as { selectedOptionId: unknown }).selectedOptionId)
      : "";

  const isCorrect = selectedOptionId === question.correctOptionId;

  const prev = state.userAttempts[question.id] ?? {
    attempts: 0,
    correct: false,
  };
  const userAttempts = {
    [question.id]: {
      attempts: prev.attempts + 1,
      correct: prev.correct || isCorrect,
    },
  };

  const feedback = {
    questionId: question.id,
    selectedOptionId,
    isCorrect,
    explanation: isCorrect ? question.explanation : undefined,
    hint: isCorrect ? undefined : question.hint,
  };

  // Whether correct or not, we only record the outcome here. Routing decides
  // what happens next: an incorrect answer loops back for a retry (with the
  // hint), a correct answer flows to the review node so the explanation can be
  // seen before advancing.
  return { userAttempts, feedback };
}

/**
 * Review node: shown after a correct answer. It pauses via `interrupt()` so the
 * learner can read the explanation, then advances to the next question or
 * objective when they choose to continue. The resume payload is ignored.
 */
export async function reviewNode(state: AgentState): Promise<AgentStateUpdate> {
  interrupt({
    type: "review-feedback",
    message: "Review the explanation, then continue.",
    feedback: state.feedback,
  });

  // Learner chose to continue -> advance, clearing feedback for the next item.
  return { ...advanceAfterQuestions(state), feedback: null };
}

/**
 * Compute the state transition after a question is answered correctly.
 * Advances the question index; when the current objective's questions are
 * exhausted, advances the objective index and clears questions so the
 * generator runs again. Marks the lesson complete when objectives run out.
 */
function advanceAfterQuestions(state: AgentState): AgentStateUpdate {
  const nextQuestionIndex = state.currentQuestionIndex + 1;

  if (nextQuestionIndex < state.questions.length) {
    // More questions remain for this objective.
    return { currentQuestionIndex: nextQuestionIndex };
  }

  // Objective's questions exhausted -> move to the next objective.
  const nextObjectiveIndex = state.currentObjectiveIndex + 1;
  const totalObjectives = state.lessonPlan?.objectives.length ?? 0;

  if (nextObjectiveIndex >= totalObjectives) {
    return { isCompleted: true };
  }

  return {
    currentObjectiveIndex: nextObjectiveIndex,
    currentQuestionIndex: 0,
    questions: [],
  };
}

/**
 * Summary node: computes the final performance report and generates
 * personalized study tips. Runs once the learning loop is complete.
 *
 * Scoring is derived deterministically from `userAttempts`; the study tips are
 * generated by Gemini from that performance profile so they stay grounded in
 * how the learner actually did.
 */
export async function summaryNode(
  state: AgentState,
): Promise<AgentStateUpdate> {
  const plan = state.lessonPlan;
  const attempts = state.userAttempts;

  const questionIds = Object.keys(attempts);
  const totalQuestions = questionIds.length;
  const totalCorrect = questionIds.filter((id) => attempts[id].correct).length;
  const totalAttempts = questionIds.reduce(
    (sum, id) => sum + attempts[id].attempts,
    0,
  );

  // Per-objective breakdown. Question ids follow the `obj{index}-q{n}` scheme
  // produced by the generator, so we bucket by that prefix.
  // If no questions match an objective's prefix (shouldn't happen with the
  // deterministic ID scheme), we still include it with 0/0 but filter later.
  const perObjective: ObjectiveScore[] = (plan?.objectives ?? [])
    .map((objective, index) => {
      const ids = questionIds.filter((id) => id.startsWith(`obj${index}-`));
      const correct = ids.filter((id) => attempts[id].correct).length;
      return { title: objective.title, correct, total: ids.length };
    })
    .filter((o) => o.total > 0);

  // Ask Gemini for concise, personalized study tips based on performance.
  let studyTips: string[] = [];
  try {
    const model = createModel();
    const structured = model.withStructuredOutput(StudyTipsSchema, {
      name: "study_tips",
    });
    const result = await structured.invoke([
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildSummaryHumanPrompt({
          lessonTitle: plan?.title ?? "the lesson",
          totalQuestions,
          totalCorrect,
          totalAttempts,
          perObjective,
        }),
      },
    ]);
    studyTips = result.tips;
  } catch {
    // Fall back to a deterministic tip if the model call fails.
    studyTips = [
      "Review the objectives where you needed multiple attempts.",
      "Re-read the source material and try the lesson again to reinforce it.",
    ];
  }

  const summary: LessonSummary = {
    totalQuestions,
    totalCorrect,
    totalAttempts,
    perObjective,
    studyTips,
  };

  return { summary, isCompleted: true };
}
