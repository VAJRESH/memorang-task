"use client";

import { useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import type { PublicAgentState } from "@/lib/agent/client-types";
import type { MCQQuestion } from "@/lib/agent/client-types";

export interface LessonTutorProps {
  state: PublicAgentState;
  currentQuestion: MCQQuestion | null;
}

/**
 * Wraps the app in a CopilotKit chat sidebar acting as the pedagogical tutor.
 *
 * The learner's live lesson state is exposed to the tutor via
 * `useCopilotReadable`, but the correct option id and explanation of the
 * *active* question are deliberately withheld so the model cannot leak the
 * answer even if asked directly. The server-side system prompt enforces the
 * same guardrail.
 */
export function LessonTutor({ state, currentQuestion }: LessonTutorProps) {
  // Redact answer-revealing fields from the active question before sharing it.
  const safeQuestion = currentQuestion
    ? {
        question: currentQuestion.question,
        choices: currentQuestion.choices,
        objectiveIndex: currentQuestion.objectiveIndex,
      }
    : null;

  useCopilotReadable({
    description:
      "The learner's current lesson state. Use it to give hints and " +
      "explanations, but never reveal the correct answer of the active question.",
    value: {
      lessonTitle: state.lessonPlan?.title ?? null,
      difficulty: state.lessonPlan?.difficulty ?? null,
      objectives: state.lessonPlan?.objectives.map((o) => o.title) ?? [],
      currentObjectiveIndex: state.currentObjectiveIndex,
      isCompleted: state.isCompleted,
      activeQuestion: safeQuestion,
    },
  });

  return (
    <CopilotSidebar
      labels={{
        title: "Memorang Tutor",
        initial:
          "Hi! I'm your learning tutor. Ask me for a hint or to explain a " +
          "topic — but I won't give away answers. Let's keep going!",
      }}
      defaultOpen={false}
      clickOutsideToClose
    />
  );
}
