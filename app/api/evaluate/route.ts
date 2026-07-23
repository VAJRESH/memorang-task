import { NextRequest } from "next/server";
import { getQuestion } from "@/lib/agent/question-store";

/**
 * Server-side answer evaluation endpoint.
 *
 * The client submits a questionId + selectedOptionId. The server looks up the
 * full question (with correctOptionId, explanation, hint) from the in-memory
 * store and returns feedback without ever exposing the correct answer upfront.
 *
 * Response shape:
 *   { questionId, selectedOptionId, isCorrect, explanation?, hint? }
 */
export const runtime = "nodejs";

interface EvaluateRequest {
  questionId: string;
  selectedOptionId: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: EvaluateRequest;
  try {
    body = (await req.json()) as EvaluateRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.questionId || !body.selectedOptionId) {
    return Response.json(
      { error: "Missing questionId or selectedOptionId" },
      { status: 400 },
    );
  }

  const question = await getQuestion(body.questionId);
  if (!question) {
    return Response.json(
      { error: "Question not found. It may have expired." },
      { status: 404 },
    );
  }

  const isCorrect = body.selectedOptionId === question.correctOptionId;

  return Response.json(
    {
      questionId: body.questionId,
      selectedOptionId: body.selectedOptionId,
      isCorrect,
      // Only reveal explanation on correct answer, hint on incorrect.
      explanation: isCorrect ? question.explanation : undefined,
      hint: isCorrect ? undefined : question.hint,
    },
    { status: 200 },
  );
}
