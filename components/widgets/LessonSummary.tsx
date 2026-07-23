"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { LessonSummary as LessonSummaryData } from "@/lib/agent/client-types";

export interface LessonSummaryProps {
  summary: LessonSummaryData;
  onRestart: () => void;
}

/** Final performance report with per-objective scores and study tips. */
export function LessonSummary({ summary, onRestart }: LessonSummaryProps) {
  const {
    totalQuestions,
    totalCorrect,
    totalAttempts,
    perObjective,
    studyTips,
  } = summary;
  const accuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Lesson Complete 🎉</CardTitle>
        <CardDescription>
          You answered {totalCorrect} of {totalQuestions} questions correctly (
          {accuracy}%).
          {totalAttempts > totalQuestions && (
            <>
              {" "}
              You used {totalAttempts - totalQuestions} extra attempt
              {totalAttempts - totalQuestions !== 1 ? "s" : ""} across retries.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Overall accuracy</span>
            <span className="text-gray-500">{accuracy}%</span>
          </div>
          <Progress
            value={totalCorrect}
            max={totalQuestions}
            label="Overall accuracy"
          />
        </div>

        {perObjective.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">
              Performance by objective
            </h4>
            <ul className="space-y-2">
              {perObjective.map((o, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm"
                >
                  <span className="text-gray-800">{o.title}</span>
                  <span className="font-medium text-gray-600">
                    {o.correct}/{o.total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {studyTips.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900">Study tips</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {studyTips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        <Button variant="secondary" onClick={onRestart}>
          Start a new lesson
        </Button>
      </CardContent>
    </Card>
  );
}
