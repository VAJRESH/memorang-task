import { z } from "zod";

/**
 * Zod validation schemas and inferred TypeScript types for the Memorang AI
 * Learning Agent.
 *
 * These schemas serve two purposes:
 * 1. They drive the LLM structured-output calls (`withStructuredOutput`) in
 *    `lib/agent/nodes.ts`, guaranteeing the model returns well-shaped data.
 * 2. Their inferred types are the single source of truth for the LangGraph
 *    state channels defined in `lib/agent/state.ts`.
 */

/** Allowed difficulty levels for a lesson plan. */
export const DifficultySchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);
export type Difficulty = z.infer<typeof DifficultySchema>;

/** A single learning objective drafted by the planner. */
export const LearningObjectiveSchema = z.object({
  /** Short, human-readable objective title. */
  title: z.string().min(1).describe("Concise title of the learning objective"),
  /** One-sentence description of what the learner will master. */
  description: z
    .string()
    .min(1)
    .describe("A single sentence describing the objective"),
});
export type LearningObjective = z.infer<typeof LearningObjectiveSchema>;

/** The lesson plan the agent proposes for HITL approval. */
export const LessonPlanSchema = z.object({
  /** Overall lesson title derived from the PDF content. */
  title: z.string().min(1).describe("The overall title of the lesson"),
  /** Difficulty rating for the lesson as a whole. */
  difficulty: DifficultySchema.describe("Overall difficulty of the lesson"),
  /** Ordered list of learning objectives to work through. */
  objectives: z
    .array(LearningObjectiveSchema)
    .min(1)
    .describe("Ordered list of learning objectives"),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;

/** A single answer choice for an MCQ. */
export const MCQChoiceSchema = z.object({
  /** Stable identifier for the choice (e.g. "a", "b", "c", "d"). */
  id: z.string().min(1).describe("Stable option identifier, e.g. 'a'"),
  /** Display text for the choice. */
  text: z.string().min(1).describe("The answer choice text"),
});
export type MCQChoice = z.infer<typeof MCQChoiceSchema>;

/**
 * A generated multiple-choice question. `correctOptionId` must match one of the
 * `choices[].id` values; `hint` must guide without revealing the answer.
 */
export const MCQQuestionSchema = z.object({
  /** Unique identifier for the question. */
  id: z.string().min(1).describe("Unique question identifier"),
  /** Index of the objective this question assesses. */
  objectiveIndex: z
    .number()
    .int()
    .min(0)
    .describe("Index of the objective this question belongs to"),
  /** The question prompt. */
  question: z.string().min(1).describe("The question prompt"),
  /** Exactly four answer choices. */
  choices: z
    .array(MCQChoiceSchema)
    .length(4)
    .describe("Exactly four answer choices"),
  /** The id of the correct choice. */
  correctOptionId: z
    .string()
    .min(1)
    .describe("The id of the correct choice, must match one of choices[].id"),
  /** Explanation shown after a correct answer. */
  explanation: z
    .string()
    .min(1)
    .describe("Explanation shown once the learner answers correctly"),
  /** Subtle hint shown after an incorrect answer, never revealing the answer. */
  hint: z
    .string()
    .min(1)
    .describe("A subtle hint that must NOT reveal the correct answer"),
});
export type MCQQuestion = z.infer<typeof MCQQuestionSchema>;

/** The LLM returns a batch of questions for a single objective. */
export const MCQQuestionBatchSchema = z.object({
  questions: z
    .array(MCQQuestionSchema)
    .min(1)
    .describe("The generated questions for the current objective"),
});
export type MCQQuestionBatch = z.infer<typeof MCQQuestionBatchSchema>;

/** Structured output shape for the study-tips generation call. */
export const StudyTipsSchema = z.object({
  tips: z
    .array(z.string().min(1))
    .min(1)
    .max(5)
    .describe("2-5 concise, personalized study tips"),
});
export type StudyTips = z.infer<typeof StudyTipsSchema>;

/**
 * Per-question attempt tracking. Keyed by question id.
 */
export type UserAttempts = Record<
  string,
  {
    /** Number of attempts the learner has made on this question. */
    attempts: number;
    /** Whether the question has ultimately been answered correctly. */
    correct: boolean;
  }
>;

/**
 * Feedback produced by the evaluator for the most recently submitted answer.
 * Consumed by the MCQ widget to render green/red highlighting plus the
 * appropriate explanation (correct) or hint (incorrect).
 */
export type AnswerFeedback = {
  /** Id of the question this feedback refers to. */
  questionId: string;
  /** The option id the learner submitted. */
  selectedOptionId: string;
  /** Whether the submitted option was correct. */
  isCorrect: boolean;
  /** Shown on a correct answer. */
  explanation?: string;
  /** Shown on an incorrect answer; never reveals the answer. */
  hint?: string;
};

/**
 * A per-objective performance line used in the final summary report.
 */
export type ObjectiveScore = {
  title: string;
  /** Number of questions in the objective that were answered correctly. */
  correct: number;
  /** Total number of questions asked for the objective. */
  total: number;
};

/**
 * Final lesson summary rendered at the end of the learning loop.
 */
export type LessonSummary = {
  totalQuestions: number;
  totalCorrect: number;
  /** Total attempts across all questions (retries included). */
  totalAttempts: number;
  perObjective: ObjectiveScore[];
  /** Personalized study tips generated from performance. */
  studyTips: string[];
};
