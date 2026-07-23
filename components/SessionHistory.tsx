"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SavedSession } from "@/lib/hooks/useLearningAgent";

export interface SessionHistoryProps {
  sessions: SavedSession[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const difficultyTone = {
  beginner: "success",
  intermediate: "info",
  advanced: "warning",
} as const;

/** Displays all past learning sessions with their performance stats. */
export function SessionHistory({ sessions }: SessionHistoryProps) {
  if (sessions.length === 0) return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Previous Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {s.title}
                </span>
                <Badge
                  tone={
                    difficultyTone[
                      s.difficulty as keyof typeof difficultyTone
                    ] ?? "neutral"
                  }
                >
                  {s.difficulty}
                </Badge>
              </div>
              <span className="text-xs text-gray-400">
                {formatDate(s.createdAt)}
              </span>
            </div>

            {s.completed ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {s.totalCorrect}/{s.totalQuestions} correct
                    {s.totalAttempts > s.totalQuestions && (
                      <>
                        {" "}
                        • {s.totalAttempts - s.totalQuestions} retry
                        {s.totalAttempts - s.totalQuestions !== 1
                          ? " attempts"
                          : ""}
                      </>
                    )}
                  </span>
                  <span className="font-medium">{s.accuracy}%</span>
                </div>
                <Progress
                  value={s.totalCorrect}
                  max={s.totalQuestions}
                  label="Session accuracy"
                />
              </div>
            ) : (
              <span className="text-xs text-amber-600">In progress</span>
            )}

            {s.objectives.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.objectives.map((o, i) => (
                  <span
                    key={i}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                  >
                    {o.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
