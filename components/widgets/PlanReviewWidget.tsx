"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LessonPlan } from "@/lib/agent/client-types";

const difficultyTone = {
  beginner: "success",
  intermediate: "info",
  advanced: "warning",
} as const;

export interface PlanReviewWidgetProps {
  plan: LessonPlan;
  onApprove: (feedback?: string) => void;
  onReject: (feedback?: string) => void;
  onRevise: (feedback: string) => void;
  disabled?: boolean;
}

/**
 * HITL lesson-plan approval widget. Renders the drafted plan and lets the user:
 * - Approve as-is (proceed to quizzing)
 * - Provide feedback and click Revise (agent regenerates plan for another review)
 * - Reject (end the flow)
 */
export function PlanReviewWidget({
  plan,
  onApprove,
  onReject,
  onRevise,
  disabled,
}: PlanReviewWidgetProps) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  // Clear feedback input when the plan is revised (new plan arrives).
  useEffect(() => {
    setFeedback("");
    setShowFeedback(false);
  }, [plan]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{plan.title}</CardTitle>
          <Badge tone={difficultyTone[plan.difficulty]}>
            {plan.difficulty}
          </Badge>
        </div>
        <CardDescription>
          Review the proposed learning path. Approve to start, or suggest
          changes below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3">
          {plan.objectives.map((objective, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {objective.title}
                </p>
                <p className="text-sm text-gray-500">{objective.description}</p>
              </div>
            </li>
          ))}
        </ol>

        {!showFeedback && (
          <button
            type="button"
            onClick={() => setShowFeedback(true)}
            className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
            disabled={disabled}
          >
            ✏️ Suggest changes before approving
          </button>
        )}

        {showFeedback && (
          <div className="space-y-2">
            <label
              htmlFor="plan-feedback"
              className="block text-sm font-medium text-gray-700"
            >
              Your feedback or requested changes
            </label>
            <textarea
              id="plan-feedback"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="E.g., 'Make it harder', 'Focus more on chapter 3', 'Add an objective about X'..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={disabled}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          onClick={() => onApprove(feedback || undefined)}
          disabled={disabled}
        >
          {feedback ? "Approve with changes" : "Approve & Start"}
        </Button>
        {feedback.trim() && (
          <Button
            variant="secondary"
            onClick={() => onRevise(feedback)}
            disabled={disabled}
          >
            Revise plan
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => onReject(feedback || undefined)}
          disabled={disabled}
        >
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}
