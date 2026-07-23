"use client";

import type {
  AgentResponse,
  AnswerFeedback,
  LearningPhase,
  LessonSummary,
  MCQQuestion,
  PendingInterrupt,
  PublicAgentState,
  UserAttempts,
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
  /** Store PDF text for generating MCQs for subsequent objectives. */
  const pdfTextRef = useRef<string>("");

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
        loadSessions();
      } catch {}
    },
    [loadSessions],
  );

  // --- Agent calls (graph-based: start and resume only) ---
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

  // --- Standalone MCQ generation for subsequent objectives ---
  const fetchMCQs = useCallback(
    async (objectiveIndex: number): Promise<MCQQuestion[]> => {
      const plan = state.lessonPlan;
      if (!plan) throw new Error("No lesson plan");

      const objective = plan.objectives[objectiveIndex];
      if (!objective) throw new Error("Invalid objective index");

      const res = await fetch(ROUTES.api.agent, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-mcqs",
          pdfText: pdfTextRef.current,
          objective,
          objectiveIndex,
          provider: providerRef.current,
        }),
      });

      const data = (await res.json()) as {
        questions?: MCQQuestion[];
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to generate questions");
      }
      return data.questions ?? [];
    },
    [state.lessonPlan],
  );

  // --- Standalone study-tips generation ---
  const fetchStudyTips = useCallback(
    async (params: {
      totalQuestions: number;
      totalCorrect: number;
      totalAttempts: number;
      perObjective: { title: string; correct: number; total: number }[];
    }): Promise<string[]> => {
      try {
        const res = await fetch(ROUTES.api.agent, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate-tips",
            lessonTitle: state.lessonPlan?.title ?? "the lesson",
            ...params,
            provider: providerRef.current,
          }),
        });
        const data = (await res.json()) as { tips?: string[]; error?: string };
        return (
          data.tips ?? [
            "Review the objectives where you needed multiple attempts.",
          ]
        );
      } catch {
        return [
          "Review the objectives where you needed multiple attempts.",
          "Re-read the source material and try the lesson again.",
        ];
      }
    },
    [state.lessonPlan],
  );

  /** Upload a PDF, extract text, and start the agent graph. */
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
        pdfTextRef.current = text;

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

  /** Resume the graph (used for plan approval/rejection/revision). */
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

  /**
   * Submit an answer — evaluated server-side via /api/evaluate.
   * The server holds the correct answers; the client never sees them.
   */
  const submitAnswer = useCallback(
    async (selectedOptionId: string) => {
      const question = state.questions[state.currentQuestionIndex];
      if (!question) return;

      setError(null);
      setIsBusy(true);

      try {
        const res = await fetch(ROUTES.api.evaluate, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: question.id,
            selectedOptionId,
          }),
        });

        const feedback = (await res.json()) as AnswerFeedback & {
          error?: string;
        };

        if (!res.ok || feedback.error) {
          throw new Error(feedback.error ?? "Failed to evaluate answer");
        }

        setState((prev) => {
          const prevAttempt = prev.userAttempts[question.id] ?? {
            attempts: 0,
            correct: false,
          };

          const newAttempts: UserAttempts = {
            ...prev.userAttempts,
            [question.id]: {
              attempts: prevAttempt.attempts + 1,
              correct: prevAttempt.correct || feedback.isCorrect,
            },
          };

          // Fire-and-forget: record attempt to DB.
          const objective =
            prev.lessonPlan?.objectives[question.objectiveIndex];
          recordAttempt({
            questionId: question.id,
            objectiveTitle: objective?.title ?? "Unknown",
            question: question.question,
            selectedOptionId,
            correct: feedback.isCorrect,
            attemptNumber: prevAttempt.attempts + 1,
          });

          return { ...prev, userAttempts: newAttempts, feedback };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to evaluate answer");
      } finally {
        setIsBusy(false);
      }
    },
    [state.questions, state.currentQuestionIndex, recordAttempt],
  );

  /**
   * Continue to the next question or objective after a correct answer.
   * If the current objective's questions are exhausted, clears questions so
   * the MCQ-fetching effect fires for the next objective. If all objectives
   * are done, marks completed so the summary-generating effect fires.
   */
  const continueLesson = useCallback(() => {
    setError(null);

    setState((prev) => {
      const nextQuestionIndex = prev.currentQuestionIndex + 1;

      if (nextQuestionIndex < prev.questions.length) {
        // More questions in this objective batch.
        return {
          ...prev,
          currentQuestionIndex: nextQuestionIndex,
          feedback: null,
        };
      }

      // Objective exhausted — check if there are more objectives.
      const nextObjectiveIndex = prev.currentObjectiveIndex + 1;
      const totalObjectives = prev.lessonPlan?.objectives.length ?? 0;

      if (nextObjectiveIndex >= totalObjectives) {
        // All done — mark completed (summary effect will generate tips).
        return { ...prev, isCompleted: true, feedback: null, questions: [] };
      }

      // Clear questions so the MCQ-fetching effect fires for the next objective.
      return {
        ...prev,
        currentObjectiveIndex: nextObjectiveIndex,
        currentQuestionIndex: 0,
        questions: [],
        feedback: null,
      };
    });
  }, []);

  // --- Effect: fetch MCQs when questions are empty during quizzing ---
  const isFetchingMcqs = useRef(false);
  useEffect(() => {
    if (
      state.isPlanApproved &&
      !state.isCompleted &&
      state.questions.length === 0 &&
      !isBusy &&
      !isFetchingMcqs.current
    ) {
      isFetchingMcqs.current = true;
      setIsBusy(true);
      fetchMCQs(state.currentObjectiveIndex)
        .then((questions) => {
          setState((prev) => ({ ...prev, questions, currentQuestionIndex: 0 }));
        })
        .catch((e) => {
          setError(
            e instanceof Error ? e.message : "Failed to generate questions",
          );
        })
        .finally(() => {
          setIsBusy(false);
          isFetchingMcqs.current = false;
        });
    }
  }, [
    state.isPlanApproved,
    state.isCompleted,
    state.questions.length,
    state.currentObjectiveIndex,
    isBusy,
    fetchMCQs,
  ]);

  // --- Effect: generate summary when lesson is completed ---
  const isGeneratingSummary = useRef(false);
  useEffect(() => {
    if (state.isCompleted && !state.summary && !isGeneratingSummary.current) {
      isGeneratingSummary.current = true;
      setIsBusy(true);

      const attempts = state.userAttempts;
      const questionIds = Object.keys(attempts);
      const totalQuestions = questionIds.length;
      const totalCorrect = questionIds.filter(
        (id) => attempts[id].correct,
      ).length;
      const totalAttempts = questionIds.reduce(
        (sum, id) => sum + attempts[id].attempts,
        0,
      );

      const perObjective = (state.lessonPlan?.objectives ?? [])
        .map((objective, index) => {
          const ids = questionIds.filter((id) => id.startsWith(`obj${index}-`));
          const correct = ids.filter((id) => attempts[id].correct).length;
          return { title: objective.title, correct, total: ids.length };
        })
        .filter((o) => o.total > 0);

      fetchStudyTips({
        totalQuestions,
        totalCorrect,
        totalAttempts,
        perObjective,
      })
        .then((studyTips) => {
          const summary: LessonSummary = {
            totalQuestions,
            totalCorrect,
            totalAttempts,
            perObjective,
            studyTips,
          };
          setState((prev) => ({ ...prev, summary }));

          // Persist to DB.
          completeSession({
            totalQuestions,
            totalCorrect,
            totalAttempts,
            accuracy:
              totalQuestions > 0
                ? Math.round((totalCorrect / totalQuestions) * 100)
                : 0,
            studyTips,
          });
        })
        .finally(() => {
          setIsBusy(false);
          isGeneratingSummary.current = false;
        });
    }
  }, [
    state.isCompleted,
    state.summary,
    state.userAttempts,
    state.lessonPlan,
    fetchStudyTips,
    completeSession,
  ]);

  const switchProvider = useCallback((p: AIProvider) => {
    setProvider(p);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    threadIdRef.current = null;
    sessionIdRef.current = null;
    pdfTextRef.current = "";
    setState(EMPTY_STATE);
    setInterrupt(null);
    setError(null);
    setIsBusy(false);
    isFetchingMcqs.current = false;
    isGeneratingSummary.current = false;
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

  // "Reviewing" = the user answered correctly and sees the explanation.
  const isReviewing = useMemo(
    () => state.feedback?.isCorrect === true,
    [state.feedback],
  );

  // --- Side effect: create session when plan is first approved ---
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
