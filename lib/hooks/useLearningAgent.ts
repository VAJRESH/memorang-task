"use client";

import type {
  AgentResponse,
  LearningPhase,
  PendingInterrupt,
  PublicAgentState,
} from "@/lib/agent/client-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ROUTES } from "../constant";

/** Supported AI providers. */
export type AIProvider = "gemini" | "groq";

/** A saved session from the database. */
export interface SavedSession {
  id: string;
  title: string;
  difficulty: string;
  objectiveCount: number;
  objectives: { title: string; description: string }[];
  totalQuestions: number;
  totalCorrect: number;
  totalAttempts: number;
  accuracy: number;
  studyTips: string[];
  completed: boolean;
  provider: string;
  createdAt: string;
  completedAt: string | null;
}

/** Generate a reasonably unique thread id for the checkpointer. */
function newThreadId(): string {
  const rand = Math.random().toString(36).slice(2);
  return `lesson-${Date.now()}-${rand}`;
}

const EMPTY_STATE: PublicAgentState = {
  lessonPlan: null,
  isPlanApproved: false,
  currentObjectiveIndex: 0,
  questions: [],
  currentQuestionIndex: 0,
  userAttempts: {},
  feedback: null,
  summary: null,
  isCompleted: false,
};

export function useLearningAgent() {
  const threadIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const providerRef = useRef<AIProvider>("groq");

  const [provider, setProvider] = useState<AIProvider>("groq");
  const [state, setState] = useState<PublicAgentState>(EMPTY_STATE);
  const [interrupt, setInterrupt] = useState<PendingInterrupt | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  providerRef.current = provider;

  // Load session history on mount.
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = useCallback(() => {
    fetch(ROUTES.api.session)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions ?? []))
      .catch(() => {});
  }, []);

  const applyResponse = useCallback((data: AgentResponse) => {
    setState(data.state);
    setInterrupt(data.interrupt);
  }, []);

  // --- Session persistence helpers (fire-and-forget) ---
  const createSession = useCallback(
    async (plan: {
      title: string;
      difficulty: string;
      objectives: { title: string; description: string }[];
    }) => {
      try {
        const res = await fetch(ROUTES.api.session, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            title: plan.title,
            difficulty: plan.difficulty,
            objectives: plan.objectives,
            provider: providerRef.current,
          }),
        });
        const { id } = (await res.json()) as { id: string };
        sessionIdRef.current = id;
      } catch {
        // Non-critical — session just won't be persisted.
      }
    },
    [],
  );

  const recordAttempt = useCallback(
    async (data: {
      questionId: string;
      objectiveTitle: string;
      question: string;
      selectedOptionId: string;
      correct: boolean;
      attemptNumber: number;
    }) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || sessionId.startsWith("no-db-")) return;
      try {
        await fetch(ROUTES.api.session, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "attempt", sessionId, ...data }),
        });
      } catch {}
    },
    [],
  );

  const completeSession = useCallback(
    async (summary: {
      totalQuestions: number;
      totalCorrect: number;
      totalAttempts: number;
      accuracy: number;
      studyTips: string[];
    }) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || sessionId.startsWith("no-db-")) return;

      try {
        await fetch(ROUTES.api.session, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", sessionId, ...summary }),
        });

        // Refresh session list.
        loadSessions();
      } catch {}
    },
    [],
  );

  const callAgent = useCallback(
    async (
      body:
        | { action: "start"; threadId: string; pdfText: string }
        | { action: "resume"; threadId: string; resume: unknown },
    ): Promise<void> => {
      const res = await fetch(ROUTES.api.agent, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, provider: providerRef.current }),
      });
      const data = (await res.json().catch(() => ({}))) as AgentResponse & {
        error?: string;
      };

      if (data.state) {
        applyResponse(data as AgentResponse);
      }

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Agent request failed (${res.status})`);
      }
    },
    [applyResponse],
  );

  /** Upload a PDF, extract text, and start the agent. */
  const uploadPdf = useCallback(
    async (file: File): Promise<void> => {
      setError(null);
      setIsBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(ROUTES.api.uploadPdf, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const detail = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(detail.error ?? `Upload failed (${res.status})`);
        }
        const { text } = (await res.json()) as { text: string };

        const threadId = newThreadId();
        threadIdRef.current = threadId;
        await callAgent({ action: "start", threadId, pdfText: text });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setIsBusy(false);
      }
    },
    [callAgent],
  );

  const resume = useCallback(
    async (resumeValue: unknown): Promise<void> => {
      const threadId = threadIdRef.current;
      if (!threadId) {
        setError("No active lesson to resume");
        return;
      }
      setError(null);
      setIsBusy(true);
      try {
        await callAgent({ action: "resume", threadId, resume: resumeValue });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setIsBusy(false);
      }
    },
    [callAgent],
  );

  const approvePlan = useCallback(
    async (feedback?: string) => {
      await resume({ approved: true, feedback });
    },
    [resume],
  );
  const rejectPlan = useCallback(
    (feedback?: string) => resume({ approved: false, feedback }),
    [resume],
  );
  const revisePlan = useCallback(
    (feedback: string) => resume({ revise: true, feedback }),
    [resume],
  );
  const submitAnswer = useCallback(
    (selectedOptionId: string) => resume({ selectedOptionId }),
    [resume],
  );
  const continueLesson = useCallback(
    () => resume({ continue: true }),
    [resume],
  );

  const switchProvider = useCallback((p: AIProvider) => {
    setProvider(p);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    threadIdRef.current = null;
    sessionIdRef.current = null;
    setState(EMPTY_STATE);
    setInterrupt(null);
    setError(null);
    setIsBusy(false);
  }, []);

  const phase: LearningPhase = useMemo(() => {
    if (state.summary || state.isCompleted) return "completed";
    if (state.isPlanApproved) return "quizzing";
    if (state.lessonPlan && !interrupt) return "awaiting-approval";
    if (state.lessonPlan && interrupt?.value?.type === "plan-approval")
      return "awaiting-approval";
    if (isBusy && !state.lessonPlan) return "planning";
    return "idle";
  }, [state, isBusy, interrupt]);

  const currentQuestion = useMemo(
    () => state.questions[state.currentQuestionIndex] ?? null,
    [state.questions, state.currentQuestionIndex],
  );

  const isReviewing = interrupt?.value?.type === "review-feedback";

  // --- Side effects: persist session data when state transitions occur ---

  // Create session when plan is first approved.
  const prevApproved = useRef(false);
  useEffect(() => {
    if (state.isPlanApproved && !prevApproved.current && state.lessonPlan) {
      prevApproved.current = true;
      createSession({
        title: state.lessonPlan.title,
        difficulty: state.lessonPlan.difficulty,
        objectives: state.lessonPlan.objectives,
      });
    }
    if (!state.isPlanApproved) prevApproved.current = false;
  }, [state.isPlanApproved, state.lessonPlan, createSession]);

  // Record attempt when feedback arrives.
  const lastFeedbackRef = useRef<string | null>(null);
  useEffect(() => {
    const fb = state.feedback;
    if (!fb) return;
    const key = `${fb.questionId}-${fb.selectedOptionId}`;
    if (key === lastFeedbackRef.current) return;
    lastFeedbackRef.current = key;

    const question = state.questions.find((q) => q.id === fb.questionId);
    const objective =
      state.lessonPlan?.objectives[question?.objectiveIndex ?? 0];
    const attemptNumber = state.userAttempts[fb.questionId]?.attempts ?? 1;

    recordAttempt({
      questionId: fb.questionId,
      objectiveTitle: objective?.title ?? "Unknown",
      question: question?.question ?? "",
      selectedOptionId: fb.selectedOptionId,
      correct: fb.isCorrect,
      attemptNumber,
    });
  }, [
    state.feedback,
    state.questions,
    state.lessonPlan,
    state.userAttempts,
    recordAttempt,
  ]);

  // Complete session when summary arrives.
  const completedRef = useRef(false);
  useEffect(() => {
    if (state.summary && !completedRef.current) {
      completedRef.current = true;
      const s = state.summary;
      completeSession({
        totalQuestions: s.totalQuestions,
        totalCorrect: s.totalCorrect,
        totalAttempts: s.totalAttempts,
        accuracy:
          s.totalQuestions > 0
            ? Math.round((s.totalCorrect / s.totalQuestions) * 100)
            : 0,
        studyTips: s.studyTips,
      });
    }
    if (!state.summary) completedRef.current = false;
  }, [state.summary, completeSession]);

  return {
    state,
    interrupt,
    phase,
    currentQuestion,
    isReviewing,
    isBusy,
    error,
    provider,
    sessions,
    uploadPdf,
    approvePlan,
    rejectPlan,
    revisePlan,
    submitAnswer,
    continueLesson,
    switchProvider,
    reset,
  };
}
