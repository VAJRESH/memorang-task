"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  AnswerFeedback,
  MCQQuestion,
  UserAttempts,
} from "@/lib/agent/client-types";

export interface MCQCardWidgetProps {
  question: MCQQuestion;
  /** Feedback for this question, if the user has already submitted. */
  feedback: AnswerFeedback | null;
  /** 1-based position of the current objective. */
  objectiveNumber: number;
  totalObjectives: number;
  /** Current question index within the objective (0-based). */
  questionIndex: number;
  /** Total questions in this objective batch. */
  totalQuestions: number;
  /** All user attempts across the lesson so far. */
  userAttempts: UserAttempts;
  /** Name of the current objective being worked on. */
  objectiveTitle: string;
  onSubmit: (selectedOptionId: string) => void;
  /** Advance past the explanation to the next question/objective. */
  onContinue: () => void;
  /** True when the graph is paused on the review step after a correct answer. */
  isReviewing?: boolean;
  disabled?: boolean;
}

/**
 * Interactive MCQ widget with:
 * - Overall lesson progress bar (objectives completed)
 * - Per-question position indicator (Q1 of N)
 * - Attempt counter for the current question
 * - Visual green/red feedback, hints, explanations, retry
 */
export function MCQCardWidget({
  question,
  feedback,
  objectiveNumber,
  totalObjectives,
  questionIndex,
  totalQuestions,
  userAttempts,
  objectiveTitle,
  onSubmit,
  onContinue,
  isReviewing,
  disabled,
}: MCQCardWidgetProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Feedback that belongs to *this* question.
  const activeFeedback =
    feedback && feedback.questionId === question.id ? feedback : null;
  const answeredCorrectly = activeFeedback?.isCorrect ?? false;

  // Attempt count for this question.
  const attempts = userAttempts[question.id]?.attempts ?? 0;

  // Reset the selection when the question changes.
  useEffect(() => {
    setSelected(null);
  }, [question.id]);

  const handleSubmit = () => {
    if (selected && !disabled) onSubmit(selected);
  };

  // Calculate progress: questions answered correctly so far vs. total expected.
  const totalCorrectSoFar = Object.values(userAttempts).filter(
    (a) => a.correct,
  ).length;

  // Total questions already seen (from userAttempts) plus remaining in current batch.
  const questionsAlreadyDone = Object.keys(userAttempts).length;
  const remainingInBatch = totalQuestions - (questionIndex + 1);
  // Remaining objectives after the current one (each generates `totalQuestions` questions).
  const remainingObjectives = totalObjectives - objectiveNumber;
  const estimatedTotal = Math.max(
    questionsAlreadyDone +
      remainingInBatch +
      1 +
      remainingObjectives * totalQuestions,
    totalCorrectSoFar,
  );

  return (
    <Card className="w-full">
      <CardHeader className="space-y-3">
        {/* Current objective name */}
        <div className="rounded-md bg-indigo-50 px-3 py-2">
          <p className="text-xs font-medium text-indigo-600">
            Objective {objectiveNumber}: {objectiveTitle}
          </p>
        </div>

        {/* Top row: objective + question position + attempts */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">
            Objective {objectiveNumber}/{totalObjectives}
          </Badge>
          <Badge tone="neutral">
            Question {questionIndex + 1}/{totalQuestions}
          </Badge>
          {attempts > 0 && (
            <Badge tone={answeredCorrectly ? "success" : "warning"}>
              {answeredCorrectly
                ? `Solved in ${attempts} attempt${attempts > 1 ? "s" : ""}`
                : `Attempt ${attempts}`}
            </Badge>
          )}
          {activeFeedback && !answeredCorrectly && (
            <Badge tone="danger">Incorrect</Badge>
          )}
          {answeredCorrectly && <Badge tone="success">Correct!</Badge>}
        </div>

        {/* Overall lesson progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Lesson progress</span>
            <span>
              {totalCorrectSoFar}/{estimatedTotal} questions correct
            </span>
          </div>
          <Progress
            value={totalCorrectSoFar}
            max={estimatedTotal}
            label="Overall lesson progress"
          />
        </div>

        <CardTitle className="text-base">{question.question}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <fieldset
          className="space-y-2"
          disabled={disabled || answeredCorrectly}
        >
          <legend className="sr-only">Answer choices</legend>
          {question.choices.map((choice) => {
            const isChosen = selected === choice.id;
            const isThisTheSubmitted =
              activeFeedback?.selectedOptionId === choice.id;

            const showGreen =
              isThisTheSubmitted && activeFeedback?.isCorrect === true;
            const showRed =
              isThisTheSubmitted && activeFeedback?.isCorrect === false;

            return (
              <label
                key={choice.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                  showGreen && "border-green-500 bg-green-50",
                  showRed && "border-red-500 bg-red-50",
                  !showGreen &&
                    !showRed &&
                    isChosen &&
                    "border-indigo-500 bg-indigo-50",
                  !showGreen &&
                    !showRed &&
                    !isChosen &&
                    "border-gray-200 hover:bg-gray-50",
                )}
              >
                <input
                  type="radio"
                  name={`mcq-${question.id}`}
                  value={choice.id}
                  checked={isChosen}
                  onChange={() => setSelected(choice.id)}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-gray-900">{choice.text}</span>
              </label>
            );
          })}
        </fieldset>

        {/* Explanation on correct */}
        {activeFeedback?.isCorrect && activeFeedback.explanation && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            <p className="font-medium">Explanation</p>
            <p>{activeFeedback.explanation}</p>
          </div>
        )}

        {/* Hint on incorrect */}
        {activeFeedback && !activeFeedback.isCorrect && activeFeedback.hint && (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            <p className="font-medium">
              Hint{attempts > 1 ? ` (attempt ${attempts})` : ""}
            </p>
            <p>{activeFeedback.hint}</p>
          </div>
        )}

        {/* Submit / Retry button */}
        {!answeredCorrectly && (
          <Button onClick={handleSubmit} disabled={disabled || !selected}>
            {activeFeedback && !activeFeedback.isCorrect
              ? `Retry (attempt ${attempts + 1})`
              : "Submit answer"}
          </Button>
        )}

        {/* Continue button after correct */}
        {answeredCorrectly && (
          <Button onClick={onContinue} disabled={disabled || !isReviewing}>
            Continue →
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
