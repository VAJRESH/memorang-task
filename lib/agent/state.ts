import { Annotation } from "@langchain/langgraph";
import type {
  AnswerFeedback,
  LessonPlan,
  LessonSummary,
  MCQQuestion,
  UserAttempts,
} from "./schemas";

/**
 * LangGraph state schema for the Memorang AI Learning Agent.
 *
 * The graph flows: Planner -> HITL Approval -> MCQ Generation -> Evaluation,
 * looping through objectives until the lesson is complete. Each channel below
 * is a discrete slice of that flow. Channels use `reducer` functions where a
 * "last write wins" merge is desired and provide sensible `default` values so
 * the graph can be invoked with a minimal input (typically just `pdfText`).
 */
export const AgentStateAnnotation = Annotation.Root({
  /** Raw text extracted from the uploaded PDF. Seeds the planner. */
  pdfText: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /**
   * The lesson plan drafted by the planner and approved via HITL. `null` until
   * the planner has run.
   */
  lessonPlan: Annotation<LessonPlan | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Whether the user has approved the lesson plan (resolved by HITL). */
  isPlanApproved: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  /** Index into `lessonPlan.objectives` currently being taught. */
  currentObjectiveIndex: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Generated MCQs for the current objective. */
  questions: Annotation<MCQQuestion[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** Index into `questions` for the question currently being answered. */
  currentQuestionIndex: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Per-question attempt/correctness tracking, keyed by question id. */
  userAttempts: Annotation<UserAttempts>({
    // Merge maps so evaluator updates accumulate across questions.
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  /** Feedback for the most recently submitted answer (null until answered). */
  feedback: Annotation<AnswerFeedback | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Final performance summary and study tips (null until completed). */
  summary: Annotation<LessonSummary | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** True once every objective/question has been exhausted. */
  isCompleted: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
});

/** Fully-resolved state object type for the agent graph. */
export type AgentState = typeof AgentStateAnnotation.State;

/** Partial update type returned by graph nodes. */
export type AgentStateUpdate = typeof AgentStateAnnotation.Update;
