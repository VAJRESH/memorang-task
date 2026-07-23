/**
 * Client-safe type definitions for the learning agent.
 *
 * These are plain TypeScript interfaces with NO imports from schemas.ts or
 * any server-side module. This file is safe to import from "use client"
 * components without pulling zod/langchain into the client bundle.
 */

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface LearningObjective {
  title: string;
  description: string;
}

export interface LessonPlan {
  title: string;
  difficulty: Difficulty;
  objectives: LearningObjective[];
}

export interface MCQChoice {
  id: string;
  text: string;
}

export interface MCQQuestion {
  id: string;
  objectiveIndex: number;
  question: string;
  choices: MCQChoice[];
  correctOptionId: string;
  explanation: string;
  hint: string;
}

export interface AnswerFeedback {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  explanation?: string;
  hint?: string;
}

export type UserAttempts = Record<
  string,
  { attempts: number; correct: boolean }
>;

export interface ObjectiveScore {
  title: string;
  correct: number;
  total: number;
}

export interface LessonSummary {
  totalQuestions: number;
  totalCorrect: number;
  totalAttempts: number;
  perObjective: ObjectiveScore[];
  studyTips: string[];
}

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
    type: "plan-approval" | "answer-question" | "review-feedback";
    message?: string;
    lessonPlan?: LessonPlan | null;
    question?: MCQQuestion;
  };
}

/** Full response body from the `/api/agent` endpoint. */
export interface AgentResponse {
  interrupt: PendingInterrupt | null;
  state: PublicAgentState;
  error?: string;
}

/** High-level phase of the learning experience. */
export type LearningPhase =
  | "idle"
  | "planning"
  | "awaiting-approval"
  | "quizzing"
  | "completed";
