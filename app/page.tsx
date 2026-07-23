"use client";

import { LessonTutor } from "@/components/LessonTutor";
import { ProviderSelector } from "@/components/ProviderSelector";
import { SessionHistory } from "@/components/SessionHistory";
import { PdfUploader } from "@/components/upload/PdfUploader";
import { LessonSummary } from "@/components/widgets/LessonSummary";
import { MCQCardWidget } from "@/components/widgets/MCQCardWidget";
import { PlanReviewWidget } from "@/components/widgets/PlanReviewWidget";
import { Card, CardContent } from "@/components/ui/card";
import { useLearningAgent } from "@/lib/hooks/useLearningAgent";

export default function HomePage() {
  const {
    state,
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
  } = useLearningAgent();

  const totalObjectives = state.lessonPlan?.objectives.length ?? 0;
  const currentObjective =
    state.lessonPlan?.objectives[state.currentObjectiveIndex];

  return (
    <>
      <LessonTutor state={state} currentQuestion={currentQuestion} />

      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
        <header className="space-y-1 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Memorang AI Learning Agent
          </h1>
          <p className="text-sm text-gray-600">
            Upload a PDF and turn it into an interactive, AI-guided lesson.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1">{error}</p>
            {phase === "idle" && (
              <p className="mt-2 text-xs text-red-500">
                You can try uploading again.
              </p>
            )}
            {phase !== "idle" && phase !== "completed" && (
              <button
                type="button"
                onClick={() => {
                  // Retry the last action by re-approving or re-submitting.
                  if (phase === "awaiting-approval" && state.isPlanApproved) {
                    // Plan was approved but MCQ gen failed — resume to retry.
                    approvePlan();
                  }
                }}
                className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
                disabled={isBusy}
              >
                Try again
              </button>
            )}
          </div>
        )}

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4">
            <ProviderSelector
              value={provider}
              onChange={switchProvider}
              disabled={isBusy}
            />
            <p className="text-xs text-gray-400">
              Switch provider if one hits rate limits
            </p>
            <PdfUploader onUpload={uploadPdf} disabled={isBusy} />
          </div>
        )}

        {phase === "planning" && (
          <Card>
            <CardContent className="pt-5">
              <Spinner label="Analyzing your PDF and drafting a lesson plan..." />
            </CardContent>
          </Card>
        )}

        {phase === "awaiting-approval" && state.lessonPlan && (
          <PlanReviewWidget
            plan={state.lessonPlan}
            onApprove={approvePlan}
            onReject={rejectPlan}
            onRevise={revisePlan}
            disabled={isBusy}
          />
        )}

        {phase === "quizzing" && (
          <>
            {currentQuestion ? (
              <MCQCardWidget
                question={currentQuestion}
                feedback={state.feedback}
                objectiveNumber={state.currentObjectiveIndex + 1}
                totalObjectives={totalObjectives}
                questionIndex={state.currentQuestionIndex}
                totalQuestions={state.questions.length}
                userAttempts={state.userAttempts}
                objectiveTitle={currentObjective?.title ?? ""}
                onSubmit={submitAnswer}
                onContinue={continueLesson}
                isReviewing={isReviewing}
                disabled={isBusy}
              />
            ) : (
              <Card>
                <CardContent className="pt-5">
                  <Spinner label="Generating questions..." />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {phase === "completed" && state.summary && (
          <LessonSummary summary={state.summary} onRestart={reset} />
        )}

        {phase === "completed" && !state.summary && (
          <Card>
            <CardContent className="pt-5">
              <Spinner label="Preparing your summary..." />
            </CardContent>
          </Card>
        )}

        {/* Session history — always visible when there are sessions */}
        {sessions.length > 0 && <SessionHistory sessions={sessions} />}
      </main>
    </>
  );
}

/** Loading indicator shown while the agent is working. */
function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
