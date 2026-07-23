import type {
  AnswerFeedback,
  LessonPlan,
  LessonSummary,
  MCQQuestion,
  UserAttempts,
} from "./schemas";

/**
 * Client-facing shapes shared between the agent API route and the React UI.
 * These mirror the server-side LangGraph state but live in a dependency-light
 * module so client components can import them without pulling in `@langchain/*`.
 */

/** Public projection of the agent graph state returned by `/api/agent`. */
export interface PublicAgentState {
  lessonPlan: LessonPlan | null;
  isPlanApproved: boolean;
  currentObjectiveIndex: number;
  questions: MCQQuestion[];
  currentQuestionIndex: number;
  userAttempts: UserAttempts;
  feedback: AnswerFeedback | null;
  summary: LessonSummary | null;
  isCompleted: boolean;
}

/** A pending HITL interrupt surfaced to the client. */
export interface PendingInterrupt {
  id: string;
  value: {
    type: "plan-approval";
    message?: string;
    lessonPlan?: LessonPlan | null;
  };
}

/** Full response body from the `/api/agent` endpoint. */
export interface AgentResponse {
  interrupt: PendingInterrupt | null;
  state: PublicAgentState;
  /** Present when the request partially succeeded (e.g. plan approved but MCQ gen failed). */
  error?: string;
}

/** High-level phase of the learning experience, derived from agent state. */
export type LearningPhase =
  | "idle" // no PDF uploaded yet
  | "planning" // extracting text / drafting the plan
  | "awaiting-approval" // plan ready, waiting on HITL approval
  | "quizzing" // answering MCQs
  | "completed"; // summary available
